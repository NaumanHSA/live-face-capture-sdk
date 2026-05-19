// Factory that returns a vis renderer backed by an OffscreenCanvas Worker when
// the browser supports it, falling back to synchronous main-thread drawing.

import { drawLandmarksCustom, drawFaceRect } from "./landmarks.js";

function createWorkerRenderer(canvas, workerUrl) {
    let worker = null;
    try {
        const offscreen = canvas.transferControlToOffscreen();
        worker = new Worker(workerUrl);
        worker.postMessage({ type: "init", canvas: offscreen }, [offscreen]);
    } catch {
        return null;
    }

    return {
        draw(lmBuf, lmLen, bbox, W, H) {
            // Flatten landmark x,y pairs into a plain Float32Array so we can
            // transfer the buffer without copying.
            const flat = new Float32Array(lmLen * 2);
            for (let i = 0; i < lmLen; i++) {
                flat[i * 2]     = lmBuf[i].x;
                flat[i * 2 + 1] = lmBuf[i].y;
            }
            worker.postMessage(
                { type: "draw", W, H, landmarks: flat, bbox, radius: 4 },
                [flat.buffer]
            );
        },
        clear(W, H) {
            worker.postMessage({ type: "clear", W, H });
        },
        terminate() {
            worker?.terminate();
            worker = null;
        },
    };
}

function createMainThreadRenderer(canvas) {
    let ctx = null;
    let cachedW = 0;
    let cachedH = 0;

    return {
        draw(lmBuf, lmLen, bbox, W, H) {
            if (W !== cachedW || H !== cachedH) {
                canvas.width = W;
                canvas.height = H;
                ctx = canvas.getContext("2d");
                cachedW = W;
                cachedH = H;
            }
            ctx.clearRect(0, 0, W, H);
            drawLandmarksCustom(ctx, lmBuf, { color: "red", radius: 4 }, null);
            drawFaceRect(ctx, bbox, 5, "yellow");
        },
        clear(W, H) {
            if (ctx) ctx.clearRect(0, 0, W || cachedW, H || cachedH);
        },
        terminate() {},
    };
}

export function createVisRenderer(canvas, workerUrl) {
    const supportsOffscreen =
        typeof OffscreenCanvas !== "undefined" &&
        typeof canvas.transferControlToOffscreen === "function" &&
        !!workerUrl;

    if (supportsOffscreen) {
        const renderer = createWorkerRenderer(canvas, workerUrl);
        if (renderer) return renderer;
    }
    return createMainThreadRenderer(canvas);
}
