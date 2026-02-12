function distance(p1, p2) {
  return Math.sqrt(((p1.x - p2.x) ** 2) + ((p1.y - p2.y) ** 2));
}

function calculateEAR(landmarks, idx) {
  const v1 = distance(landmarks[idx[1]], landmarks[idx[5]]);
  const v2 = distance(landmarks[idx[2]], landmarks[idx[4]]);
  const h = distance(landmarks[idx[0]], landmarks[idx[3]]);
  return (v1 + v2) / (2 * h);
}

export function getEAR(landmarks, config) {
  const r = calculateEAR(landmarks, config.indices.FACEMESH_RIGHT_EYE_POINTS);
  const l = calculateEAR(landmarks, config.indices.FACEMESH_LEFT_EYE_POINTS);
  return (r + l) / 2;
}

export function createBlinkDetector(config) {
  const earBuffer = [];

  return function detectEyesBlinkTemporal(landmarks) {
    const r = calculateEAR(landmarks, config.indices.FACEMESH_RIGHT_EYE_POINTS);
    const l = calculateEAR(landmarks, config.indices.FACEMESH_LEFT_EYE_POINTS);
    const avg = (r + l) / 2;

    earBuffer.push(avg);
    const WINDOW_SIZE = config.be_win || 10;
    if (earBuffer.length > WINDOW_SIZE) earBuffer.shift();

    const BLINK_THRESHOLD = config.be_thresh;
    const MIN_CLOSED = config.be_frms || 2;
    const MIN_OPEN = config.OPEN_FRAMES_THRESHOLD || 2;

    let openBefore = 0;
    let closed = 0;
    let openAfter = 0;

    for (const v of earBuffer) {
      if (v < BLINK_THRESHOLD) {
        closed++;
        if (closed > 3 * MIN_CLOSED) closed = 0;
        if (openBefore >= MIN_OPEN) openAfter = 0;
      } else {
        if (openBefore >= MIN_OPEN && closed >= MIN_CLOSED) {
          openAfter++;
          if (openAfter >= MIN_OPEN) return true;
        } else {
          openBefore++;
          closed = 0;
        }
      }
    }
    return false;
  };
}
