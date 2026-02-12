import { normalized_to_pixel_coordinates, getFaceRect, isFaceFit } from "../util/geometry.js";
import { drawLandmarksCustom, drawFaceRect } from "../draw/landmarks.js";
import { drawHole } from "../draw/hole.js";
import { getEAR } from "../util/blink.js";

export function createLivenessLoop(ctx) {
    const {
        root,
        videoElement,
        canvasElement,
        config,
        faceLandmarker,
        blinkDetector,
        encryptFrame, // function or null
        onCapture,
        onError,
    } = ctx;

    let lastVideoTime = -1;
    let stTime = null;
    let capturedImage = null;
    let hole = null;

    let rafId = null;
    let lastInferMs = 0;
    let busy = false;
    const minMs = Math.max(10, Math.floor(1000 / (config.inferenceFps || 20)));

    function captureImage(isFrontCamera) {
        const canvas = document.createElement("canvas");
        const g = canvas.getContext("2d");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        let width = canvas.width;
        if (isFrontCamera) {
            g.scale(-1, 1);
            width *= -1;
        }
        g.drawImage(videoElement, 0, 0, width, canvas.height);
        return canvas.toDataURL("image/png");
    }

    async function tick(isFrontCamera) {
        if (busy) {
            rafId = requestAnimationFrame(() => tick(isFrontCamera));
            return;
        }

        try {
            const now = performance.now();
            if (now - lastInferMs < minMs) {
                rafId = window.requestAnimationFrame(() => tick(isFrontCamera));
                return;
            }
            lastInferMs = now;

            const startTimeMs = now;
            if (lastVideoTime !== videoElement.currentTime) {
                lastVideoTime = videoElement.currentTime;
            }

            const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);

            const W = videoElement.videoWidth;
            const H = videoElement.videoHeight;

            canvasElement.width = W;
            canvasElement.height = H;
            const canvasCtx = canvasElement.getContext("2d");
            canvasCtx.clearRect(0, 0, W, H);

            if (stTime == null) stTime = new Date();

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                if (!config.multi_fces && results.faceLandmarks.length > 1) {
                    hole = await drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "MULTIPLE FACES DETECTED!");
                    stTime = new Date();
                    capturedImage = null;
                    rafId = window.requestAnimationFrame(() => tick(isFrontCamera));
                    return;
                }

                // largest face
                const face = results.faceLandmarks.reduce((largest, lm) => {
                    const bbox = getFaceRect(lm, W, H);
                    const area = bbox.width * bbox.height;
                    if (!largest || area > largest.area) return { landmarks: lm, bbox, area };
                    return largest;
                }, null);

                const landmarks = [];
                for (const p of face.landmarks) {
                    const px = normalized_to_pixel_coordinates(p.x, p.y, W, H);
                    if (!px) continue;
                    landmarks.push({
                        x: isFrontCamera ? (W - px[0]) : px[0],
                        y: px[1],
                        z: p.z,
                    });
                }
                if (isFrontCamera) {
                    const x1 = face.bbox.x1;
                    const x2 = face.bbox.x2;
                    face.bbox.x1 = W - x2;
                    face.bbox.x2 = W - x1;
                }

                // initial hole if missing
                if (!hole) hole = await drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "");

                const fit = isFaceFit(
                    landmarks,
                    config.indices.FACE_OVAL,
                    hole,
                    videoElement.offsetWidth,
                    videoElement.offsetHeight,
                    W, H,
                    face.bbox,
                    config.fc_ar_thresh
                );

                if (fit !== 0) {
                    const msg = (fit === 1) ? "FACE OUT OF RANGE" : "FACE TOO FAR FROM THE CAMERA";
                    hole = await drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, msg);
                    stTime = new Date();
                    capturedImage = null;
                } else {
                    hole = await drawHole(root, videoElement, config, config.FACE_COLOR_SUCESS, "EVERYTHING's GOOD. STAY STILL!");
                    const ms = (new Date().getTime() - stTime.getTime());
                    if (ms >= config.c2bt) {
                        if (!capturedImage) {
                            const ear = getEAR(landmarks, config);
                            if (ear >= 0.25) capturedImage = captureImage(isFrontCamera);
                            else hole = await drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "LOOK STRAIGHT AND OPEN YOUR EYES PLEASE.");
                        } else {
                            hole = await drawHole(root, videoElement, config, config.FACE_COLOR_SUCESS, "PLEASE BLINK YOUR EYES NOW!");

                            if (blinkDetector(landmarks)) {
                                busy = true;
                                if (rafId) cancelAnimationFrame(rafId);
                                rafId = null;
                                const bbox = { ...face.bbox };
                                const frame = capturedImage;
                                queueMicrotask(() => {
                                    (async () => {
                                        try {
                                            const best = (config.encrypt && encryptFrame) ? await encryptFrame(frame) : frame;
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

                if (config.VIS) {
                    drawLandmarksCustom(canvasCtx, landmarks, { color: "red", raduis: 4 }, null);
                    drawFaceRect(canvasCtx, face.bbox, 5, "yellow");
                }
            } else {
                hole = await drawHole(root, videoElement, config, config.FACE_COLOR_FAIL, "FACE OUT OF RANGE");
                stTime = new Date();
                capturedImage = null;
            }
        } catch (err) {
            onError(err);
            stTime = new Date();
            capturedImage = null;
        }

        rafId = window.requestAnimationFrame(() => tick(isFrontCamera));
    }

    return {
        start: (isFrontCamera) => {
            rafId = window.requestAnimationFrame(() => tick(isFrontCamera));
        },
        stop: () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
        },
    };
}
