<div>
<h1>Live Face Capture SDK</h1>
<br>

<div align="center">
  <img width="40%" src="./assets/demo.gif">
</div>

<h2>Overview</h2>
A JavaScript SDK for capturing high-quality, liveness-verified facial images in the browser. Built on MediaPipe Face Mesh, it enforces correct face alignment (pitch, yaw, roll), confirms subject presence through liveness challenges, detects face occlusions in real time, and returns an encrypted or plain JPEG frame ready for downstream processing.

</div>

---

## What's New in v4.1.0

| Feature | Description |
|---|---|
| **Face Attribute Detection** | ONNX Runtime Web worker detects face mask, sunglasses, eyeglasses, and closed eyes in real time during the HOLDING phase. Blocks journey advancement until the occlusion is removed. |
| **Multi-Journey Liveness** | Three challenge modes: `blink`, `head_turn`, and `random` (randomly picks one per session). Configurable via the `journey` key. |
| **Head-Turn Challenge** | Liveness verified by asking the user to look left then right. Sensitivity tunable via `head_turn_thresh`. |
| **Liveness Server Integration** | Optional FastAPI backend — encrypted frames can be submitted server-side for additional scoring. SDK continues gracefully when the server is offline. |
| **Session Timeout** | Auto-closes the session after a configurable idle period (`session_timeout_ms`). |
| **Frame Encryption** | Captured JPEG can be AES-256-GCM encrypted before delivery to `onCaptureComplete` via `encrypt` + `enc_key`. |
| **Preload API** | `preload()` warms up MediaPipe models before `open()` is called, eliminating first-open latency. |
| **Configurable Inference FPS** | `inferenceFps` caps the landmark inference rate to balance accuracy vs. CPU usage. |

---

## Core Technology

Built on **MediaPipe Face Mesh** — 468 3D facial landmarks used for orientation estimation, blink detection, and head-turn tracking. Face attribute inference runs in a dedicated **Web Worker** via **ONNX Runtime Web** so it never blocks the main thread.

![roll_pitch_yaw](./assets/roll_pitch_yaw.jpg)

---

## Key Features

- **Orientation Estimation** — Pitch, Yaw, Roll angles (−90° to +90°, 0° = perfect alignment)
- **Liveness Detection** — Blink or head-turn challenge to confirm a live subject
- **Face Attribute Detection** — Real-time ONNX inference for mask / sunglasses / eyeglasses / eyes-closed
- **Face Distance** — Enforces minimum face-to-oval area ratio
- **Face Position** — Detects if the face drifts outside the oval
- **Visualization** — Live landmark overlay and bounding box on a canvas
- **Encryption** — Optional AES-256-GCM frame encryption

---

## Quick Start

### Build

```bash
npm install
npm run build
```

Outputs to `dist/`: `live-face-capture.esm.js`, `live-face-capture.umd.js`, and worker scripts.

### Import

```html
<!-- UMD (plain HTML) -->
<script src="./dist/live-face-capture.umd.js"></script>
```

```js
// ESM
import { LiveFaceCapture } from "./dist/live-face-capture.esm.js";
```

### Usage

```js
const sdk = new LiveFaceCapture();

await sdk.open({
    config: {
        // ── Camera ──────────────────────────────
        is_front_camera:         true,
        camera_id:               null,      // deviceId or index; null = auto
        max_camera_res:          1920,

        // ── Face checks ─────────────────────────
        min_face_detection_conf: 0.5,
        face_area_thres:         0.4,       // min face/oval area ratio
        pitch_thresh:            15,        // degrees
        yaw_thresh:              15,
        roll_thresh:             10,

        // ── Liveness journey ────────────────────
        journey:                 "blink",   // "blink" | "head_turn" | "random"
        time_to_blink:           2000,      // ms before challenge prompt
        blink_eye_thresh:        0.2,
        blink_eye_frames:        2,
        blink_window_size:       30,
        head_turn_thresh:        0.12,

        // ── Face attribute detection (optional) ─
        face_attr:               false,     // set true to enable
        face_attr_precision:     "int8",    // "int8" (~12 MB) | "float" (~40 MB)
        face_attr_threshold:     0.5,       // confidence cutoff
        face_attr_interval_ms:   1000,      // inference every N ms

        // ── Output ──────────────────────────────
        jpeg_quality:            0.92,
        encrypt:                 false,     // AES-256-GCM frame encryption
        enc_key:                 null,      // PEM public key (required if encrypt=true)

        // ── Advanced ────────────────────────────
        assetBaseUrl:            null,      // override asset base URL
        inferenceFps:            20,
        session_timeout_ms:      0,         // 0 = no timeout
    },
    style: {
        vis:                true,
        hole_height:        0.55,
        hole_width:         0.65,
        doc_color:          "#FFFFFF",
        doc_opacity:        0.72,
        face_color_success: "#32CD32",
        face_color_fail:    "#FF5733",
        font_size:          null,           // auto
    },
    messages: {
        // All keys are optional — only override what you need
        FACE_MASK:   "Please remove your face mask",
        SUNGLASSES:  "Please remove your sunglasses",
        EYEGLASSES:  "Please remove your glasses",
        EYES_CLOSED: "Please open your eyes",
        HOLD_STILL:  "Hold still...",
        BLINK_NOW:   "Blink now!",
        LOOK_LEFT:   "Look left",
        LOOK_RIGHT:  "Look right",
    },
    onCaptureComplete: (payload) => {
        // payload.best_frame — base64 JPEG (or encrypted envelope if encrypt=true)
        console.log(payload);
    },
    onError: (error) => {
        console.error(error);
    },
    onClose: () => {
        console.log("Session closed.");
    },
});
```

