export const ErrorCode = Object.freeze({
  INVALID_CONFIG: "INVALID_CONFIG",
  CAMERA_NOT_SUPPORTED: "CAMERA_NOT_SUPPORTED",
  CAMERA_PERMISSION_DENIED: "CAMERA_PERMISSION_DENIED",
  CAMERA_NOT_FOUND: "CAMERA_NOT_FOUND",
  CAMERA_IN_USE: "CAMERA_IN_USE",
  ASSET_LOAD_FAILED: "ASSET_LOAD_FAILED",
  INIT_ABORTED: "INIT_ABORTED",
  SESSION_TIMEOUT: "SESSION_TIMEOUT",
  INTERNAL: "INTERNAL",
});

export function makeError(code, message, cause, extra = {}) {
  return { code, message, cause, ...extra };
}

export function safeCall(fn, ...args) {
  try {
    return fn?.(...args);
  } catch {}
}
