export const config_default = {
  isfrcam: true,
  camId: null,
  camera_source: 0,
  cam_res: 1920,
  c2bt: 2000,

  max_fces: 5,
  multi_fces: false,
  det_conf: 0.5,
  trck_conf: 0.5,

  fc_ar_thresh: 0.4,
  p_thresh: 15,
  y_thresh: 15,
  r_thresh: 10,

  be_thresh: 0.2,
  be_frms: 2,
  be_win: 30,

  indices: {
    FACE_OVAL: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
    ROLL_PNTS: [6,168,8,9,151,10],
    FACE_LEFT_PNTS: [127,34,143,35,226,130,33,133,243,244,245,122,6],
    FACE_RIGHT_PNTS: [6,351,465,464,463,362,263,359,446,265,372,264,356],
    EYES_CENTER: [6],
    FACEMESH_NOSE_TIP: [1],
    FACEMESH_CHAIN_CENTER: [18],
    FACEMESH_RIGHT_EYE_POINTS: [33,160,158,133,153,144],
    FACEMESH_LEFT_EYE_POINTS: [362,385,387,263,373,380],
  },

  encrypt: false,
  enc_key: null,
  dec_key: null,
  encryption: null,

  journey: "blink",
  head_turn_thresh: 0.12,

  assetBaseUrl: null,
  containerId: null,
  inferenceFps: 20,
  jpeg_quality: 0.92,
  session_timeout_ms: 0,

  // ── Face attribute detection (disabled by default) ────────────────────────
  // Model + ort.js paths are resolved automatically from the asset base URL.
  // Place files under: dist/libs/ort.min.js
  //                    dist/models/face_attrib_net-onnx-w8a8/{.onnx, .data, metadata.json}
  face_attr: false,
  face_attr_precision: "int8",           // "int8"  → face_attrib_net-onnx-w8a8  (uint8  input, ~12 MB)
                                         // "float" → face_attrib_net-onnx-fp32   (float32 input, ~40 MB)
  face_attr_interval_ms: 1000,      // inference cadence while in HOLDING phase
  face_attr_threshold: 0.5,         // confidence cutoff for mask/sunglasses/eyeglasses/eyes-closed
};

export const messages_default = {
  MULTIPLE_FACES: "One face only — step back",
  FACE_OUT_OF_FRAME: "Center your face in the oval",
  MOVE_CLOSER: "Move closer",
  HOLD_STILL: "Hold still...",
  OPEN_EYES: "Open your eyes",
  BLINK_NOW: "Blink now!",
  LOOK_LEFT: "Look left",
  LOOK_RIGHT: "Look right",
  NO_FACE: "Place your face in the oval",
  LOADING: "Preparing camera...",
  FACE_MASK: "Please remove your face mask",
  SUNGLASSES: "Please remove your sunglasses",
  EYEGLASSES: "Please remove your glasses",
  EYES_CLOSED: "Please open your eyes",
};

export const styles_default = {
  VIS: true,
  DOC_COLOR: "#FFFFFF",
  DOC_OPACITY: 0.72,
  HOLE_HEIGHT: 0.55,
  HOLE_WIDTH: 0.65,
  FACE_COLOR_SUCCESS: "#32CD32",
  FACE_COLOR_FAIL: "#FF5733",
  FONT_SIZE: null,
};
