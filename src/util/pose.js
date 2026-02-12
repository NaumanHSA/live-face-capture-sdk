const PITCH_CONNECTIONS_indices = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 17, 18, 200, 199, 175, 152]

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

