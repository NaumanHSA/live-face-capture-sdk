import { assetUrl } from "../assets/assets.js";

async function tryCreateLandmarker(FaceLandmarker, filesetResolver, options) {
  return FaceLandmarker.createFromOptions(filesetResolver, options);
}

export async function createFaceLandmarker(config, runningMode) {
  const tasksUrl = assetUrl(config, "libs/tasks-vision@0.10.3.js");
  const wasmBinaryPath = assetUrl(config, "libs/vision_wasm_internal.wasm");
  const wasmLoaderPath = assetUrl(config, "libs/vision_wasm_internal.js");
  const modelAssetPath = assetUrl(config, "libs/face_landmarker.task");

  const { FaceLandmarker } = await import(tasksUrl);

  const filesetResolver = { wasmBinaryPath, wasmLoaderPath };

  const baseOptions = { modelAssetPath, delegate: "GPU" };
  const opts = {
    baseOptions,
    runningMode,
    numFaces: config.max_fces,
    minFaceDetectionConfidence: config.det_conf,
    minTrackingConfidence: config.trck_conf,
    outputFaceBlendshapes: false,
  };

  try {
    return await tryCreateLandmarker(FaceLandmarker, filesetResolver, opts);
  } catch {
    // GPU delegate unavailable — fall back to CPU.
    return tryCreateLandmarker(FaceLandmarker, filesetResolver, {
      ...opts,
      baseOptions: { ...baseOptions, delegate: "CPU" },
    });
  }
}
