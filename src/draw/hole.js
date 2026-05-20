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

// ── Face PNG — embedded as base64, tinted white at first use ─────────────────

const _FACE_B64 =
  "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";

let _faceImg = null;
let _faceTinted = null;
let _faceTintedSz = 0;

function _loadFaceImg() {
  if (_faceImg) return _faceImg;
  _faceImg = new Image();
  _faceImg.src = `data:image/png;base64,${_FACE_B64}`;
  return _faceImg;
}

// Returns a canvas with the face icon tinted white, cached by pixel size.
function _getFaceTinted(sz) {
  const s = Math.round(sz);
  if (_faceTinted && _faceTintedSz === s) return _faceTinted;

  const img = _loadFaceImg();
  if (!img.complete || !img.naturalWidth) return null;

  const off = document.createElement("canvas");
  off.width = s; off.height = s;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0, s, s);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = "rgba(255,255,255,0.92)";
  octx.fillRect(0, 0, s, s);

  _faceTinted = off;
  _faceTintedSz = s;
  return off;
}

// Preload the image as soon as this module is imported.
_loadFaceImg();

// ── Animation icons ───────────────────────────────────────────────────────────

function drawBlinkIcon(ctx, now, cx, cy, size) {
  const CYCLE = 2200;
  const t = (now % CYCLE) / CYCLE;

  // Hold open → snap closed → snap open → hold open
  let openness;
  if      (t < 0.40) openness = 1;
  else if (t < 0.48) openness = 1 - (t - 0.40) / 0.08;  // closing
  else if (t < 0.56) openness = (t - 0.48) / 0.08;       // opening
  else               openness = 1;
  openness = Math.max(openness, 0);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = Math.max(1.5, size * 0.07);
  ctx.lineCap     = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur  = 5;

  const sep   = size * 0.34;  // distance between eye centres
  const rx    = size * 0.24;  // half eye width
  const ryMax = size * 0.16;  // max eye height (fully open)

  for (const ex of [cx - sep, cx + sep]) {
    if (openness < 0.05) {
      // Fully closed — single horizontal stroke
      ctx.beginPath();
      ctx.moveTo(ex - rx, cy);
      ctx.lineTo(ex + rx, cy);
      ctx.stroke();
    } else {
      const curveUp   = ryMax * openness;
      const curveDown = ryMax * 0.38 * openness; // lower lid is shallower

      // Almond-shaped eye: upper lid arcs up, lower lid arcs down
      ctx.beginPath();
      ctx.moveTo(ex - rx, cy);
      ctx.quadraticCurveTo(ex, cy - curveUp,   ex + rx, cy);
      ctx.quadraticCurveTo(ex, cy + curveDown, ex - rx, cy);
      ctx.closePath();
      ctx.stroke();

      // Iris — fades in as the eye opens, sits slightly under the upper lid
      if (openness > 0.35) {
        const irisAlpha = Math.min(1, (openness - 0.35) / 0.45);
        const irisR     = Math.min(curveUp, curveUp + curveDown) * 0.44;
        const irisY     = cy - curveUp * 0.18;
        ctx.save();
        ctx.globalAlpha = irisAlpha * 0.85;
        ctx.beginPath();
        ctx.arc(ex, irisY, irisR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function drawLookIcon(ctx, now, cx, cy, size, dir) {
  const CYCLE = 900;
  const phase = Math.sin((now % CYCLE) / CYCLE * Math.PI); // 0 → 1 → 0

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth   = Math.max(1.5, size * 0.07);
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur  = 5;

  // Face PNG (white-tinted) — falls back to a circle if image not yet ready
  const faceSz  = size * 1.2;
  const tinted  = _getFaceTinted(faceSz);
  if (tinted) {
    ctx.drawImage(tinted, cx - faceSz / 2, cy - faceSz / 2, faceSz, faceSz);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Two chevrons that pulse in `dir`, positioned just past the face edge
  const faceEdge = faceSz / 2;
  const drift    = size * 0.06 * phase;
  const base     = cx + dir * (faceEdge + size * 0.12 + drift);
  const step     = size * 0.22;
  const arm      = size * 0.18;

  for (let i = 0; i < 2; i++) {
    const ax    = base + dir * i * step;
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

  // Skip redraw when nothing changed — animated frames always redraw.
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

  // ── 3. Gradient shade inside the oval (top → centre, fades to clear) ──────
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

  // ── 5 & 6. Icon + text — both in the shade zone (top of oval) ────────────
  //
  //   ↓ top of oval
  //   ● icon centre      ← centerY - ovalHeight * 0.34
  //   ↓ gap
  //   — text             ← icon bottom + gap  (or centred in shade if no icon)
  //   ─── oval centre (gradient → 0)
  //   [ clear camera feed ]
  //
  const iconSize = ovalHeight * 0.12;
  const iconY    = centerY - ovalHeight * 0.34;

  if (animation) {
    if      (animation === "blink")      drawBlinkIcon(ctx, now, centerX, iconY, iconSize);
    else if (animation === "look_left")  drawLookIcon (ctx, now, centerX, iconY, iconSize, -1);
    else if (animation === "look_right") drawLookIcon (ctx, now, centerX, iconY, iconSize,  1);
  }

  if (message) {
    const textY = animation
      ? iconY + iconSize * 0.55 + ovalHeight * 0.055
      : centerY - ovalHeight * 0.24;

    const maxWidth = ovalWidth * 0.82;
    let fontSize   = config.FONT_SIZE || Math.max(11, Math.round(H * 0.024));
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.font         = `600 ${fontSize}px Arial, sans-serif`;

    const measured = ctx.measureText(message).width;
    if (measured > maxWidth) {
      fontSize = Math.max(10, Math.floor(fontSize * maxWidth / measured));
      ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    }

    ctx.shadowColor = "rgba(0,0,0,0.70)";
    ctx.shadowBlur  = 7;
    ctx.fillStyle   = "#ffffff";
    ctx.globalAlpha = 1;
    ctx.fillText(message, centerX, textY);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";
  }

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
