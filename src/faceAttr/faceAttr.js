// Main-thread manager for face attribute detection.
// Creates a Web Worker (face-attr-worker.js) that runs ONNX inference off-thread.
//
// Attribute priority (checked in order, first match wins):
//   face_mask → sunglasses → eyeglasses → eyes_closed

const INFER_SIZE = 128;

// Map label → message key (matches messages_default in defaults.js)
const LABEL_MSG = {
  face_mask:   "FACE_MASK",
  sunglasses:  "SUNGLASSES",
  eyeglasses:  "EYEGLASSES",
  eyes_closed: "EYES_CLOSED",
};

// Map label → hole animation name (matches drawHole dispatch in hole.js)
export const LABEL_ANIM = {
  face_mask:   "attr_face_mask",
  sunglasses:  "attr_sunglasses",
  eyeglasses:  "attr_eyeglasses",
  eyes_closed: "attr_eyes_closed",
};

export function labelToMessage(label, messages) {
  const key = LABEL_MSG[label];
  return (key && messages[key]) || "Remove occlusion";
}

/**
 * Creates a face attribute checker.
 * Returns null if config.face_attr is falsy (model never loaded).
 *
 * @param {object} config     — merged SDK config
 * @param {string} workerUrl  — URL to dist/face-attr-worker.js
 * @param {object} modelUrls  — { ortUrl, modelUrl, extDataUrl, extDataPath }
 *                              All URLs resolved by Session via assetUrl().
 */
export function createFaceAttrChecker(config, workerUrl, modelUrls) {
  if (!config.face_attr) return null;

  const threshold  = config.face_attr_threshold   ?? 0.5;
  const intervalMs = config.face_attr_interval_ms ?? 1000;

  let worker      = null;
  let ready       = false;
  let pending     = false;
  let lastLabel   = null;   // null = no occlusion detected
  let lastCheckAt = -Infinity;

  // Offscreen canvas reused for every 128×128 capture
  const offscreen = document.createElement("canvas");
  offscreen.width  = INFER_SIZE;
  offscreen.height = INFER_SIZE;
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

  try {
    console.log("[faceAttr] creating worker with script:", workerUrl);
    worker = new Worker(workerUrl);
  } catch (e) {
    console.warn("[faceAttr] failed to create worker:", e.message);
    return null;
  }

  worker.onmessage = ({ data }) => {
    if (data.type === "READY") {
      ready = true;
      console.log("[faceAttr] model ready");
      return;
    }
    if (data.type === "RESULT") {
      pending   = false;
      lastLabel = _evalScores(data.scores, threshold);
      const s = data.scores;
      console.log(
        `[faceAttr] scores — mask:${s.face_mask.toFixed(3)}  sun:${s.sunglasses.toFixed(3)}  glasses:${s.eyeglasses.toFixed(3)}  L-eye:${s.left_eye.toFixed(3)}  R-eye:${s.right_eye.toFixed(3)}  → label:${lastLabel ?? "none"}`
      );
      return;
    }
    if (data.type === "ERROR") {
      pending = false;
      console.warn("[faceAttr] worker reported error:", data.message);
    }
  };

  worker.onerror = (e) => {
    // ErrorEvent.message can be undefined for cross-origin worker script errors.
    const msg = e.message || e.error?.message || "(no message — likely a script load failure)";
    const loc = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "";
    console.error(`[faceAttr] worker uncaught error: ${msg}${loc ? "  at " + loc : ""}`);
    pending = false;
  };

  worker.postMessage({
    type:        "INIT",
    ortUrl:      modelUrls.ortUrl,
    modelUrl:    modelUrls.modelUrl,
    extDataUrl:  modelUrls.extDataUrl  || null,
    extDataPath: modelUrls.extDataPath || null,
    inputScale:  modelUrls.inputScale,
    inputType:   modelUrls.inputType,
  });

  return {
    /**
     * Call every tick while in HOLDING phase.
     * @param {HTMLVideoElement} videoEl
     * @param {Array<{x,y,z}>}  landmarks  MediaPipe normalized face landmarks
     * @param {number}          now
     */
    check(videoEl, landmarks, now) {
      if (ready && !pending && (now - lastCheckAt) >= intervalMs) {
        lastCheckAt = now;
        pending     = true;

        // Compute face bounding box from normalized MediaPipe landmark coords
        // (raw video space, unaffected by CSS mirror on front camera).
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const lm of landmarks) {
          if (lm.x < minX) minX = lm.x;
          if (lm.x > maxX) maxX = lm.x;
          if (lm.y < minY) minY = lm.y;
          if (lm.y > maxY) maxY = lm.y;
        }
        const padX  = (maxX - minX) * 0.1;
        const padY  = (maxY - minY) * 0.1;
        const vW    = videoEl.videoWidth;
        const vH    = videoEl.videoHeight;
        const sx    = Math.max(0, minX - padX) * vW;
        const sy    = Math.max(0, minY - padY) * vH;
        const sw    = Math.min(1 - Math.max(0, minX - padX), maxX - minX + 2 * padX) * vW;
        const sh    = Math.min(1 - Math.max(0, minY - padY), maxY - minY + 2 * padY) * vH;

        offCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, INFER_SIZE, INFER_SIZE);
        const imgData = offCtx.getImageData(0, 0, INFER_SIZE, INFER_SIZE);
        const buf     = imgData.data.buffer.slice(0);
        worker.postMessage({ type: "INFER", pixels: buf }, [buf]);
      }
      return lastLabel;
    },

    /** Clear cached label (e.g. when journey resets to HOLDING after pass). */
    reset() {
      lastLabel = null;
    },

    /** Terminate the worker. Call on session close. */
    stop() {
      try { worker.terminate(); } catch { }
      worker = null;
    },
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _evalScores(scores, threshold) {
  // Priority: mask → sunglasses → eyeglasses → eyes closed
  if (scores.face_mask  > threshold) return "face_mask";
  if (scores.sunglasses > threshold) return "sunglasses";
  if (scores.eyeglasses > threshold) return "eyeglasses";
  
  // eye openness: low score = closed; either eye closed triggers
  if (scores.left_eye < threshold || scores.right_eye < threshold) return "eyes_closed";
  return null;
}
