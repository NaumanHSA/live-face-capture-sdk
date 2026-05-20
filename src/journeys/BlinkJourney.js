import { getEAR, createBlinkDetector } from "../util/blink.js";

export function createBlinkJourney(config) {
    let blinkDetector = createBlinkDetector(config);
    let stTime = null;
    let capturedFrame = null;

    return {
        reset() {
            stTime = null;
            capturedFrame = null;
            blinkDetector = createBlinkDetector(config);
        },

        tick({ lmBuf, config, now, captureImage, isFrontCamera }) {
            if (stTime === null) stTime = now;
            const elapsed = now - stTime;

            if (!capturedFrame) {
                if (elapsed < config.c2bt) {
                    return { running: true, color: config.FACE_COLOR_SUCCESS, message: config.messages.HOLD_STILL };
                }
                const ear = getEAR(lmBuf, config);
                if (ear < 0.25) {
                    return { running: true, color: config.FACE_COLOR_FAIL, message: config.messages.OPEN_EYES };
                }
                capturedFrame = captureImage(isFrontCamera);
            }

            if (blinkDetector(lmBuf)) {
                return { running: false, frame: capturedFrame };
            }
            return { running: true, color: config.FACE_COLOR_SUCCESS, message: config.messages.BLINK_NOW };
        },
    };
}
