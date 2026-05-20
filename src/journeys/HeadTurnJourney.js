const STATE = { HOLDING: 0, LOOK_LEFT: 1, LOOK_RIGHT: 2 };

// Raw yaw: (noseTip.x - eyeMid.x) / interEyeDist.
// Negative = user looking left, positive = user looking right.
// We measure *deviation from baseline* so facial asymmetry and
// landmark offset don't trigger false positives at neutral gaze.
function getYaw(lmBuf) {
    const eyeMidX = (lmBuf[33].x + lmBuf[362].x) / 2;
    const interEye = Math.abs(lmBuf[362].x - lmBuf[33].x);
    return interEye < 1 ? 0 : (lmBuf[1].x - eyeMidX) / interEye;
}

export function createHeadTurnJourney(config) {
    const CONFIRM_MS = 350;
    const thresh = config.head_turn_thresh ?? 0.12;

    let state = STATE.HOLDING;
    let stTime = null;
    let capturedFrame = null;
    let turnStart = null;
    let baselineYaw = null;   // neutral yaw captured at end of holding phase

    return {
        reset() {
            state = STATE.HOLDING;
            stTime = null;
            capturedFrame = null;
            turnStart = null;
            baselineYaw = null;
        },

        tick({ lmBuf, config, now, captureImage, isFrontCamera }) {
            if (stTime === null) stTime = now;

            if (state === STATE.HOLDING) {
                if (now - stTime < config.c2bt) {
                    return { running: true, color: config.FACE_COLOR_SUCCESS, message: config.messages.HOLD_STILL };
                }
                if (!capturedFrame) capturedFrame = captureImage(isFrontCamera);
                // Record the neutral yaw so LOOK_LEFT/RIGHT detect deviation
                // from this face's specific geometry, not from absolute zero.
                baselineYaw = getYaw(lmBuf);
                state = STATE.LOOK_LEFT;
                turnStart = null;
                // fall through to LOOK_LEFT
            }

            if (state === STATE.LOOK_LEFT) {
                const yaw = getYaw(lmBuf);
                if (yaw < baselineYaw - thresh) {
                    if (turnStart === null) turnStart = now;
                    if (now - turnStart >= CONFIRM_MS) {
                        state = STATE.LOOK_RIGHT;
                        turnStart = null;
                        // fall through to LOOK_RIGHT
                    }
                } else {
                    turnStart = null;
                }
                if (state === STATE.LOOK_LEFT) {
                    return { running: true, color: config.FACE_COLOR_SUCCESS, message: config.messages.LOOK_LEFT };
                }
            }

            // STATE.LOOK_RIGHT
            const yaw = getYaw(lmBuf);
            if (yaw > baselineYaw + thresh) {
                if (turnStart === null) turnStart = now;
                if (now - turnStart >= CONFIRM_MS) {
                    return { running: false, frame: capturedFrame };
                }
            } else {
                turnStart = null;
            }
            return { running: true, color: config.FACE_COLOR_SUCCESS, message: config.messages.LOOK_RIGHT };
        },
    };
}
