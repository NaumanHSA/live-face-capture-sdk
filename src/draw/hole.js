let _lastColor = null;
let _lastMessage = null;
let _lastW = 0;
let _lastH = 0;
let _lastOval = null;

export function drawHole(root, videoElement, config, borderColor, message) {
  const W = videoElement.videoWidth;
  const H = videoElement.videoHeight;

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

  ctx.fillStyle = config.DOC_COLOR;
  ctx.globalAlpha = config.DOC_OPACITY;
  ctx.fillRect(0, 0, W, H);

  const ovalHeight = H * config.HOLE_HEIGHT;
  const ovalWidth = ovalHeight * config.HOLE_WIDTH;
  const centerX = W / 2;
  const centerY = H / 2;

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.stroke();

  const fontSize = config.FONT_SIZE || Math.round(H * 0.03);
  ctx.fillStyle = borderColor;
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.globalAlpha = 1;
  ctx.fillText(message, W / 2, H * 0.05);

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
