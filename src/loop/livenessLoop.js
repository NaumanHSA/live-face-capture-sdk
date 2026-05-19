import { getFaceRect, isFaceFit } from "../util/geometry.js";
import { createVisRenderer } from "../draw/visRenderer.js";
import { drawHole, resetHoleDirtyState } from "../draw/hole.js";
import { getEAR } from "../util/blink.js";
import { ErrorCode, makeError } from "../util/errors.js";

// Pre-allocated landmark objects — reused every frame to eliminate GC pressure.
// MediaPipe Face Mesh always returns exactly 468 landmarks indexed 0–467.
const LM_COUNT = 468;
const lmBuf = new Array(LM_COUNT);
for (let i = 0; i < LM_COUNT; i++) lmBuf[i] = { x: 0, y: 0, z: 0 };

export function createLivenessLoop(ctx) {
    const {
        root,
        videoElement,
        canvasElement,
        config,
        faceLandmarker,
        blinkDetector,
        encryptFrame,
        onCapture,
        onError,
        workerUrl,
    } = ctx;

    let lastVideoTime = -1;
    let stTime = null;
    let capturedImage = null;
    let hole = null;

    let rafId = null;
    let lastInferMs = 0;
    let busy = false;
    const minMs = Math.max(10, Math.floor(1000 / (config.inferenceFps || 20)));

    // Session timeout (0 = disabled).
    const timeoutMs = config.session_timeout_ms || 0;
    let sessionStart = null;

    // Vis renderer — worker-backed when OffscreenCanvas is available.
    let visRenderer = null;

    // Inlined coordinate conversion — avoids the [x,y] array allocation that
    // the old normalized_to_pixel_coordinates() returned on every call.
    function toPixelX(n, W) { return n < 0 || n > 1 ? -1 : Math.min(Math.floor(n * W), W - 1); }
    function toPixelY(n, H) { return n < 0 || n > 1 ? -1 : Math.min(Math.floor(n * H), H - 1); }

    function captureImage(isFrontCamera) {
        const offscreen = document.createElement("canvas");
        const g = offscreen.getContext("2d");
        offscreen.width = videoElement.videoWidth;
        offscreen.height = videoElement.videoHeight;

        let width = offscreen.width;
        if (isFrontCamera) {
            g.scale(-1, 1);
            width *= -1;
        }
        g.drawImage(videoElement, 0, 0, width, offscreen.height);
        return offscreen.toDataURL("image/jpeg", config.jpeg_quality ?? 0.92);
    }

    function populateLmBuf(rawLandmarks, W, H, isFrontCamera) {
        for (let i = 0; i < rawLandmarks.length; i++) {
            const p = rawLandmarks[i];
            const xPx = toPixelX(p.x, W);
            const yPx = toPixelY(p.y, H);
            const lm = lmBuf[i];
            lm.x = xPx < 0 ? 0 : (isFrontCamera ? (W - xPx) : xPx);
            lm.y = yPx < 0 ? 0 : yPx;
            lm.z = p.z;
        }
    }

    function tick(isFrontCamera) {
        if (busy) {
            rafId = requestAnimationFrame(() => tick(isFrontCamera));
            return;
        }

        try {
            const now = performance.now();

            if (now - lastInferMs < minMs) {
                rafId = requestAnimationFrame(() => tick(isFrontCamera));
                return;
            }
            lastInferMs = now;

            // Skip inference when the video hasn't decoded a new frame yet.
            const currentTime = videoElement.currentTime;
            if (currentTime === lastVideoTime) {
                rafId = requestAnimationFrame(() => tick(isFrontCamera));
                return;
            }
            lastVideoTime = currentTime;

            const results = faceLandmarker.detectForVideo(videoElement, now);

            const W = videoElement.videoWidth;
            const H = videoElement.videoHeight;

            if (sessionStart === null) sessionStart = now;
            if (stTime === null) stTime = now;

            if (timeoutMs > 0 && now - sessionStart >= timeoutMs) {
                onError(makeError(ErrorCode.SESSION_TIMEOUT, "Session timed out"));
                return;
            }

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                if (!config.multi_fces && results.faceLandmarks.length > 1) {
                    hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, config.messages.MULTIPLE_FACES);
                    stTime = now;
                    capturedImage = null;
                    rafId = requestAnimationFrame(() => tick(isFrontCamera));
                    return;
                }

                // Select the largest detected face.
                const face = results.faceLandmarks.reduce((largest, lm) => {
                    const bbox = getFaceRect(lm, W, H);
                    const area = bbox.width * bbox.height;
                    if (!largest || area > largest.area) return { landmarks: lm, bbox, area };
                    return largest;
                }, null);

                // Populate pre-allocated buffer — zero heap allocation.
                populateLmBuf(face.landmarks, W, H, isFrontCamera);

                if (isFrontCamera) {
                    const x1 = face.bbox.x1;
                    const x2 = face.bbox.x2;
                    face.bbox.x1 = W - x2;
                    face.bbox.x2 = W - x1;
                }

                if (!hole) hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "");

                const fit = isFaceFit(
                    lmBuf,
                    config.indices.FACE_OVAL,
                    hole,
                    videoElement.offsetWidth,
                    videoElement.offsetHeight,
                    W, H,
                    face.bbox,
                    config.fc_ar_thresh
                );

                if (fit !== 0) {
                    const msg = fit === 1 ? config.messages.FACE_OUT_OF_FRAME : config.messages.MOVE_CLOSER;
                    hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, msg);
                    stTime = now;
                    capturedImage = null;
                } else {
                    hole = drawHole(root, videoElement, config, config.FACE_COLOR_SUCCESS, config.messages.HOLD_STILL);
                    const elapsed = now - stTime;

                    if (elapsed >= config.c2bt) {
                        if (!capturedImage) {
                            const ear = getEAR(lmBuf, config);
                            if (ear >= 0.25) {
                                capturedImage = captureImage(isFrontCamera);
                            } else {
                                hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, config.messages.OPEN_EYES);
                            }
                        } else {
                            hole = drawHole(root, videoElement, config, config.FACE_COLOR_SUCCESS, config.messages.BLINK_NOW);

                            if (blinkDetector(lmBuf)) {
                                busy = true;
                                if (rafId) cancelAnimationFrame(rafId);
                                rafId = null;
                                const bbox = { ...face.bbox };
                                const frame = capturedImage;
                                queueMicrotask(() => {
                                    (async () => {
                                        try {
                                            const best = (config.encrypt && encryptFrame)
                                                ? await encryptFrame(frame)
                                                : frame;
                                            await onCapture({ face_bbox: bbox, best_frame: best });
                                        } finally {
                                            busy = false;
                                        }
                                    })();
                                });
                                return;
                            }
                        }
                    }
                }

                if (config.VIS && visRenderer) {
                    visRenderer.draw(lmBuf, LM_COUNT, face.bbox, W, H);
                }
            } else {
                hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, config.messages.NO_FACE);
                stTime = now;
                capturedImage = null;
                if (config.VIS && visRenderer) visRenderer.clear(W, H);
            }
        } catch (err) {
            onError(err);
            stTime = performance.now();
            capturedImage = null;
        }

        rafId = requestAnimationFrame(() => tick(isFrontCamera));
    }

    return {
        start(isFrontCamera) {
            resetHoleDirtyState();
            sessionStart = null;
            if (config.VIS) {
                visRenderer = createVisRenderer(canvasElement, workerUrl);
            }
            rafId = requestAnimationFrame(() => tick(isFrontCamera));
        },
        stop() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
            visRenderer?.terminate();
            visRenderer = null;
        },
    };
}
