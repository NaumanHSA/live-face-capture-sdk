import { config_default, styles_default } from "./CONFIG.js";
import {
    getFaceRect,
    normalized_to_pixel_coordinates,
    drawFaceRect,
    isFaceFit,
    getEAR,
    detectEyesBlinkTemporal,
    drawLandmarksCustom,
    detectPitch,
    detectYaw,
    detectRoll,
    mergeConfig,
    drawHole,
    loadScripts,
    getWorkingCameras
} from "./utils.js";
import { generateSecretExecutionData, decryptSecretExecutionData } from "./encryption.js";


let videoElement, loadingSreenElement, canvasElement, canvasCtx, close_btn;
let isFrontCamera;
let faceLandmarker;
let runningMode = "VIDEO";
let HOLE = null;
let st_time = null;
let capturedImage = null;
let camera = null;
let lastVideoTime = -1;
let results = undefined;
const containerId = 'root-container';
let config;


export async function initializeCapture(config_user) {
    config = await mergeConfig(config_default, styles_default, config_user);
    // Check if a container exists, or create one
    const container = document.createElement('div');
    container.id = containerId;
    container.className = "root-container";
    document.body.appendChild(container);

    // Load external scripts
    const scripts = [
        "https://bundle.run/numericjs@1.2.6",
    ];
    loadScripts(scripts)
        .then(async () => {
            // add bootstrap
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = "https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css";
            document.head.appendChild(link);

            // add bootstrap
            const link1 = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
            document.head.appendChild(link1);

            const styleSheet = `.root-container{width:100%;height:100%;display:flex;justify-content:center;align-items:center;position:absolute;top:0;left:0;background-color:#000}.btn-close{position:absolute;top:2%;left:90%;background-color:transparent;color:#b68a35;font-size:30px;cursor:pointer;z-index:999;border:none}.camera-view,.canvas,.loading-screen{position:absolute;top:0;left:0;width:100%;height:100%}.app-container{width:100%;max-width:600px;height:100%;background-color:#000;box-shadow:0 0 20px rgba(0,0,0,.5);display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;padding:0}.camera-view,.canvas{object-fit:cover}.camera-view-front{transform:rotateY(180deg);-webkit-transform:rotateY(180deg);-moz-transform:rotateY(180deg)}.loading-screen{background-color:rgba(0,0,0,.9);justify-content:center;align-items:center;flex-direction:column;z-index:1000;display:none}.loading-circle{width:15%;aspect-ratio:1/1;border:5px solid rgba(255,255,255,.3);border-top:5px solid #fff;border-radius:50%;animation:1s linear infinite rotate}@keyframes rotate{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`
            // const responseCSS = await fetch("./src/assets/ui.css");
            // const styleSheet = await responseCSS.text();
            const style = document.createElement('style');
            style.appendChild(document.createTextNode(styleSheet));
            document.head.appendChild(style);

            // const response = await fetch("./src/assets/ui.html");
            // const html = await response.text();
            const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app-container" style="background-color:#fff" class="app-container container col-12 col-sm-8 col-md-7 col-lg-6 col-xl-4 d-flex flex-column align-items-center justify-content-between"><div id="loading-screen" class="loading-screen"><div class="loading-circle"></div><div class="mt-2" style="color:#fff">Loading...</div></div><div class="row pt-2 pl-4 pb-2 mb-2 shadow" style="width:100%;height:12%;background-color:#fff;overflow:hidden;z-index:1"><div class="col"><img src="https://home.moi.gov.ae/moi/assets/img/svg-icons/uae-minstry-logo.svg" style="height:100%;object-fit:contain;overflow:hidden"></div></div><div id="video-container" class="w-100 p-0" style="height:83%;position:relative;overflow:hidden"><video id="video" class="camera-view p-0" autoplay muted></video><canvas id="visCanvas" class="canvas p-0"></canvas><canvas id="holeCanvas" class="canvas p-0"></canvas></div><div class="row" style="width:100%;height:5%;background-color:#b68a35;overflow:hidden"></div></div></body></html>`
            container.innerHTML = html;
            setupUI(); // Initialize event listeners and functionality
        })
        .catch((error) => {
            console.error('Initialization error:', error);
        });
}


