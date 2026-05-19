let _lastColor = null;
let _lastMessage = null;
let _lastW = 0;
let _lastH = 0;
let _lastOval = null;

// Convert any CSS color string to rgba(r,g,b,alpha).
// Handles #RRGGBB, #RGB, rgb(), rgba().
function withAlpha(color, alpha) {
  let m = color.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  m = color.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const r = parseInt(m[1][0] + m[1][0], 16);
    const g = parseInt(m[1][1] + m[1][1], 16);
    const b = parseInt(m[1][2] + m[1][2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  return color;
}

export function drawHole(root, videoElement, config, borderColor, message) {
  // Use CSS display dimensions so the canvas pixel space matches 1:1 with
  // what is rendered — avoids oval distortion when camera and container
  // aspect ratios differ.
  const W = videoElement.offsetWidth || videoElement.videoWidth;
  const H = videoElement.offsetHeight || videoElement.videoHeight;

  if (
    _lastColor === borderColor &&
    _lastMessage === message &&
    _lastW === W &&
    _lastH === H &&
    _lastOval !== null
  ) {
    return _lastOval;
  }

  const canvas = root.querySelector('[data-lfc="holeCanvas"]');

  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext("2d");

  // Always start clean — without this, each semi-transparent fillRect
  // stacks on previous pixels and the overlay becomes fully opaque.
  ctx.clearRect(0, 0, W, H);

  // ── 1. Semi-transparent overlay outside the oval ─────────────────────────
  ctx.fillStyle = config.DOC_COLOR;
  ctx.globalAlpha = config.DOC_OPACITY;
  ctx.fillRect(0, 0, W, H);

  const ovalHeight = H * config.HOLE_HEIGHT;
  // Cap width so the oval never bleeds to screen edges on portrait mobile.
  const ovalWidth = Math.min(ovalHeight * config.HOLE_WIDTH, W * 0.82);
  const centerX = W / 2;
  const centerY = H / 2;

  // ── 2. Cut the oval hole (makes it fully transparent) ────────────────────
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.fill();

  // ── 3. Gradient shade inside the oval (top → center, fades to clear) ─────
  // Clip drawing to the oval interior so the gradient stays inside.
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.clip();

  const gradTop    = centerY - ovalHeight / 2;  // very top of oval
  const gradBottom = centerY;                   // center — fully transparent here

  const grad = ctx.createLinearGradient(centerX, gradTop, centerX, gradBottom);
  grad.addColorStop(0,   withAlpha(borderColor, 0.55)); // strong shade at top
  grad.addColorStop(0.6, withAlpha(borderColor, 0.15)); // fading quickly
  grad.addColorStop(1,   withAlpha(borderColor, 0));    // fully transparent at center

  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(centerX - ovalWidth / 2, gradTop, ovalWidth, gradBottom - gradTop);

  ctx.restore(); // remove oval clip

  // ── 4. Thin oval border ───────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = withAlpha(borderColor, 0.75);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ── 5. Instruction message — centered just below the gradient zone ────────
  const fontSize = config.FONT_SIZE || Math.round(H * 0.028);
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textY = centerY + ovalHeight * 0.25; // lower quarter of oval, on clear camera

  // Dark shadow so text is readable over any camera background
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 1;
  ctx.fillText(message, centerX, textY);

  // Reset shadow so it doesn't bleed into other draws
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  _lastColor = borderColor;
  _lastMessage = message;
  _lastW = W;
  _lastH = H;
  _lastOval = [centerX, centerY, ovalWidth, ovalHeight];
  return _lastOval;
}

export function resetHoleDirtyState() {
  _lastColor = null;
  _lastMessage = null;
  _lastW = 0;
  _lastH = 0;
  _lastOval = null;
}
