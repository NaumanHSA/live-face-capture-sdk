// TypeScript declarations for live-face-capture SDK v4

export declare const ErrorCode: {
  readonly INVALID_CONFIG: "INVALID_CONFIG";
  readonly CAMERA_NOT_SUPPORTED: "CAMERA_NOT_SUPPORTED";
  readonly CAMERA_PERMISSION_DENIED: "CAMERA_PERMISSION_DENIED";
  readonly CAMERA_NOT_FOUND: "CAMERA_NOT_FOUND";
  readonly CAMERA_IN_USE: "CAMERA_IN_USE";
  readonly ASSET_LOAD_FAILED: "ASSET_LOAD_FAILED";
  readonly INIT_ABORTED: "INIT_ABORTED";
  readonly SESSION_TIMEOUT: "SESSION_TIMEOUT";
  readonly INTERNAL: "INTERNAL";
};

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface SDKError {
  code: ErrorCodeValue;
  message: string;
  cause?: unknown;
}

export interface FaceBoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface CapturePayload {
  /** JPEG data-URL, or an encrypted v2 token when `encrypt: true`. */
  best_frame: string;
  face_bbox: FaceBoundingBox;
}

export interface MessagesConfig {
  MULTIPLE_FACES?: string;
  FACE_OUT_OF_FRAME?: string;
  MOVE_CLOSER?: string;
  HOLD_STILL?: string;
  OPEN_EYES?: string;
  BLINK_NOW?: string;
  NO_FACE?: string;
  LOADING?: string;
}

export interface SDKConfig {
  /** Use the front-facing camera. Default: `true`. */
  is_front_camera?: boolean;
  /** Camera device ID or index. Default: `0`. */
  camera_id?: string | number;
  camera_source?: number;
  /** Maximum camera resolution (longest edge). Default: `1920`. */
  max_camera_res?: number;
  /** Milliseconds the face must be stable before capture is attempted. Default: `2000`. */
  time_to_blink?: number;
  /** Minimum face detection confidence (0–1). Default: `0.5`. */
  min_face_detection_conf?: number;
  /** Minimum face tracking confidence (0–1). Default: `0.5`. */
  min_tracking_conf?: number;
  /** Minimum face-to-oval area ratio. Default: `0.4`. */
  face_area_thres?: number;
  /** Allow multiple faces in frame. Default: `false`. */
  allow_multiple_faces?: boolean;
  /** Maximum faces to detect. Default: `5`. */
  max_number_faces?: number;
  /** Pitch angle tolerance in degrees. Default: `15`. */
  pitch_thresh?: number;
  /** Yaw angle tolerance in degrees. Default: `15`. */
  yaw_thresh?: number;
  /** Roll angle tolerance in degrees. Default: `10`. */
  roll_thresh?: number;
  /** Minimum consecutive closed-eye frames to register a blink. Default: `2`. */
  blink_eye_frames?: number;
  /** EAR buffer window size for blink detection. Default: `30`. */
  blink_window_size?: number;
  /** EAR threshold below which eyes are considered closed. Default: `0.2`. */
  blink_eye_thresh?: number;
  /** Enable RSA+AES-GCM encryption of the captured frame. Default: `false`. */
  encrypt?: boolean;
  /** RSA public key PEM string. Required when `encrypt: true`. */
  enc_key?: string | null;
  /** RSA private key PEM string (for local decryption in demo only). */
  dec_key?: string | null;
  /** Encryption options. */
  encryption?: { alg?: "A256GCM" | "A256CBC" };
  /** Base URL for SDK assets. Defaults to the location of the bundle. */
  assetBaseUrl?: string | null;
  /** Mount the SDK inside this element ID instead of `document.body`. */
  containerId?: string | null;
  /** Inference loop target FPS. Default: `20`. */
  inferenceFps?: number;
  /** JPEG capture quality (0–1). Default: `0.92`. */
  jpeg_quality?: number;
  /** Session auto-timeout in milliseconds. `0` = disabled. Default: `0`. */
  session_timeout_ms?: number;
}

export interface SDKStyle {
  /** Show face landmark dots. Default: `true`. */
  vis?: boolean;
  /** Overlay background color. Default: `"#FFFFFF"`. */
  doc_color?: string;
  /** Overlay opacity (0–1). Default: `0.8`. */
  doc_opacity?: number;
  /** Oval height as fraction of video height. Default: `0.60`. */
  hole_height?: number;
  /** Oval width as fraction of oval height. Default: `0.65`. */
  hole_width?: number;
  /** Oval border color when face is correctly positioned. Default: `"#32CD32"`. */
  face_color_success?: string;
  /** Oval border color on failure. Default: `"#FF5733"`. */
  face_color_fail?: string;
  /** Overlay message font size (px). `null` = auto-scale. Default: `null`. */
  font_size?: number | null;
  /** Brand accent color (close button, bottom bar). Default: `"#b68a35"`. */
  brand_color?: string;
  /** Logo URL. Pass `null` to hide the logo row entirely. Default: `null`. */
  logo_url?: string | null;
}

export interface SDKOptions {
  config?: SDKConfig;
  style?: SDKStyle;
  /** Override any subset of the built-in UI messages (enables i18n). */
  messages?: MessagesConfig;
  onCaptureComplete?: (payload: CapturePayload) => void | Promise<void>;
  onError?: (error: SDKError) => void;
  onClose?: () => void;
}

export type SDKState = "idle" | "opening" | "running" | "closing";

export interface LiveFaceCaptureInstance {
  open(options: SDKOptions): Promise<void>;
  close(): Promise<boolean>;
  getState(): SDKState;
}

/**
 * Create an independent SDK instance.
 * Prefer this over the singleton when you need multiple instances,
 * or when embedding the SDK into a component with its own lifecycle.
 */
export declare function createLiveFaceCapture(): LiveFaceCaptureInstance;

/**
 * Convenience singleton instance.
 * Suitable for simple single-page apps.
 */
export declare const LiveFaceCapture: LiveFaceCaptureInstance;

export default LiveFaceCapture;
