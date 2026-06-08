import { getFaceRect, isFaceFit } from "../util/geometry.js";
import { createVisRenderer } from "../draw/visRenderer.js";
import { drawHole, resetHoleDirtyState } from "../draw/hole.js";
import { selectJourney } from "../journeys/index.js";
import { ErrorCode, makeError } from "../util/errors.js";
import { createFaceAttrChecker, labelToMessage, LABEL_ANIM } from "../faceAttr/faceAttr.js";

// Pre-allocated landmark objects — reused every frame to eliminate GC pressure.
// FaceLandmarker Tasks API returns 478 landmarks (468 mesh + 10 iris points).
const LM_COUNT = 478;
const lmBuf = new Array(LM_COUNT);
for (let i = 0; i < LM_COUNT; i++) lmBuf[i] = { x: 0, y: 0, z: 0 };

export function createLivenessLoop(ctx) {
    const {
        root,
        videoElement,
        canvasElement,
        config,
        faceLandmarker,
        encryptFrame,
        onCapture,
        onError,
        workerUrl,
        faceAttrWorkerUrl,
        faceAttrOrtUrl,
        faceAttrModelUrl,
        faceAttrExtDataUrl,
        faceAttrInputType,
        faceAttrInputScale,
    } = ctx;

    let hole = null;
    let rafId = null;
    let lastInferMs = 0;
    let lastVideoTime = -1;
    let busy = false;
    const minMs = Math.max(10, Math.floor(1000 / (config.inferenceFps || 20)));

    const timeoutMs = config.session_timeout_ms || 0;
    let sessionStart = null;

    let visRenderer = null;
    const journey = selectJourney(config);

    const faceAttrChecker = faceAttrWorkerUrl
        ? createFaceAttrChecker(config, faceAttrWorkerUrl, {
              ortUrl:      faceAttrOrtUrl,
              modelUrl:    faceAttrModelUrl,
              extDataUrl:  faceAttrExtDataUrl,
              extDataPath: "face_attrib_net.data",
              inputType:   faceAttrInputType,
              inputScale:  faceAttrInputScale,
          })
        : null;

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
        for (let i = 0; i < rawLandmarks.length && i < LM_COUNT; i++) {
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

            const currentTime = videoElement.currentTime;
            if (currentTime === lastVideoTime) {
                rafId = requestAnimationFrame(() => tick(isFrontCamera));
                return;
            }
            lastVideoTime = currentTime;

            const results = faceLandmarker.detectForVideo(videoElement, now);

            const W = videoElement.videoWidth;
            const H = videoElement.videoHeight;
            const displayW = videoElement.offsetWidth || W;
            const displayH = videoElement.offsetHeight || H;

            if (sessionStart === null) sessionStart = now;

            if (timeoutMs > 0 && now - sessionStart >= timeoutMs) {
                onError(makeError(ErrorCode.SESSION_TIMEOUT, "Session timed out"));
                return;
            }

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                if (!config.multi_fces && results.faceLandmarks.length > 1) {
                    hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, config.messages.MULTIPLE_FACES);
                    journey.reset();
                    rafId = requestAnimationFrame(() => tick(isFrontCamera));
                    return;
                }

                const face = results.faceLandmarks.reduce((largest, lm) => {
                    const bbox = getFaceRect(lm, displayW, displayH);
                    const area = bbox.width * bbox.height;
                    if (!largest || area > largest.area) return { landmarks: lm, bbox, area };
                    return largest;
                }, null);

                populateLmBuf(face.landmarks, displayW, displayH, isFrontCamera);

                if (isFrontCamera) {
                    const x1 = face.bbox.x1;
                    const x2 = face.bbox.x2;
                    face.bbox.x1 = displayW - x2;
                    face.bbox.x2 = displayW - x1;
                }

                if (!hole) hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "");

                // Strict oval fit is only enforced during the initial hold phase.
                // Once the journey moves to an action step (look left/right, blink)
                // we only require MediaPipe to detect the face — the user's head will
                // naturally drift outside the oval while turning.
                const strict = journey.needsFullFit();
                let outOfPosition = false;

                if (strict) {
                    const fit = isFaceFit(
                        lmBuf,
                        config.indices.FACE_OVAL,
                        hole,
                        displayW, displayH,
                        displayW, displayH,
                        face.bbox,
                        config.fc_ar_thresh
                    );
                    if (fit !== 0) {
                        const msg = fit === 1 ? config.messages.FACE_OUT_OF_FRAME : config.messages.MOVE_CLOSER;
                        hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, msg);
                        journey.reset();
                        outOfPosition = true;
                    }
                }

                // Face attribute check — runs in ALL phases so occlusions can't
                // be sneaked through during the blink/head-turn challenge.
                // During the challenge phase (strict=false) we skip eyes_closed
                // to avoid false positives while the user is mid-blink.
                if (faceAttrChecker) {
                    const attrLabel = faceAttrChecker.check(videoElement, face.landmarks, now);
                    const blocks = attrLabel && (strict || attrLabel !== "eyes_closed");
                    if (blocks) {
                        const msg  = labelToMessage(attrLabel, config.messages);
                        const anim = LABEL_ANIM[attrLabel];
                        hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, msg, anim, now);
                        journey.reset();
                        rafId = requestAnimationFrame(() => tick(isFrontCamera));
                        return;
                    }
                }

                if (!outOfPosition) {
                    const result = journey.tick({ lmBuf, config, now, captureImage, isFrontCamera });

                    if (!result.running) {
                        busy = true;
                        if (rafId) cancelAnimationFrame(rafId);
                        rafId = null;
                        const bbox = { ...face.bbox };
                        const frame = result.frame;
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

                    hole = drawHole(root, videoElement, config, result.color, result.message, result.animation ?? null, now);
                }

                if (config.VIS && visRenderer) {
                    visRenderer.draw(lmBuf, LM_COUNT, face.bbox, displayW, displayH);
                }
            } else {
                hole = drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, config.messages.NO_FACE);
                journey.reset();
                if (config.VIS && visRenderer) visRenderer.clear(displayW, displayH);
            }
        } catch (err) {
            onError(err);
            journey.reset();
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
            faceAttrChecker?.stop();
        },
    };
}
