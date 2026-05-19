import { describe, it, expect } from "vitest";
import { getEAR, createBlinkDetector } from "../src/util/blink.js";

// MediaPipe eye-point indices from defaults.js
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const LEFT_EYE  = [362, 385, 387, 263, 373, 380];

const config = {
  indices: {
    FACEMESH_RIGHT_EYE_POINTS: RIGHT_EYE,
    FACEMESH_LEFT_EYE_POINTS: LEFT_EYE,
  },
  be_thresh: 0.2,
  be_frms: 2,
  be_win: 10,
};

/**
 * Build a minimal landmark buffer (468 slots) with specific eye points set.
 * eye landmark layout: [outer, top1, top2, inner, bot1, bot2]
 * EAR = (dist(top1,bot1) + dist(top2,bot2)) / (2 * dist(outer,inner))
 */
function makeLandmarks(eyeIdx, { h = 10, w = 40 } = {}) {
  const buf = new Array(468).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

  // Right eye — symmetric box: outer/inner separated by w, top/bot by h
  buf[eyeIdx[0]] = { x: 0,  y: 0,  z: 0 }; // outer
  buf[eyeIdx[1]] = { x: 10, y: -h, z: 0 }; // top1
  buf[eyeIdx[2]] = { x: 30, y: -h, z: 0 }; // top2
  buf[eyeIdx[3]] = { x: w,  y: 0,  z: 0 }; // inner
  buf[eyeIdx[4]] = { x: 30, y: h,  z: 0 }; // bot2
  buf[eyeIdx[5]] = { x: 10, y: h,  z: 0 }; // bot1

  return buf;
}

describe("getEAR", () => {
  it("returns a positive value for an open eye", () => {
    const buf = makeLandmarks(RIGHT_EYE, { h: 10, w: 40 });
    // Also set left eye symmetrically
    buf[LEFT_EYE[0]] = { x: 0, y: 0, z: 0 };
    buf[LEFT_EYE[1]] = { x: 10, y: -10, z: 0 };
    buf[LEFT_EYE[2]] = { x: 30, y: -10, z: 0 };
    buf[LEFT_EYE[3]] = { x: 40, y: 0, z: 0 };
    buf[LEFT_EYE[4]] = { x: 30, y: 10, z: 0 };
    buf[LEFT_EYE[5]] = { x: 10, y: 10, z: 0 };

    const ear = getEAR(buf, config);
    expect(ear).toBeGreaterThan(0);
  });

  it("returns near-zero EAR when eye is closed (h=0)", () => {
    const buf = makeLandmarks(RIGHT_EYE, { h: 0, w: 40 });
    buf[LEFT_EYE[0]] = { x: 0, y: 0, z: 0 };
    buf[LEFT_EYE[1]] = { x: 10, y: 0, z: 0 };
    buf[LEFT_EYE[2]] = { x: 30, y: 0, z: 0 };
    buf[LEFT_EYE[3]] = { x: 40, y: 0, z: 0 };
    buf[LEFT_EYE[4]] = { x: 30, y: 0, z: 0 };
    buf[LEFT_EYE[5]] = { x: 10, y: 0, z: 0 };

    const ear = getEAR(buf, config);
    expect(ear).toBe(0);
  });

  it("EAR decreases as eye opening decreases", () => {
    function earAt(h) {
      const b = makeLandmarks(RIGHT_EYE, { h, w: 40 });
      b[LEFT_EYE[0]] = { x: 0,  y: 0, z: 0 };
      b[LEFT_EYE[1]] = { x: 10, y: -h, z: 0 };
      b[LEFT_EYE[2]] = { x: 30, y: -h, z: 0 };
      b[LEFT_EYE[3]] = { x: 40, y: 0, z: 0 };
      b[LEFT_EYE[4]] = { x: 30, y: h, z: 0 };
      b[LEFT_EYE[5]] = { x: 10, y: h, z: 0 };
      return getEAR(b, config);
    }
    expect(earAt(15)).toBeGreaterThan(earAt(5));
  });
});

describe("createBlinkDetector", () => {
  function makeOpenBuf() {
    const buf = makeLandmarks(RIGHT_EYE, { h: 10, w: 40 });
    buf[LEFT_EYE[0]] = { x: 0,  y: 0, z: 0 };
    buf[LEFT_EYE[1]] = { x: 10, y: -10, z: 0 };
    buf[LEFT_EYE[2]] = { x: 30, y: -10, z: 0 };
    buf[LEFT_EYE[3]] = { x: 40, y: 0, z: 0 };
    buf[LEFT_EYE[4]] = { x: 30, y: 10, z: 0 };
    buf[LEFT_EYE[5]] = { x: 10, y: 10, z: 0 };
    return buf;
  }

  function makeClosedBuf() {
    // Both eyes must be flat (h=0) so EAR=0 for both → avg < threshold.
    const buf = makeLandmarks(RIGHT_EYE, { h: 0, w: 40 });
    buf[LEFT_EYE[0]] = { x: 0,  y: 0, z: 0 };
    buf[LEFT_EYE[1]] = { x: 10, y: 0, z: 0 };
    buf[LEFT_EYE[2]] = { x: 30, y: 0, z: 0 };
    buf[LEFT_EYE[3]] = { x: 40, y: 0, z: 0 };
    buf[LEFT_EYE[4]] = { x: 30, y: 0, z: 0 };
    buf[LEFT_EYE[5]] = { x: 10, y: 0, z: 0 };
    return buf;
  }

  it("does not fire on steady open eyes", () => {
    const detect = createBlinkDetector(config);
    const open = makeOpenBuf();
    for (let i = 0; i < 15; i++) expect(detect(open)).toBe(false);
  });

  it("detects a blink after open → closed → open sequence", () => {
    const detect = createBlinkDetector(config);
    const open   = makeOpenBuf();
    const closed = makeClosedBuf();

    // Establish open baseline
    for (let i = 0; i < 4; i++) detect(open);
    // Close
    for (let i = 0; i < 2; i++) detect(closed);
    // Re-open — should trigger
    let fired = false;
    for (let i = 0; i < 4; i++) {
      if (detect(open)) { fired = true; break; }
    }
    expect(fired).toBe(true);
  });
});
