export const config_default = {
    // General Params
    isfrcam: true,
    camId: null,
    camera_source: 0,
    cam_res: 1920,
    c2bt: 2000,   // in ms

    // maximum number of faces to be detected
    max_fces: 5,
    multi_fces: false,
    det_conf: 0.5,    // detection threshold
    trck_conf: 0.5,    // tracking threshold

    //  Thresholds Configurations // 
    // threshold for person face area relative to the oval area
    fc_ar_thresh: 0.4,

    //  set threshold for pitch index
    //  which means the value of pitch index between [-p_thresh, +p_thresh] will be considered
    //  the value of p_thresh will always be between [0,1] inclusive
    p_thresh: 15,

    //  set threshold for yaw index
    //  which means the value of yaw index between [-y_thresh, +y_thresh] will be considered
    //  the value of y_thresh will always be between [0,1] inclusive
    y_thresh: 15,

    //  set threshold for roll angle
    //  which means the value of rol angle between [-r_thresh, +r_thresh] will be considered
    //  the value of r_thresh will always be between [0,90] inclusive
    r_thresh: 10,

    // Eyes blink threshold
    be_thresh: 0.2,
    be_frms: 2,
    be_win: 30,

    indices: {
        FACE_OVAL: [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ],
        ROLL_PNTS: [6, 168, 8, 9, 151, 10],
        FACE_LEFT_PNTS: [127, 34, 143, 35, 226, 130, 33, 133, 243, 244, 245, 122, 6],
        FACE_RIGHT_PNTS: [6, 351, 465, 464, 463, 362, 263, 359, 446, 265, 372, 264, 356],
        EYES_CENTER: [6],
        FACEMESH_NOSE_TIP: [1],
        FACEMESH_CHAIN_CENTER: [18],
        FACEMESH_RIGHT_EYE_POINTS: [33, 160, 158, 133, 153, 144],
        FACEMESH_LEFT_EYE_POINTS: [362, 385, 387, 263, 373, 380],
    },

    encrypt: false,
    enc_key: `
        -----BEGIN PUBLIC KEY-----
        MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp0ocaN2pUWOw16i4FaXy
        Ab/F7vFOFAxQHd342mezUPexnwqVGazAFoc5sQBw5uTiRX3hTSmSIPnxQjG7f70u
        dgStGA6Nl0uixU9qkQFethlVY8rVJwtSTQKlwI+qApxWWBi9KYu/9DlPUeFaSjLz
        aOuj2mpKv6iQD+J9ERS48d9/kvt1s4fvnTK/uGHqNuH+kOoPTQ2eipIDN01m8/qT
        xH62cWesjio2wkIBD2NlBTmRzLyarTAQWB4/sBa5vGexnUUEvRcABO167J/DKNdl
        2s5wKaFlQiYtZ+TNZcS6kdQHAyEYuBVvbJCXRAc6gcjq0jNKauocLow7wt+HAF7H
        uwIDAQAB
        -----END PUBLIC KEY-----
    ` || null,

    dec_key: null,
};

export const styles_default = {
    //  whether to draw visualizations or not
    VIS: true,
    DOC_COLOR: "#FFFFFF",
    DOC_OPACITY: 0.8,
    // Hole params
    HOLE_HEIGHT: 0.60,    // percentage relative to the camera view height
    HOLE_WIDTH: 0.65,    // percentage relative to the hold height
    FACE_COLOR_SUCESS: "#32CD32",
    FACE_COLOR_FAIL: "#FF5733",
    FONT_SIZE: null,
};



