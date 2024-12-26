const PITCH_CONNECTIONS_indices = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 17, 18, 200, 199, 175, 152]


export function normalized_to_pixel_coordinates(x, y, image_width, image_height) {
    function is_valid_normalized_value(value) {
        return value >= 0 && value <= 1 ? true : false
    }

    if (!is_valid_normalized_value(x) || !is_valid_normalized_value(y)) {
        return null;
    }
    const x_px = parseInt(Math.min(Math.floor(x * image_width), image_width - 1))
    const y_px = parseInt(Math.min(Math.floor(y * image_height), image_height - 1))
    return [x_px, y_px]
}

export function getFaceRect(landmarks, canvasWidth, canvasHeight) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    landmarks.forEach((landmark) => {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
    });
    // Convert to pixel dimensions
    const x1 = Math.floor(minX * canvasWidth);
    const y1 = Math.floor(minY * canvasHeight);
    const x2 = Math.floor(maxX * canvasWidth);
    const y2 = Math.floor(maxY * canvasHeight);
    return {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        width: x2 - x1,
        height: y2 - y1
    };
}

function drawLine(ctx, x1, y1, x2, y2, thickness, color) {
    ctx.beginPath();
    ctx.setLineDash([15, 15]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
}

export function drawFaceRect(ctx, rect, thickness, color) {
    drawLine(ctx, rect.x1, rect.y1, rect.x2, rect.y1, thickness, color);
    drawLine(ctx, rect.x2, rect.y1, rect.x2, rect.y2, thickness, color);
    drawLine(ctx, rect.x2, rect.y2, rect.x1, rect.y2, thickness, color);
    drawLine(ctx, rect.x1, rect.y2, rect.x1, rect.y1, thickness, color);
}

function isLandmarkOverflowing(landmarks, outer_oval) {
    const [centerX, centerY, width, height] = outer_oval;
    const a = width / 2;    // semi-major axis
    const b = height / 2;   // semi-minor axis
    for (const [x, y] of landmarks) {
        const normalizedX = (x - centerX) / a;
        const normalizedY = (y - centerY) / b;
        if ((normalizedX ** 2 + normalizedY ** 2) > 1) {
            return true; // Overflow detected
        }
    }
    return false; // No overflow detected
}


export function isFaceFit(landmarks, face_oval_indices, outer_oval, view_width, view_height, image_width, image_height, faceRect, area_threshold) {
    let index = 0;
    var face_oval_points = [];
    for (const landmark of landmarks) {
        if (face_oval_indices.includes(index)) {
            face_oval_points.push([landmark.x, landmark.y]);
        }
        index += 1;
    };
    const w = faceRect.width;
    const h = faceRect.height;
    let face_area = Math.PI * (w / 2) * (h / 2);
    const isOutside = isLandmarkOverflowing(face_oval_points, outer_oval);
    const [centerX, centerY, holeWidth, holeHeight] = outer_oval;
    const outer_oval_area = Math.PI * (holeHeight / 2) * (holeWidth / 2);
    const face_hole_area_ratio = (face_area / outer_oval_area);
    if (isOutside) return 1;
    else if (face_hole_area_ratio < area_threshold) return 2;
    else return 0;
}


// Calculate Euclidean distance
function distance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
    );
}

// Calculate EAR for an eye
function calculateEAR(landmarks, indices) {
    const vertical1 = distance(landmarks[indices[1]], landmarks[indices[5]]);
    const vertical2 = distance(landmarks[indices[2]], landmarks[indices[4]]);
    const horizontal = distance(landmarks[indices[0]], landmarks[indices[3]]);
    return (vertical1 + vertical2) / (2 * horizontal);
}

// Blink detection
export function getEAR(landmarks, config) {
    const rightEAR = calculateEAR(landmarks, config.indices.FACEMESH_RIGHT_EYE_POINTS);
    const leftEAR = calculateEAR(landmarks, config.indices.FACEMESH_LEFT_EYE_POINTS);
    const avgEAR = (rightEAR + leftEAR) / 2;
    return avgEAR;
}