### Preload (optional)

Call `preload()` before `open()` to warm up MediaPipe models in the background:

```js
await sdk.preload(config);   // starts model download; resolves when ready
await sdk.open({ ... });     // opens instantly — models already loaded
```

### Close

```js
const ok = await sdk.close();   // stops camera, terminates workers, removes DOM
```

---

## Configuration Reference

### Camera

| Key | Type | Default | Description |
|---|---|---|---|
| `is_front_camera` | boolean | `true` | Hint for identifying front vs. back camera |
| `camera_id` | string\|number\|null | `null` | `deviceId` or list index; `null` = first available |
| `max_camera_res` | number | `1920` | Max camera resolution (width, pixels) |

### Face Checks

| Key | Type | Default | Description |
|---|---|---|---|
| `min_face_detection_conf` | number | `0.5` | MediaPipe detection confidence threshold |
| `face_area_thres` | number | `0.4` | Min face-oval area ratio (move closer if below) |
| `pitch_thresh` | number | `15` | Max allowed pitch angle (°) |
| `yaw_thresh` | number | `15` | Max allowed yaw angle (°) |
| `roll_thresh` | number | `10` | Max allowed roll angle (°) |
| `allow_multiple_faces` | boolean | `false` | Allow more than one face in frame |
| `max_number_faces` | number | `5` | Max faces tracked by MediaPipe |

### Liveness Journey

| Key | Type | Default | Description |
|---|---|---|---|
| `journey` | string | `"blink"` | `"blink"` · `"head_turn"` · `"random"` |
| `time_to_blink` | number | `2000` | Milliseconds of stable hold before challenge prompt |
| `blink_eye_thresh` | number | `0.2` | EAR threshold below which an eye is considered closed |
| `blink_eye_frames` | number | `2` | Consecutive closed frames to register a blink |
| `blink_window_size` | number | `30` | Frame window for blink detection |
| `head_turn_thresh` | number | `0.12` | Normalised yaw delta required for a head-turn pass |

### Face Attribute Detection

Requires ONNX model files under `dist/models/` and ORT runtime under `dist/libs/onnxruntime-web/`. All paths are resolved automatically from `assetBaseUrl` — no manual URL configuration needed.

| Key | Type | Default | Description |
|---|---|---|---|
| `face_attr` | boolean | `false` | Enable occlusion detection (mask / glasses / eyes) |
| `face_attr_precision` | string | `"int8"` | `"int8"` → w8a8 model (~12 MB) · `"float"` → fp32 (~40 MB) |
| `face_attr_threshold` | number | `0.5` | Confidence cutoff for all attribute classes |
| `face_attr_interval_ms` | number | `1000` | Inference cadence during HOLDING phase (ms) |

Detection priority (first match wins): **face\_mask → sunglasses → eyeglasses → eyes\_closed**

### Output & Encryption

| Key | Type | Default | Description |
|---|---|---|---|
| `jpeg_quality` | number | `0.92` | JPEG compression quality (0–1) |
| `encrypt` | boolean | `false` | AES-256-GCM encrypt the captured frame |
| `enc_key` | string\|null | `null` | PEM public key (required when `encrypt: true`) |

### Advanced

| Key | Type | Default | Description |
|---|---|---|---|
| `assetBaseUrl` | string\|null | `null` | Override base URL for SDK assets (MediaPipe, models, workers). Defaults to SDK bundle location. |
| `inferenceFps` | number | `20` | Cap landmark inference rate (frames/sec) |
| `session_timeout_ms` | number | `0` | Auto-close after N ms of no capture. `0` = disabled. |

### Styling

| Key | Type | Default | Description |
|---|---|---|---|
| `vis` | boolean | `true` | Show landmark/bounding-box visualisation overlay |
| `hole_height` | number | `0.55` | Oval height as fraction of viewport height |
| `hole_width` | number | `0.65` | Oval width as fraction of oval height |
| `doc_color` | string | `"#FFFFFF"` | Background colour outside the oval |
| `doc_opacity` | number | `0.72` | Opacity of the background layer |
| `face_color_success` | string | `"#32CD32"` | Oval border / message colour on pass |
| `face_color_fail` | string | `"#FF5733"` | Oval border / message colour on fail |
| `font_size` | number\|null | `null` | Message font size in px; `null` = auto |

### Callbacks

| Callback | Signature | Description |
|---|---|---|
| `onCaptureComplete` | `(payload) => void` | Fired on successful capture. `payload.best_frame` is a base64 JPEG (or encrypted envelope). |
| `onError` | `(error) => void` | Fired on any internal error. |
| `onClose` | `() => void` | Fired after the session closes following a successful capture. |

---

## Author

Muhammad Nouman Ahsan

## References

1. [MediaPipe](https://google.github.io/mediapipe/)
2. [MediaPipe GitHub](https://github.com/google/mediapipe)
3. [In-plane face orientation estimation](https://hal.archives-ouvertes.fr/hal-01169835/)
4. [Real-Time Eye Blink Detection using Facial Landmarks](https://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf)
