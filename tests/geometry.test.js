import { describe, it, expect } from "vitest";
import {
  normalized_to_pixel_coordinates,
  getFaceRect,
  isFaceFit,
} from "../src/util/geometry.js";

describe("normalized_to_pixel_coordinates", () => {
  it("converts center point correctly", () => {
    expect(normalized_to_pixel_coordinates(0.5, 0.5, 100, 200)).toEqual([50, 100]);
  });

  it("clamps to max - 1 at the boundary", () => {
    expect(normalized_to_pixel_coordinates(1, 1, 100, 200)).toEqual([99, 199]);
  });

  it("returns null for out-of-range x", () => {
    expect(normalized_to_pixel_coordinates(-0.1, 0.5, 100, 200)).toBeNull();
    expect(normalized_to_pixel_coordinates(1.1, 0.5, 100, 200)).toBeNull();
  });

  it("returns null for out-of-range y", () => {
    expect(normalized_to_pixel_coordinates(0.5, -0.1, 100, 200)).toBeNull();
    expect(normalized_to_pixel_coordinates(0.5, 1.1, 100, 200)).toBeNull();
  });

  it("handles origin (0, 0)", () => {
    expect(normalized_to_pixel_coordinates(0, 0, 100, 200)).toEqual([0, 0]);
  });
});

describe("getFaceRect", () => {
  it("computes bounding box from normalized landmarks", () => {
    const lms = [
      { x: 0.1, y: 0.2 },
      { x: 0.5, y: 0.8 },
      { x: 0.3, y: 0.4 },
    ];
    const rect = getFaceRect(lms, 100, 100);
    expect(rect.x1).toBe(10);
    expect(rect.y1).toBe(20);
    expect(rect.x2).toBe(50);
    expect(rect.y2).toBe(80);
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(60);
  });

  it("handles a single landmark", () => {
    const lms = [{ x: 0.5, y: 0.5 }];
    const rect = getFaceRect(lms, 200, 200);
    expect(rect.x1).toBe(rect.x2);
    expect(rect.width).toBe(0);
  });
});

describe("isFaceFit", () => {
  // Oval centred at (50,50), 120 wide, 140 tall → a=60, b=70.
  // Large enough that points at ±40px from centre are safely inside.
  const oval = [50, 50, 120, 140];
  const ovalIdx = [0, 1, 2, 3];

  function makeBuf(pts) {
    return pts.map((p) => ({ x: p[0], y: p[1], z: 0 }));
  }

  // These four points are all well inside the oval:
  // [50,10]: nx=0, ny=(-40)/70=0.57 → nx²+ny²=0.32 ✓
  // [10,50]: nx=(-40)/60=0.67, ny=0 → 0.44 ✓
  // [90,50]: nx=(40)/60=0.67       → 0.44 ✓
  // [50,90]: nx=0, ny=(40)/70=0.57 → 0.32 ✓
  const insidePoints = [[50, 10], [10, 50], [90, 50], [50, 90]];

  // hole area = π*60*70 ≈ 13195
  // bigFaceRect area = π*40*50 ≈ 6283  → ratio ≈ 0.48 > 0.4 threshold → fit=0
  const bigFaceRect   = { x1: 10, y1: 0,  x2: 90,  y2: 100, width: 80, height: 100 };
  // smallFaceRect area = π*5*5 ≈ 79    → ratio ≈ 0.006 << 0.4 → fit=2
  const smallFaceRect = { x1: 45, y1: 45, x2: 55, y2: 55,  width: 10, height: 10 };

  it("returns 0 when face is inside oval and large enough", () => {
    const lms = makeBuf(insidePoints);
    const result = isFaceFit(lms, ovalIdx, oval, 100, 100, 100, 100, bigFaceRect, 0.4);
    expect(result).toBe(0);
  });

  it("returns 1 when face oval points overflow the guide oval", () => {
    // Corners of the 100×100 frame — all outside the oval
    const lms = makeBuf([[0, 0], [100, 0], [0, 100], [100, 100]]);
    const result = isFaceFit(lms, ovalIdx, oval, 100, 100, 100, 100, bigFaceRect, 0.4);
    expect(result).toBe(1);
  });

  it("returns 2 when face area ratio is below threshold", () => {
    const lms = makeBuf(insidePoints);
    const result = isFaceFit(lms, ovalIdx, oval, 100, 100, 100, 100, smallFaceRect, 0.4);
    expect(result).toBe(2);
  });
});