// Sliding window buffer for EAR values
const earBuffer = []; // Holds EAR values over the last N frames
export function detectEyesBlinkTemporal(landmarks, config) {
    const rightEAR = calculateEAR(landmarks, config.indices.FACEMESH_RIGHT_EYE_POINTS);
    const leftEAR = calculateEAR(landmarks, config.indices.FACEMESH_LEFT_EYE_POINTS);
    const avgEAR = (rightEAR + leftEAR) / 2;
    // console.log("avgEAR", avgEAR)

    // Add current EAR to buffer
    earBuffer.push(avgEAR);

    // Limit buffer size to N frames
    const WINDOW_SIZE = config.be_win || 10;
    if (earBuffer.length > WINDOW_SIZE) {
        earBuffer.shift();
    }

    // Detect blink pattern in the buffer
    const BLINK_THRESHOLD = config.be_thresh;
    const MIN_CLOSED_FRAMES = config.be_frms || 2;
    const MIN_OPEN_FRAMES = config.OPEN_FRAMES_THRESHOLD || 2;

    // States
    let openCountBefore = 0; // Tracks open frames before closure
    let closedCount = 0;     // Tracks consecutive closed frames
    let openCountAfter = 0;  // Tracks open frames after closure
    let blinkDetected = false;

    // Analyze the buffer for open-close-open pattern
    for (let i = 0; i < earBuffer.length; i++) {
        const currentEAR = earBuffer[i];
        if (currentEAR < BLINK_THRESHOLD) {
            // Eyes are closed
            closedCount++;
            // if closed for long, reset the counter
            if (closedCount > 3 * MIN_CLOSED_FRAMES) closedCount = 0;
            // Check if we had enough open frames before
            if (openCountBefore >= MIN_OPEN_FRAMES) {
                openCountAfter = 0; // Start tracking post-closure open frames
            }
        } else {
            // Eyes are open
            if (openCountBefore >= MIN_OPEN_FRAMES && closedCount >= MIN_CLOSED_FRAMES) {
                openCountAfter++;
                if (openCountAfter >= MIN_OPEN_FRAMES) {
                    // Blink pattern detected
                    blinkDetected = true;
                    break;
                }
            } else {
                // Track pre-closure open frames
                openCountBefore++;
                closedCount = 0;
            }
        }
    }
    return blinkDetected;
}


export function drawLandmarksCustom(ctx, landmarks, style, indices) {
    ctx.fillStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    let index = 0;
    for (const landmark of landmarks) {
        if (indices) {
            if (indices.includes(index)) {
                ctx.beginPath();
                ctx.arc(landmark.x, landmark.y, style.raduis, 0, 2 * Math.PI);
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            ctx.arc(landmark.x, landmark.y, style.raduis, 0, 2 * Math.PI);
            ctx.fill();
        }
        index += 1;
    }
}

// ############################## YAW  #######################################
function line(ctx, x1, y1, x2, y2, thickness, color) {
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
}


function polyfit(x, y, degree) {
    var xMatrix = [];
    var xTemp = [];
    var yMatrix = numeric.transpose([y]);
    for (let j = 0; j < x.length; j++) {
        xTemp = [];
        for (let i = 0; i <= degree; i++) {
            xTemp.push(1 * Math.pow(x[j], i));
        }
        xMatrix.push(xTemp);
    }
    var xMatrixT = numeric.transpose(xMatrix);
    var dot1 = numeric.dot(xMatrixT, xMatrix);
    var dotInv = numeric.inv(dot1);
    var dot2 = numeric.dot(xMatrixT, yMatrix);
    var [b, m] = numeric.dot(dotInv, dot2);
    return [b[0], m[0]];
}

function draw_horizontal_face_line(ctx, points, offset, color) {
    // sort points based on their x value
    points = points.sort((a, b) => {
        return a[0] - b[0];
    });
    var x = [];
    var y = [];
    for (const pnt of points) {
        x.push(pnt[0]);
        y.push(pnt[1]);
    }
    // find the coefficients for the best fit line on x and y
    var [b, m] = polyfit(x, y, 1);
    // find the extream points and draw the line
    const [x1, x2] = [Math.min(...x) - offset, Math.max(...x) + offset];
    const [y1, y2] = [Math.abs(parseInt((m * x1) + b)), Math.abs(parseInt((m * x2) + b))];
    line(ctx, x1, y1, x2, y2, 2, color);
}

// function to get the sum of eucledian distances between all the points
function get_distance(points) {
    // sort points based on their x value
    points = points.sort((a, b) => {
        return a[0] - b[0];
    });
    var distance = 0
    for (let i = 0; i < points.length - 1; i++) {
        distance += Math.sqrt(((points[i + 1][0] - points[i][0]) ** 2) + ((points[i + 1][1] - points[i][1]) ** 2))
    }
    return distance
}


export function detectYaw(ctx, landmarks_list, right_face_indices, left_face_indices, image_width, image_height, vis) {
    var right_face_points = [];
    var left_face_points = [];
    var index = 0;
    for (const landmark_px of landmarks_list) {
        // const landmark_px = normalized_to_pixel_coordinates(landmark.x, landmark.y, image_width, image_height)
        if (right_face_indices.includes(index)) {
            right_face_points.push([landmark_px.x, landmark_px.y])
        } else if (left_face_indices.includes(index)) {
            left_face_points.push([landmark_px.x, landmark_px.y])
        }
        index += 1;
    }
    var scaled_value = -1;
    if (right_face_points.length > 0 && left_face_points.length > 0) {
        var d1 = get_distance(left_face_points);
        var d2 = get_distance(right_face_points);
        var d = d1 + d2;
        const [x_min, x_max] = [parseInt(image_width * 0.55), parseInt(image_width * 0.95)]
        // scale the distances to image height
        const scale_factor = (d !== 0) ? ((x_max - x_min) / d) : 1
        var center_scaled = parseInt(d1 * scale_factor) + x_min
        center_scaled = Math.max(x_min, Math.min(center_scaled, x_max))
        // const pointer = [center_scaled, 33]
        // scaled_value = Math.round((2 * ((center_scaled - x_min) / (x_max - x_min))) - 1, 2)
        scaled_value = (2 * ((center_scaled - x_min) / (x_max - x_min))) - 1
        if (vis) {
            // draw horizontal face line
            draw_horizontal_face_line(ctx, [...right_face_points, ...left_face_points], d / 2, 'cyan')
        }
    }
    return scaled_value * 90;
}


// ############################## ROLL  #######################################
export function detectRoll(landmarks_list, roll_indices) {
    var x = []
    var y = []
    var index = 0;
    for (const landmark_px of landmarks_list) {
        // const landmark_px = normalized_to_pixel_coordinates(landmark.x, landmark.y, image_width, image_height);
        if (roll_indices.includes(index)) {
            x.push(landmark_px.x);
            y.push(landmark_px.y);
        }
        index += 1;
    }

    var angle = 90;
    if (x.length > 0 && y.length > 0) {
        var [b, m] = polyfit(x, y, 1)

        const [y1, y2] = [Math.max(...y), Math.min(...y)]
        const [x1, x2] = [parseInt((y1 - b) / m), parseInt((y2 - b) / m)]

        // compute the angle between the eye centroids
        const dY = y2 - y1
        const dX = x2 - x1
        angle = (Math.atan2(dY, dX) * 180 / Math.PI) + 180;
    }
    return parseInt(angle) - 90;
}


// ############################## PITCH  #######################################
// function used to draw connections
function draw_connections(ctx, connections, thickness, color) {
    for (let i = 0; i < PITCH_CONNECTIONS_indices.length - 1; i++) {
        var pnt1 = connections[PITCH_CONNECTIONS_indices[i]];
        var pnt2 = connections[PITCH_CONNECTIONS_indices[i + 1]];
        line(ctx, pnt1[0], pnt1[1], pnt2[0], pnt2[1], thickness, color);
    }
}

// finding the statistical mean of an array of points
function mean(points) {
    const meanX = sum(getCol(points, 0)) / points.length
    const meanY = sum(getCol(points, 1)) / points.length
    return [meanX, meanY]
}

// get the nth column in a matrix
function getCol(matrix, col) {
    var column = [];
    for (var i = 0; i < matrix.length; i++) {
        column.push(matrix[i][col]);
    }
    return column; // return column data..
}

// find the sum of an array
function sum(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
        sum += arr[i]; //don't forget to add the base
    }
    return sum;
}

