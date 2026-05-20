import { State } from "./state.js";
import { mergeConfig } from "../config/mergeConfig.js";
import { ErrorCode, makeError, safeCall } from "../util/errors.js";
import { resolveMount, createRoot } from "../dom/dom.js";
import { assetUrl } from "../assets/assets.js";
import { injectStylesheetOnce } from "../assets/inject.js";
import { fetchText } from "../assets/template.js";
import { computeCameraConstraints, startCamera, stopStream } from "../camera/camera.js";
import { createFaceLandmarker } from "../vision/faceLandmarker.js";
import { createLivenessLoop } from "../loop/livenessLoop.js";
import { encryptEnvelope } from "../crypto/envelope.js";

export class Session {
    constructor() {
        this.state = State.IDLE;

        this.abort = null;
        this.root = null;
        this.mount = null;

        this.videoEl = null;
        this.canvasVis = null;
        this.stream = null;

        this.faceLandmarker = null;
        this.loop = null;
        this.config = null;

        this.isFrontCamera = true;
    }

    getState() {
        return this.state;
    }

    async open(config_user) {
        if (!config_user || typeof config_user !== "object") {
            throw new Error("Invalid configuration object provided.");
        }
        if (this.state !== State.IDLE) {
            // production-friendly behavior: close existing session first
            await this.close();
        }

        this.state = State.OPENING;
        this.abort = new AbortController();

        try {
            this.config = await mergeConfig(config_user);
            this.mount = resolveMount(this.config);
            this.root = createRoot(this.mount);

            // check for encryption
            if (this.config.encrypt && !this.config.enc_key) {
                throw makeError(ErrorCode.INVALID_CONFIG, "encrypt=true requires enc_key (public key PEM)");
            }

            // ---- assets injection (once) ----
            injectStylesheetOnce(assetUrl(this.config, "assets/bootstrap-icons.min.css"), "icons");
            injectStylesheetOnce(assetUrl(this.config, "assets/styles.css"), "sdk");

            // ---- template ----
            const html = await fetchText(assetUrl(this.config, "assets/index.html"), this.abort.signal);
            this.root.innerHTML = html;

            // scope queries within root
            const $ = (sel) => this.root.querySelector(sel);

            this.videoEl = $("#video");
            this.canvasVis = $("#visCanvas");
            this.holeCanvas = $("#holeCanvas");

            if (!this.videoEl || !this.canvasVis || !this.holeCanvas) {
                throw makeError(
                    ErrorCode.INTERNAL,
                    "SDK template missing required elements (#video, #visCanvas, #holeCanvas)"
                );
            }

            // Close button
            const closeBtn = $("#btn-close");
            if (closeBtn) closeBtn.addEventListener("click", () => this.close());

            // loading screen
            const loading = $("#loading-screen");
            const loadingText = $("#loading-text");
            if (loadingText) loadingText.textContent = this.config.messages.LOADING;
            if (loading) loading.style.display = "flex";

            // ---- landmarker + camera constraints in parallel ----
            // WASM compilation (8 MB) and camera permission are independent —
            // running them together shaves several seconds off startup time.
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                throw makeError(ErrorCode.CAMERA_NOT_SUPPORTED, "getUserMedia() is not supported by your browser");
            }

            const [faceLandmarker, { isFrontCamera, constraints }] = await Promise.all([
                createFaceLandmarker(this.config, "VIDEO"),
                computeCameraConstraints(this.videoEl, this.config),
            ]);
            this.faceLandmarker = faceLandmarker;
            this.isFrontCamera = isFrontCamera;

            // Canvases remain unmirrored so text isn't flipped.
            this.videoEl.className = isFrontCamera ? "camera-view camera-view-front" : "camera-view";
            this.canvasVis.className = "canvas";
            this.holeCanvas.className = "canvas";

            this.stream = await startCamera(this.videoEl, constraints);

            if (loading) loading.style.display = "none";

            // ---- liveness loop ----
            const encryptFrame = (base64) => encryptEnvelope(base64, this.config.enc_key, {
                alg: this.config.encryption?.alg || "A256GCM",
                version: "v2",
            });

            this.loop = createLivenessLoop({
                root: this.root,
                videoElement: this.videoEl,
                canvasElement: this.canvasVis,
                config: this.config,
                faceLandmarker: this.faceLandmarker,
                encryptFrame: this.config.encrypt ? encryptFrame : null,
                workerUrl: assetUrl(this.config, "vis-worker.js"),
                onCapture: async (payload) => {
                    // Snapshot callbacks/config BEFORE close() can null them
                    const cfg = this.config;
                    const onCaptureComplete = cfg?.onCaptureComplete;
                    const onClose = cfg?.onClose;
                    const onError = cfg?.onError;

                    try {
                        safeCall(onCaptureComplete, payload);
                    } catch (e) {
                        safeCall(onError, e);
                    } finally {
                        if (onClose) {
                            await this.close();
                            safeCall(onClose);
                        }
                    }
                },
                onError: (err) => {
                    safeCall(this.config?.onError, makeError(ErrorCode.INTERNAL, "Runtime error", err));
                },
            });

            this.state = State.RUNNING;
            this.loop.start(this.isFrontCamera);
        } catch (err) {
            this.state = State.IDLE;
            safeCall(this.config?.onError, normalizeOpenError(err));
            await this._hardCleanup();
            throw err;
        }

    }

    async close() {
        if (this.state === State.IDLE) return true;
        if (this.state === State.CLOSING) return true;

        this.state = State.CLOSING;

        try {
            this.abort?.abort?.();

            this.loop?.stop?.();
            this.loop = null;

            if (this.videoEl) {
                try { this.videoEl.pause?.(); } catch { }
            }

            stopStream(this.stream);
            this.stream = null;

            if (this.faceLandmarker) {
                await this.faceLandmarker.close?.();
                this.faceLandmarker = null;
            }

            await this._hardCleanup();
            this.state = State.IDLE;
            return true;
        } catch {
            this.state = State.IDLE;
            await this._hardCleanup();
            return false;
        }
    }

    async _hardCleanup() {
        try {
            if (this.root) this.root.remove();
        } catch { }
        this.root = null;
        this.mount = null;
        this.videoEl = null;
        this.canvasVis = null;
        this.abort = null;
        this.config = null;
    }
}

function normalizeOpenError(err) {
    // map typical browser camera errors
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
        return makeError(ErrorCode.CAMERA_PERMISSION_DENIED, "Camera permission denied", err);
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return makeError(ErrorCode.CAMERA_NOT_FOUND, "Requested camera not found or constraints not satisfied", err);
    }
    if (name === "NotReadableError") {
        return makeError(ErrorCode.CAMERA_IN_USE, "Camera is already in use by another application", err);
    }
    if (err?.code && err?.message) return err;
    return makeError(ErrorCode.INTERNAL, "Initialization failed", err);
}
