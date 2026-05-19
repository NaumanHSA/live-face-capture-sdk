import { Session } from "./session/Session.js";
import { mergeConfig } from "./config/mergeConfig.js";
import { createFaceLandmarker } from "./vision/faceLandmarker.js";

export function createLiveFaceCapture() {
  const session = new Session();
  return {
    open: (config) => session.open(config),
    close: () => session.close(),
    getState: () => session.getState(),
  };
}

// Convenience singleton — fine for apps that need only one instance.
export const LiveFaceCapture = createLiveFaceCapture();

/**
 * Preload the MediaPipe WASM runtime and face model in the background.
 * Call this as early as possible (e.g. on page load) so the 8 MB WASM
 * is already compiled by the time the user opens the SDK.
 *
 * Usage:
 *   LiveFaceCapture.preload();               // default asset paths
 *   LiveFaceCapture.preload({ assetBaseUrl: "https://cdn.example.com/" });
 */
LiveFaceCapture.preload = async function preload(config_user = {}) {
  try {
    const config = await mergeConfig({ config: config_user });
    // Instantiate the landmarker — this triggers WASM download + compile
    // and model loading. The result is discarded; the browser caches the
    // compiled module so the real open() call reuses it instantly.
    const lm = await createFaceLandmarker(config, "IMAGE");
    await lm.close?.();
  } catch {
    // Preload is best-effort — failures are silently ignored.
  }
};

export default LiveFaceCapture;
