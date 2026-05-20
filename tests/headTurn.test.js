import { describe, it, expect } from "vitest";
import { createHeadTurnJourney } from "../src/journeys/HeadTurnJourney.js";
import { createBlinkJourney } from "../src/journeys/BlinkJourney.js";
import { selectJourney } from "../src/journeys/index.js";

// Minimal config matching the merged config shape
const config = {
    c2bt: 1000,
    head_turn_thresh: 0.12,
    FACE_COLOR_SUCCESS: "#32CD32",
    FACE_COLOR_FAIL: "#FF5733",
    messages: {
        HOLD_STILL: "Hold still...",
        LOOK_LEFT: "Look left",
        LOOK_RIGHT: "Look right",
        BLINK_NOW: "Blink now!",
        OPEN_EYES: "Open your eyes",
    },
    indices: {
        FACEMESH_RIGHT_EYE_POINTS: [33, 160, 158, 133, 153, 144],
        FACEMESH_LEFT_EYE_POINTS: [362, 385, 387, 263, 373, 380],
    },
    be_thresh: 0.2,
    be_frms: 2,
    be_win: 10,
    jpeg_quality: 0.92,
    journey: "head_turn",
};

// Build a landmark buffer with the three key points:
// lmBuf[1]   = nose tip (index 1)
// lmBuf[33]  = right eye outer corner
// lmBuf[362] = left eye outer corner
function makeLmBuf({ noseTipX = 200, eyeLeft = 150, eyeRight = 250 } = {}) {
    const buf = new Array(478).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    buf[1].x = noseTipX;
    buf[33].x = eyeRight;   // right eye (larger x on screen)
    buf[362].x = eyeLeft;   // left eye (smaller x on screen)
    return buf;
}

// Fake captureImage — returns a sentinel string
const fakeCapture = () => "data:image/jpeg;base64,FAKE";

function tickCtx(lmBuf, now, overrides = {}) {
    return { lmBuf, config, now, captureImage: fakeCapture, isFrontCamera: false, ...overrides };
}

describe("createHeadTurnJourney", () => {
    it("shows HOLD_STILL during the holding phase", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        const r = journey.tick(tickCtx(lm, 0));
        expect(r.running).toBe(true);
        expect(r.message).toBe(config.messages.HOLD_STILL);
    });

    it("transitions to LOOK_LEFT after c2bt ms", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        // First tick initialises stTime=0
        journey.tick(tickCtx(lm, 0));
        // Tick past c2bt
        const r = journey.tick(tickCtx(lm, config.c2bt + 1));
        expect(r.running).toBe(true);
        expect(r.message).toBe(config.messages.LOOK_LEFT);
    });

    it("stays in LOOK_LEFT until yaw threshold is held for 350 ms", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        // Advance past holding phase
        journey.tick(tickCtx(lm, config.c2bt + 1));

        // Turn left: nose tip moves to x=100, eyeMid=(150+250)/2=200 → yaw=(100-200)/100=-1 (well below -0.12)
        const lmLeft = makeLmBuf({ noseTipX: 100, eyeLeft: 150, eyeRight: 250 });

        // Hold for 300 ms (below the 350 ms confirm window) — should not transition
        const r1 = journey.tick(tickCtx(lmLeft, config.c2bt + 50));
        expect(r1.message).toBe(config.messages.LOOK_LEFT);
        const r2 = journey.tick(tickCtx(lmLeft, config.c2bt + 300));
        expect(r2.message).toBe(config.messages.LOOK_LEFT);
    });

    it("transitions to LOOK_RIGHT after LOOK_LEFT is confirmed for 350 ms", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        journey.tick(tickCtx(lm, config.c2bt + 1));

        // Sustained left turn for > 350 ms
        const lmLeft = makeLmBuf({ noseTipX: 100, eyeLeft: 150, eyeRight: 250 });
        journey.tick(tickCtx(lmLeft, config.c2bt + 50));   // turnStart set here
        const r = journey.tick(tickCtx(lmLeft, config.c2bt + 450)); // +400 ms ≥ 350 ms
        expect(r.message).toBe(config.messages.LOOK_RIGHT);
    });

    it("completes when LOOK_RIGHT is held for 350 ms and returns captured frame", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        journey.tick(tickCtx(lm, config.c2bt + 1));

        // Confirm LOOK_LEFT
        const lmLeft = makeLmBuf({ noseTipX: 100, eyeLeft: 150, eyeRight: 250 });
        journey.tick(tickCtx(lmLeft, config.c2bt + 50));
        journey.tick(tickCtx(lmLeft, config.c2bt + 450));

        // Confirm LOOK_RIGHT: nose tip moves to x=300, eyeMid=200 → yaw=(300-200)/100=1 > 0.12
        const lmRight = makeLmBuf({ noseTipX: 300, eyeLeft: 150, eyeRight: 250 });
        journey.tick(tickCtx(lmRight, config.c2bt + 500));  // turnStart set
        const r = journey.tick(tickCtx(lmRight, config.c2bt + 900));  // +400 ms ≥ 350 ms
        expect(r.running).toBe(false);
        expect(r.frame).toBe("data:image/jpeg;base64,FAKE");
    });

    it("resets to HOLDING state on reset()", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        journey.tick(tickCtx(lm, config.c2bt + 1)); // → LOOK_LEFT

        journey.reset();

        // After reset, should be back in HOLD_STILL
        const r = journey.tick(tickCtx(lm, config.c2bt + 100));
        expect(r.message).toBe(config.messages.HOLD_STILL);
    });

    it("resets turn timer when yaw drops below threshold mid-turn", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        journey.tick(tickCtx(lm, config.c2bt + 1));

        // Start turning left
        const lmLeft = makeLmBuf({ noseTipX: 100, eyeLeft: 150, eyeRight: 250 });
        journey.tick(tickCtx(lmLeft, config.c2bt + 50));

        // Look back to center — interrupts the turn
        journey.tick(tickCtx(lm, config.c2bt + 200));

        // Resume left turn — timer restarts; only 200 ms total, not 350
        journey.tick(tickCtx(lmLeft, config.c2bt + 300));
        const r = journey.tick(tickCtx(lmLeft, config.c2bt + 450));
        // Should still be in LOOK_LEFT (only 150 ms since resume, not 350 ms)
        expect(r.message).toBe(config.messages.LOOK_LEFT);
    });
});

