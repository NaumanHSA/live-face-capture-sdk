export function drawLandmarksCustom(ctx, landmarks, style, indices = null) {
  ctx.fillStyle = style.color;
  let idx = 0;
  for (const lm of landmarks) {
    if (!indices || indices.includes(idx)) {
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, style.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
    idx += 1;
  }
}

function drawLine(ctx, x1, y1, x2, y2, thickness, color) {
  ctx.beginPath();
  ctx.setLineDash([15, 15]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = thickness;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function drawFaceRect(ctx, rect, thickness, color) {
  drawLine(ctx, rect.x1, rect.y1, rect.x2, rect.y1, thickness, color);
  drawLine(ctx, rect.x2, rect.y1, rect.x2, rect.y2, thickness, color);
  drawLine(ctx, rect.x2, rect.y2, rect.x1, rect.y2, thickness, color);
  drawLine(ctx, rect.x1, rect.y2, rect.x1, rect.y1, thickness, color);
}
