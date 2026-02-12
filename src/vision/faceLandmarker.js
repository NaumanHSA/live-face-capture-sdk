import { assetUrl } from "../assets/assets.js";

export async function createFaceLandmarker(config, runningMode) {
  const tasksUrl = assetUrl(config, "libs/tasks-vision@0.10.3.js");
  const wasmBinaryPath = assetUrl(config, "libs/vision_wasm_internal.wasm");
  const wasmLoaderPath = assetUrl(config, "libs/vision_wasm_internal.js");
  const modelAssetPath = assetUrl(config, "libs/face_landmarker.task");

  const { FaceLandmarker } = await import(tasksUrl);

  const filesetResolver = { wasmBinaryPath, wasmLoaderPath };

  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath, delegate: "CPU" },
    runningMode,
    numFaces: config.max_fces,
    minFaceDetectionConfidence: config.det_conf,
    minTrackingConfidence: config.trck_conf,
    outputFaceBlendshapes: false,
  });
}