export function detectPitch(ctx, landmarks_list, eyEYES_CENTER_indices, chain_indices, nose_indices, image_width, image_height, vis) {
    var eyes_points = []
    var chain_points = []
    var nose_points = []
    var connections = {}
    var index = 0;
    for (const landmark_px of landmarks_list) {
        // const landmark_px = normalized_to_pixel_coordinates(landmark.x, landmark.y, image_width, image_height)

        if (PITCH_CONNECTIONS_indices.includes(index)) {
            connections[index] = [landmark_px.x, landmark_px.y];
        }
        if (eyEYES_CENTER_indices.includes(index)) {
            eyes_points.push([landmark_px.x, landmark_px.y])
        } else if (chain_indices.includes(index)) {
            chain_points.push([landmark_px.x, landmark_px.y])
        } else if (nose_indices.includes(index)) {
            nose_points.push([landmark_px.x, landmark_px.y])
        }
        index += 1;
    }

    var eyEYES_CENTER = mean(eyes_points);
    var nose_center = mean(nose_points);
    var chain_center = mean(chain_points);

    var scaled_value = -1;
    if (eyes_points.length > 0 && chain_points.length > 0 && nose_points.length > 0) {

        var d1 = (nose_center[1] - eyEYES_CENTER[1])
        var d2 = (chain_center[1] - nose_center[1])
        const [y_min, y_max] = [parseInt(image_height * 0.55), parseInt(image_height * 0.95)]

        // scale the distances to image height
        const scale_factor = (y_max - y_min) / (d1 + d2)

        var nose_center_scaled = parseInt(d1 * scale_factor) + y_min
        scaled_value = (2 * ((nose_center_scaled - y_max) / (y_min - y_max))) - 1

        if (vis) {
            // draw connections
            draw_connections(ctx, connections, 3, 'cyan');
        }
    }
    return scaled_value * 90;
}