async function setupUI() {
    videoElement = document.getElementById('video');
    loadingSreenElement = document.getElementById('loading-screen');
    canvasElement = document.getElementById('visCanvas');
    canvasCtx = canvasElement.getContext('2d');
    close_btn = document.createElement("button");
    close_btn.id = "btn-close";
    close_btn.className = "btn-close bi bi-x-lg";
    document.getElementById('app-container').appendChild(close_btn);
    document.getElementById('btn-close').addEventListener("click", shutDown);
    isFrontCamera = config.isfrcam;

    // Before we can use HandLandmarker class we must wait for it to finish
    // loading. Machine Learning models can be large and take a moment to
    // get everything needed to run.
    async function createFaceLandmarker() {
        const { FaceLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode,
            numFaces: config.max_fces,
            minFaceDetectionConfidence: config.det_conf,
            minTrackingConfidence: config.trck_conf,
            outputFaceBlendshapes: false,
        });
    }

    async function getCameraInformation() {
        let stream, videoTrack, facingMode;
        let deviceId = config.camId;
        if (deviceId != undefined && deviceId != null) {
            if (typeof deviceId === "string" && !/^-?\d+$/.test(deviceId)) {
                const constraints = { video: { deviceId: { exact: deviceId } } };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoTrack = stream.getVideoTracks()[0];
                const trackSettings = videoTrack.getSettings(); // Get track settings
                if (trackSettings.facingMode && ['user', 'enviroment'].includes(trackSettings.facingMode)) {
                    isFrontCamera = trackSettings.facingMode == "user" ? true : false;
                }
            } else {
                let source = deviceId || 0;
                if (typeof source === "string" && /^-?\d+$/.test(source)) {
                    source = parseInt(source, 10);
                }
                const availableCameras = await getWorkingCameras();
                if (availableCameras[source] == undefined) {
                    throw new Error();
                }
                deviceId = availableCameras[source].deviceId;
                const constraints = { video: { deviceId: { exact: deviceId } } };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoTrack = stream.getVideoTracks()[0];
                const trackSettings = videoTrack.getSettings(); // Get track settings
                console.log(availableCameras[source].label, trackSettings);
                if (trackSettings.facingMode && ['user', 'enviroment'].includes(trackSettings.facingMode)) {
                    isFrontCamera = trackSettings.facingMode == "user" ? true : false;
                }
            }
        } else {
            try {
                facingMode = isFrontCamera ? "user" : "environment";
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { exact: facingMode } }
                });
                videoTrack = stream.getVideoTracks()[0];
            } catch {
                isFrontCamera = ~isFrontCamera;
                facingMode = isFrontCamera ? "user" : "environment";
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { exact: facingMode } }
                });
                videoTrack = stream.getVideoTracks()[0];
            }
        }
        const capabilities = videoTrack.getCapabilities();
        videoTrack.stop(); // Stop the track to release the camera
        const maxWidth = capabilities.width?.max || 0;
        const maxHeight = capabilities.height?.max || 0;
        let camera_width, camera_height;
        if (maxWidth < maxHeight) {
            camera_width = Math.min(maxWidth, config.cam_res);
            camera_height = Math.ceil((camera_width * videoElement.offsetHeight) / videoElement.offsetWidth);
        } else {
            camera_height = Math.min(maxHeight, config.cam_res);
            camera_width = Math.ceil((camera_height * videoElement.offsetWidth) / videoElement.offsetHeight);
        }
        // set the canvas based on the frontCamera Specified
        videoElement.className = (isFrontCamera) ? "camera-view camera-view-front" : "camera-view";
        return {
            "camera_width": camera_width,
            "camera_height": camera_height,
            "deviceId": deviceId,
            "facingMode": facingMode
        }
    }

    async function startCamera() {
        try {
            const isPortrait = window.innerHeight > window.innerWidth;
            const { camera_width, camera_height, deviceId, facingMode } = await getCameraInformation();
            let constraints = {
                video: {
                    width: { ideal: isPortrait ? camera_height : camera_width },
                    height: { ideal: isPortrait ? camera_width : camera_height },
                },
                audio: false,
            };
            if (deviceId) constraints.video.deviceId = { exact: deviceId };
            else constraints.video.facingMode = { exact: facingMode };

            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                videoElement.srcObject = stream;
                videoElement.addEventListener("loadeddata", onResults);
            });
        } catch (error) {
            if (config.onError) config.onError("The requested camera with the provided deviceId cannot be fetched:", error);
            shutDown();
        }
    }

    enableLoadingScreen();
    HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "");
    await createFaceLandmarker();

    // If webcam supported, add event listener to button for when user
    // wants to activate it.
    if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        // get user permissions
        await navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            stream.getTracks().forEach((track) => track.stop()); // Stop each track
        });
        startCamera();
    } else {
        if (config.onError) config.onError("getUserMedia() is not supported by your browser");
    }
}

