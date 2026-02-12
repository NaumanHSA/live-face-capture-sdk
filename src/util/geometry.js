export function normalized_to_pixel_coordinates(x, y, image_width, image_height) {
  const ok = (v) => v >= 0 && v <= 1;
  if (!ok(x) || !ok(y)) return null;

  const x_px = parseInt(Math.min(Math.floor(x * image_width), image_width - 1));
  const y_px = parseInt(Math.min(Math.floor(y * image_height), image_height - 1));
  return [x_px, y_px];
}

export function getFaceRect(landmarks, canvasWidth, canvasHeight) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x);
    minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x);
    maxY = Math.max(maxY, lm.y);
  }
  const x1 = Math.floor(minX * canvasWidth);
  const y1 = Math.floor(minY * canvasHeight);
  const x2 = Math.floor(maxX * canvasWidth);
  const y2 = Math.floor(maxY * canvasHeight);
  return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}

function isOverflow(points, oval) {
  const [cx, cy, w, h] = oval;
  const a = w / 2;
  const b = h / 2;
  for (const [x, y] of points) {
    const nx = (x - cx) / a;
    const ny = (y - cy) / b;
    if ((nx ** 2 + ny ** 2) > 1) return true;
  }
  return false;
}

export function isFaceFit(landmarks, faceOvalIdx, outerOval, viewW, viewH, imgW, imgH, faceRect, areaThres) {
  let i = 0;
  const ovalPts = [];
  for (const lm of landmarks) {
    if (faceOvalIdx.includes(i)) ovalPts.push([lm.x, lm.y]);
    i++;
  }

  const w = faceRect.width;
  const h = faceRect.height;
  const faceArea = Math.PI * (w / 2) * (h / 2);

  const outside = isOverflow(ovalPts, outerOval);
  const [, , holeW, holeH] = outerOval;
  const holeArea = Math.PI * (holeH / 2) * (holeW / 2);
  const ratio = faceArea / holeArea;

  if (outside) return 1;
  if (ratio < areaThres) return 2;
  return 0;
}