export async function mergeConfig(config_default, style_default, config_user) {
    const config_mapping = {
        "isfrcam": "is_front_camera",
        "camId": "camera_id",
        "camera_source": "camera_source",
        "cam_res": "max_camera_res",
        "c2bt": "time_to_blink",
        "det_conf": "min_face_detection_conf",
        "fc_ar_thresh": "face_area_thres",
        "multi_fces": "allow_multiple_faces",
        "p_thresh": "pitch_thresh",
        "y_thresh": "yaw_thresh",
        "r_thresh": "roll_thresh",
        "be_frms": "blink_eye_frames",
        "be_win": "blink_window_size",
        "max_fces": "max_number_faces",
        "trck_conf": "min_tracking_conf",
        "indices": "indices",
        "be_thresh": "blink_eye_thresh",
        "enc_key": "enc_key",
        "dec_key": "dec_key",
        "encrypt": "encrypt",
    }

    const style_mapping = {
        "VIS": "vis",
        "DOC_COLOR": "doc_color",
        "DOC_OPACITY": "doc_opacity",
        "HOLE_HEIGHT": "hole_height",
        "HOLE_WIDTH": "hole_width",
        "FACE_COLOR_SUCESS": "face_color_success",
        "FACE_COLOR_FAIL": "face_color_fail",
        "FONT_SIZE": "font_size",
    }

    let config = {};
    for (let key in config_mapping) {
        if ("config" in config_user && config_mapping[key] in config_user.config) {
            config[key] = config_user.config[config_mapping[key]];
        } else {
            config[key] = config_default[key];
        }
    }

    for (let key in style_mapping) {
        if ("style" in config_user && style_mapping[key] in config_user.style) {
            config[key] = config_user.style[style_mapping[key]];
        } else {
            config[key] = style_default[key];
        }
    }

    if ("config" in config_user) config["containerId"] = config_user.config["containerId"];
    // add callbacks as it as
    config["onCaptureComplete"] = config_user["onCaptureComplete"];
    config["onError"] = config_user["onError"];
    config["onClose"] = config_user["onClose"];
    return config;
}


export async function drawHole(videoElement, config, borderColor, message) {
    const canvas = document.getElementById('holeCanvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw a semi-transparent overlay
    // ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillStyle = config.DOC_COLOR;
    ctx.globalAlpha = config.DOC_OPACITY;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Define the oval dimensions and position
    const ovalHeight = canvas.height * config.HOLE_HEIGHT;
    const ovalWidth = ovalHeight * config.HOLE_WIDTH;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Clear an oval in the center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    // Reset global composite operation for the border
    ctx.globalCompositeOperation = 'source-over';

    // Draw the border around the oval
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 10; // Border thickness
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
    ctx.stroke();

    // Add text at the top of the canvas
    let fontSize = config.FONT_SIZE;
    if (!fontSize) {
        const fontScale = 0.03; // Adjust this value to control the relative font size
        fontSize = Math.round(canvas.height * fontScale); // Calculate font size based on canvas width    
    }
    ctx.fillStyle = borderColor;
    ctx.font = `${fontSize}px Arial`; // Apply responsive font size
    ctx.textAlign = "center"; // Center the text horizontally

    // const ovalTop = centerY - (ovalHeight / 2);
    ctx.fillText(message, canvas.width / 2, canvas.height * 0.05); // Position text near the top
    // ctx.fillText(message, canvas.width / 2, canvas.height * 0.92); // Position text near the top
    const hole = [centerX, centerY, ovalWidth, ovalHeight];
    return hole;
}

export function loadScripts(scriptUrls) {
    const promises = scriptUrls.map((url) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => resolve(url);
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    });
    return Promise.all(promises);
}

export async function getWorkingCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // Filter to only video input devices
    const videoDevices = devices.filter(device => device.kind === "videoinput");
    const workingCameras = [];
    for (const device of videoDevices) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: device.deviceId } },
            });
            const video = document.createElement("video");
            video.srcObject = stream;
            video.muted = true; // Mute to avoid audio playback
            video.playsInline = true; // Prevent fullscreen on mobile devices
            video.play();
            const isPlaying = await new Promise((resolve, reject) => {
                video.onplaying = () => resolve(true);
                video.onerror = () => reject(new Error("Preview not available"));
            });
            if (isPlaying) {
                workingCameras.push({
                    label: device.label,
                    deviceId: device.deviceId,
                });
            }
            stream.getTracks().forEach(track => track.stop());
        } catch (error) { }
    }
    return workingCameras;
}