// Capture image from the video element
function captureImage() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    canvas.style.objectFit = "cover";
    // Draw the current video frame to the canvas
    let width = canvas.width;
    if (isFrontCamera) {
        context.scale(-1, 1);
        width *= -1;
    }
    context.drawImage(videoElement, 0, 0, width, canvas.height);
    // Convert the canvas content to a data URL (base64 image)
    const base64 = canvas.toDataURL('image/png');
    // const encryptedImage = encrypt(base64);
    return base64;
}

function enableLoadingScreen() {
    loadingSreenElement.style.display = 'flex';
}
function disableLoadingScreen() {
    loadingSreenElement.style.display = 'none';
}

// Handle detection results
async function onResults() {
    disableLoadingScreen();
    try {
        let startTimeMs = performance.now();
        if (lastVideoTime !== videoElement.currentTime) {
            lastVideoTime = videoElement.currentTime;
            results = faceLandmarker.detectForVideo(videoElement, startTimeMs);
        }
        const W = videoElement.videoWidth;
        const H = videoElement.videoHeight;
        canvasElement.width = W;
        canvasElement.height = H;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (st_time == null) st_time = new Date();
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // If multiple faces are not allowed
            if (!config.multi_fces && results.faceLandmarks.length > 1) {
                HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "MULTIPLE FACES DETECTED!");
                if (config.VIS) {
                    for (const landmarks_norm of results.faceLandmarks) {
                        const bbox = getFaceRect(landmarks_norm, W, H);
                        if (isFrontCamera) {
                            const x1 = bbox.x1, x2 = bbox.x2;
                            bbox.x1 = W - x2;
                            bbox.x2 = W - x1;
                        }
                        let landmarks = [];
                        for (const pnt of landmarks_norm) {
                            const landmark_px = normalized_to_pixel_coordinates(pnt.x, pnt.y, W, H);
                            if (landmark_px != null) {
                                landmarks.push({
                                    "x": isFrontCamera ? W - landmark_px[0] : landmark_px[0],
                                    "y": landmark_px[1],
                                    "z": pnt.z,
                                    "visibility": undefined
                                })
                            }
                        };
                        drawLandmarksCustom(canvasCtx, landmarks, { color: 'red', raduis: 4 }, null);
                        drawFaceRect(canvasCtx, bbox, 5, 'yellow');
                    }
                }
                st_time = new Date();
                capturedImage = null;
                window.requestAnimationFrame(onResults);
                return;
            }

            // Find the largest face
            const face = await results.faceLandmarks.reduce((largest, landmarks) => {
                // console.log(landmarks)
                const bbox = getFaceRect(landmarks, W, H);
                const area = bbox.width * bbox.height;
                if (!largest || area > largest.area) {
                    return { landmarks, bbox, area };
                }
                return largest;
            }, null);

            let landmarks = [];
            for (const pnt of face.landmarks) {
                const landmark_px = normalized_to_pixel_coordinates(pnt.x, pnt.y, W, H);
                if (landmark_px != null) {
                    landmarks.push({
                        "x": isFrontCamera ? W - landmark_px[0] : landmark_px[0],
                        "y": landmark_px[1],
                        "z": pnt.z,
                        "visibility": undefined
                    })
                }
            };
            if (isFrontCamera) {
                const x1 = face.bbox.x1, x2 = face.bbox.x2;
                face.bbox.x1 = W - x2;
                face.bbox.x2 = W - x1;
            }

            const is_face_fit = isFaceFit(
                landmarks, config.indices.FACE_OVAL, HOLE, videoElement.offsetWidth, videoElement.offsetHeight,
                W, H, face.bbox, config.fc_ar_thresh
            );
            if (is_face_fit == 0) {
                // find roll angle
                const rollAngle = detectRoll(landmarks, config.indices.ROLL_PNTS);
                const yawIndex = detectYaw(
                    canvasCtx, landmarks, config.indices.FACE_RIGHT_PNTS, config.indices.FACE_LEFT_PNTS, W,
                    H, config.VIS
                );
                // find pitch index
                const pitchIndex = detectPitch(
                    canvasCtx, landmarks, config.indices.EYES_CENTER, config.indices.FACEMESH_CHAIN_CENTER,
                    config.indices.FACEMESH_NOSE_TIP, W, H, config.VIS
                );
                if (-config.r_thresh <= rollAngle && rollAngle <= config.r_thresh) {
                    // find yaw index
                    if (-config.y_thresh <= yawIndex && yawIndex <= config.y_thresh) {
                        if (-config.p_thresh <= pitchIndex && pitchIndex <= config.p_thresh) {
                            HOLE = await drawHole(videoElement, config, config.FACE_COLOR_SUCESS, "EVERYTHING's GOOD. STAY STILL!");
                            const end_time = new Date();
                            var milliseconds = (end_time.getTime() - st_time.getTime());
                            if (milliseconds >= config.c2bt) {
                                if (capturedImage == null) {
                                    const EAR = getEAR(landmarks, config);
                                    if (EAR >= 0.25) {
                                        capturedImage = await captureImage();
                                    } else {
                                        HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "LOOK STRAIGHT AND OPEN YOUR EYES PLEASE.");
                                    }
                                } else {
                                    HOLE = await drawHole(videoElement, config, config.FACE_COLOR_SUCESS, "PLEASE BLINK YOUR EYES NOW!");
                                    const blinkRes = await detectEyesBlinkTemporal(landmarks, config);
                                    if (blinkRes) {
                                        if (config.onCaptureComplete) {
                                            let cipheredText;
                                            if (config.encrypt) {
                                                cipheredText = await generateSecretExecutionData(capturedImage, config.enc_key);
                                            }
                                            // const decryptedData = await decryptSecretExecutionData(cipheredText, config.dec_key);
                                            results = {
                                                "face_bbox": face.bbox,
                                                "best_frame": config.encrypt ? cipheredText : capturedImage
                                            }
                                            config.onCaptureComplete(results);
                                            if (config.onClose) {
                                                await shutDown();
                                                config.onClose();
                                            }
                                        }
                                        // alert(blinkRes.toUpperCase() + " EYE BLINK DETECTED...")
                                        st_time = new Date();
                                        capturedImage = null;
                                    }
                                }
                            }
                        } else {
                            if (pitchIndex < -config.p_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "LOOKING DOWNWARDS");
                            else if (pitchIndex > config.p_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "LOOKING UPWARDS");
                            st_time = new Date();
                            capturedImage = null;
                        }
                    } else {
                        if (yawIndex < -config.y_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "LOOKING TOWARDS LEFT");
                        else if (yawIndex > config.y_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "LOOKING TOWARDS RIGHT");
                        st_time = new Date();
                        capturedImage = null;
                    }
                } else {
                    if (rollAngle < -config.r_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "ROTATING ANTICLOCKWISE");
                    else if (rollAngle > config.r_thresh) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "ROTATING CLOCKWISE");;
                    st_time = new Date();
                    capturedImage = null;
                }
            } else {
                if (is_face_fit == 1) HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "FACE OUT OF RANGE");
                else HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "FACE TOO FAR FROM THE CAMERA");
                st_time = new Date();
                capturedImage = null;
            }
            if (config.VIS) {
                drawLandmarksCustom(canvasCtx, landmarks, { color: 'red', raduis: 4 }, null);
                drawFaceRect(canvasCtx, face.bbox, 5, 'yellow');
            }
        } else {
            HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "FACE OUT OF RANGE");
            st_time = new Date();
            capturedImage = null;
        }
    } catch (err) {
        // console.log(err);
        // HOLE = await drawHole(videoElement, config, config.FACE_COLOR_FAIL, "FACE OUT OF RANGE");
        st_time = new Date();
        capturedImage = null;
        if (config.onError) {
            config.onError(err);
        }
        return;
    }
    window.requestAnimationFrame(onResults);
}

export async function shutDown() {
    try {
        // Remove event listener
        if (videoElement) {
            videoElement.removeEventListener("loadeddata", onResults);
        }
        // Stop the camera's media stream
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach((track) => track.stop()); // Stop each track
            videoElement.srcObject = null; // Clear the video element's source
        }
        // Dispose of the Face Landmarker instance
        if (faceLandmarker) {
            await faceLandmarker.close();
            faceLandmarker = null; // Clear reference
        }
        // Clear camera instance
        if (camera) camera = null;
        // Clean up video element
        if (videoElement) {
            videoElement.className = ""; // Clear CSS classes
            videoElement.removeAttribute("src");
            videoElement.removeAttribute("srcObject");
        }
        // Remove the container from the DOM
        const container = document.getElementById(containerId);
        if (container) container.remove();
        console.log("Shutdown process completed successfully.");
        return true; // Indicate success
    } catch (error) {
        return false; // Indicate failure
    }
}