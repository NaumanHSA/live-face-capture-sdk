### Version **Live Face Capture Web Release History**

### Version **4.1.0** [08/06/2026]
- Face attribute detection via ONNX Runtime Web worker (mask, sunglasses, eyeglasses, eyes-closed)
- Multi-journey liveness: blink, head_turn, and random modes
- Head-turn challenge with configurable threshold (`head_turn_thresh`)
- Optional FastAPI liveness server integration (SDK continues offline when server unavailable)
- Session auto-timeout (`session_timeout_ms`)
- AES-256-GCM frame encryption (`encrypt` + `enc_key`)
- `preload()` API to warm MediaPipe models before `open()`
- Configurable inference FPS cap (`inferenceFps`)
- Customisable UI messages (i18n support via `messages` config)
- Animated instruction icons for blink and head-turn challenges

### Version **4.0.0** [01/2025]
- Full SDK rewrite — modular architecture (Session, livenessLoop, draw, camera, vision)
- MediaPipe Face Landmarker replaces legacy Face Mesh
- ESM + UMD dual bundle output via Rollup
- Web Worker off-thread visualisation renderer
- Oval gradient shade overlay (OZ-style)
- Thin oval border with animated state colours
- Parallel MediaPipe + camera init for faster startup
- `assetBaseUrl` config for self-hosted deployments
- Face-fit relaxation after initial hold phase
- Docker + FastAPI server integration

### Version **2.0.0** [4/12/2024]
- added camera_id and camera source support
- explicit call to shutdown the library - added LiveFaceCapture.close()
- UI fixes
- Encryption support added

### Version **1.1.0** [29/11/2024]
- mediapipe dynamic import added
- added camera_id support
- UI fixes

### Version **1.0.0** [26/11/2024]
- initial version
