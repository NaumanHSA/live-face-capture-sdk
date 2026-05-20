let _lastColor = null;
let _lastMessage = null;
let _lastW = 0;
let _lastH = 0;
let _lastOval = null;

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

// ── Animation icons (white strokes, drawn in the gradient zone) ───────────────

function drawBlinkIcon(ctx, now, cx, cy, size) {
  const CYCLE = 2200;
  const t = (now % CYCLE) / CYCLE;

  // Blink at t≈0.5: close quickly, open quickly, hold open the rest of the cycle
  let openness;
  if      (t < 0.40) openness = 1;
  else if (t < 0.48) openness = 1 - (t - 0.40) / 0.08;  // closing
  else if (t < 0.56) openness = (t - 0.48) / 0.08;       // opening
  else               openness = 1;
  openness = Math.max(openness, 0);

  const sep = size * 0.34;
  const rx  = size * 0.22;
  const ry  = Math.max(size * 0.14 * openness, size * 0.006);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = Math.max(1.5, size * 0.07);
  ctx.lineCap     = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur  = 5;

  for (const ex of [cx - sep, cx + sep]) {
    ctx.beginPath();
    if (openness < 0.08) {
      ctx.moveTo(ex - rx, cy);
      ctx.lineTo(ex + rx, cy);
    } else {
      ctx.ellipse(ex, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLookIcon(ctx, now, cx, cy, size, dir) {
  // Smooth pulse: chevrons slide slightly toward `dir` and fade back
  const CYCLE = 900;
  const phase = Math.sin((now % CYCLE) / CYCLE * Math.PI); // 0 → 1 → 0

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = Math.max(1.5, size * 0.07);
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur  = 5;

  // Face circle
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  // Two chevrons that drift in `dir` on each pulse
  const drift = size * 0.06 * phase;
  const base  = cx + dir * (size * 0.58 + drift);
  const step  = size * 0.22;
  const arm   = size * 0.18;

  for (let i = 0; i < 2; i++) {
    const ax    = base + dir * i * step;
    // Stagger opacity so they feel like they're "chasing" each other
    const alpha = i === 0 ? 0.55 + 0.45 * phase : 1 - 0.45 * phase;
    ctx.globalAlpha = Math.max(0.2, alpha);
    ctx.beginPath();
    ctx.moveTo(ax - dir * arm * 0.55, cy - arm);
    ctx.lineTo(ax + dir * arm * 0.55, cy);
    ctx.lineTo(ax - dir * arm * 0.55, cy + arm);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function drawHole(root, videoElement, config, borderColor, message, animation = null, now = 0) {
  const W = videoElement.offsetWidth || videoElement.videoWidth;
  const H = videoElement.offsetHeight || videoElement.videoHeight;

  // Skip redraw when nothing changed — but animated frames always redraw.
  if (
    animation === null &&
    _lastColor === borderColor &&
    _lastMessage === message &&
    _lastW === W &&
    _lastH === H &&
    _lastOval !== null
  ) {
    return _lastOval;
  }

  const canvas = root.querySelector('[data-lfc="holeCanvas"]');
  if (canvas.width  !== W) canvas.width  = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // ── 1. Semi-transparent overlay ────────────────────────────────────────────
  ctx.fillStyle  = config.DOC_COLOR;
  ctx.globalAlpha = config.DOC_OPACITY;
  ctx.fillRect(0, 0, W, H);

  const ovalHeight = H * config.HOLE_HEIGHT;
  const ovalWidth  = Math.min(ovalHeight * config.HOLE_WIDTH, W * 0.82);
  const centerX    = W / 2;
  const centerY    = H / 2;
  const oval       = [centerX, centerY, ovalWidth, ovalHeight];

  // ── 2. Cut the oval hole ───────────────────────────────────────────────────
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.fill();

  // ── 3. Gradient shade inside the oval (top → center, fades to clear) ──────
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.clip();

  const gradTop    = centerY - ovalHeight / 2;
  const gradBottom = centerY;
  const grad = ctx.createLinearGradient(centerX, gradTop, centerX, gradBottom);
  grad.addColorStop(0,   withAlpha(borderColor, 0.55));
  grad.addColorStop(0.6, withAlpha(borderColor, 0.15));
  grad.addColorStop(1,   withAlpha(borderColor, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle   = grad;
  ctx.fillRect(centerX - ovalWidth / 2, gradTop, ovalWidth, gradBottom - gradTop);

  ctx.restore();

  // ── 4. Thin oval border ────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = withAlpha(borderColor, 0.75);
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // ── 5. Animation icon in the gradient zone (upper oval) ───────────────────
  if (animation) {
    const iconSize = ovalHeight * 0.17;
    const iconY    = centerY - ovalHeight * 0.24;
    if      (animation === "blink")      drawBlinkIcon(ctx, now, centerX, iconY, iconSize);
    else if (animation === "look_left")  drawLookIcon (ctx, now, centerX, iconY, iconSize, -1);
    else if (animation === "look_right") drawLookIcon (ctx, now, centerX, iconY, iconSize,  1);
  }

  // ── 6. Instruction text — auto-scaled to fit oval width ───────────────────
  const maxWidth = ovalWidth * 0.82;
  let fontSize   = config.FONT_SIZE || Math.max(11, Math.round(H * 0.024));
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = `600 ${fontSize}px Arial, sans-serif`;

  if (message) {
    const measured = ctx.measureText(message).width;
    if (measured > maxWidth) {
      fontSize = Math.max(10, Math.floor(fontSize * maxWidth / measured));
      ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    }

    const textY = centerY + ovalHeight * 0.30;
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = "#ffffff";
    ctx.globalAlpha = 1;
    ctx.fillText(message, centerX, textY);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";
  }

  // Only update the cache for static (non-animated) frames so the dirty
  // check still skips redraws when nothing has changed.
  if (animation === null) {
    _lastColor   = borderColor;
    _lastMessage = message;
    _lastW       = W;
    _lastH       = H;
    _lastOval    = oval;
  }
  return oval;
}

export function resetHoleDirtyState() {
  _lastColor   = null;
  _lastMessage = null;
  _lastW       = 0;
  _lastH       = 0;
  _lastOval    = null;
}
