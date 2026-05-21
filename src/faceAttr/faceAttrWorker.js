// Face attribute inference worker — classic (non-module) Web Worker.
// Loads ORT via importScripts() so it sets self.ort as a global (UMD build).
// Must be loaded as a classic worker: new Worker(url)
//
// Messages received:
//   { type: "INIT", ortUrl, modelUrl, extDataUrl, extDataPath, inputScale, inputType }
//   { type: "INFER", pixels: ArrayBuffer }     pixels = RGBA Uint8 128×128
//
// Messages sent:
//   { type: "READY" }
//   { type: "RESULT", scores: { left_eye, right_eye, eyeglasses, face_mask, sunglasses } }
//   { type: "ERROR", message }

let ortInstance = null;
let session     = null;
let inputScale  = "zero_to_255";
let inputType   = "uint8";

const SIZE = 128;

self.onmessage = async ({ data }) => {
  const { type } = data;

  // ── INIT ──────────────────────────────────────────────────────────────────
  if (type === "INIT") {
    try {
      if (!data.ortUrl)   throw new Error("ortUrl is required");
      if (!data.modelUrl) throw new Error("modelUrl is required");

      console.log("[faceAttr] loading ORT from:", data.ortUrl);
      self.importScripts(data.ortUrl);
      ortInstance = self.ort;

      if (!ortInstance) throw new Error("ORT global not found — ort.min.js must be a UMD build");

      const wasmDir = data.ortUrl.substring(0, data.ortUrl.lastIndexOf("/") + 1);
      ortInstance.env.wasm.wasmPaths  = wasmDir;
      ortInstance.env.wasm.numThreads = 1;
      console.log("[faceAttr] ORT ready, version:", ortInstance.env.versions?.web ?? "unknown");

      inputScale = data.inputScale || "zero_to_255";
      inputType  = data.inputType  || "uint8";

      const sessionOpts = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };

      if (data.extDataUrl && data.extDataPath) {
        console.log("[faceAttr] fetching external data:", data.extDataUrl);
        const res = await fetch(data.extDataUrl);
        if (!res.ok) throw new Error(`Failed to fetch external data: HTTP ${res.status}`);
        const extBytes = new Uint8Array(await res.arrayBuffer());
        sessionOpts.externalData = [{ path: data.extDataPath, data: extBytes }];
        console.log("[faceAttr] external data fetched:", (extBytes.byteLength / 1024).toFixed(0), "KB");
      }

      console.log("[faceAttr] creating session — inputType:", inputType, "inputScale:", inputScale);
      session = await ortInstance.InferenceSession.create(data.modelUrl, sessionOpts);
      console.log("[faceAttr] session ready — inputs:", session.inputNames, "outputs:", session.outputNames);
      self.postMessage({ type: "READY" });
    } catch (e) {
      const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e)) || "unknown error";
      console.error("[faceAttr] INIT failed:", e);
      self.postMessage({ type: "ERROR", message: msg });
    }
    return;
  }

  // ── INFER ─────────────────────────────────────────────────────────────────
  if (type === "INFER") {
    if (!session) {
      self.postMessage({ type: "ERROR", message: "Session not initialized" });
      return;
    }

    try {
      const rgba = new Uint8Array(data.pixels);
      const n    = SIZE * SIZE;

      let tensor;
      if (inputType === "uint8") {
        const buf = new Uint8Array(3 * n);
        for (let i = 0; i < n; i++) {
          buf[i]         = rgba[i * 4];
          buf[n + i]     = rgba[i * 4 + 1];
          buf[2 * n + i] = rgba[i * 4 + 2];
        }
        tensor = new ortInstance.Tensor("uint8", buf, [1, 3, SIZE, SIZE]);
      } else {
        const scale = inputScale === "zero_to_255" ? 1.0 : 1.0 / 255.0;
        const buf   = new Float32Array(3 * n);
        for (let i = 0; i < n; i++) {
          buf[i]         = rgba[i * 4]     * scale;
          buf[n + i]     = rgba[i * 4 + 1] * scale;
          buf[2 * n + i] = rgba[i * 4 + 2] * scale;
        }
        tensor = new ortInstance.Tensor("float32", buf, [1, 3, SIZE, SIZE]);
      }

      const feeds  = { [session.inputNames[0]]: tensor };
      const output = await session.run(feeds);

      let vals;
      if (session.outputNames.length >= 5) {
        vals = session.outputNames.slice(0, 5).map(name => output[name].data[0]);
      } else {
        const flat = output[session.outputNames[0]].data;
        vals = [flat[0], flat[1], flat[2], flat[3], flat[4]];
      }

      // w8a8 model outputs raw uint8 scores (0–255); normalize to 0–1 so the
      // threshold comparison in faceAttr.js works uniformly for both precisions.
      const norm = inputType === "uint8" ? 1 / 255 : 1;
      self.postMessage({
        type: "RESULT",
        scores: {
          left_eye:   vals[0] * norm,
          right_eye:  vals[1] * norm,
          eyeglasses: vals[2] * norm,
          face_mask:  vals[3] * norm,
          sunglasses: vals[4] * norm,
        },
      });
    } catch (e) {
      const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e)) || "unknown error";
      console.error("[faceAttr] INFER failed:", e);
      self.postMessage({ type: "ERROR", message: msg });
    }
  }
};