describe("needsFullFit", () => {
    it("HeadTurnJourney requires strict fit only during HOLDING", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        expect(journey.needsFullFit()).toBe(true);        // HOLDING
        journey.tick(tickCtx(lm, 0));
        expect(journey.needsFullFit()).toBe(true);        // still HOLDING
        journey.tick(tickCtx(lm, config.c2bt + 1));      // → LOOK_LEFT
        expect(journey.needsFullFit()).toBe(false);       // relaxed
    });

    it("HeadTurnJourney reverts to strict fit after reset", () => {
        const journey = createHeadTurnJourney(config);
        const lm = makeLmBuf();
        journey.tick(tickCtx(lm, 0));
        journey.tick(tickCtx(lm, config.c2bt + 1));      // → LOOK_LEFT
        expect(journey.needsFullFit()).toBe(false);
        journey.reset();
        expect(journey.needsFullFit()).toBe(true);        // back to strict
    });

    it("BlinkJourney requires strict fit until frame is captured", () => {
        const journey = createBlinkJourney(config);
        expect(journey.needsFullFit()).toBe(true);        // no frame yet
    });
});

describe("selectJourney", () => {
    it("returns a BlinkJourney for journey='blink'", () => {
        const blinkConfig = { ...config, journey: "blink" };
        const j = selectJourney(blinkConfig);
        expect(typeof j.tick).toBe("function");
        expect(typeof j.reset).toBe("function");
    });

    it("returns a HeadTurnJourney for journey='head_turn'", () => {
        const j = selectJourney(config);
        // HeadTurnJourney starts in HOLD_STILL
        const lm = makeLmBuf();
        const r = j.tick(tickCtx(lm, 0));
        expect(r.message).toBe(config.messages.HOLD_STILL);
    });

    it("falls back to blink for unknown journey name", () => {
        const badConfig = { ...config, journey: "laser_eyes" };
        const j = selectJourney(badConfig);
        expect(typeof j.tick).toBe("function");
    });

    it("returns a journey for journey='random'", () => {
        const randomConfig = { ...config, journey: "random" };
        const j = selectJourney(randomConfig);
        expect(typeof j.tick).toBe("function");
    });
});
