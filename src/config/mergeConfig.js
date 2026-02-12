import { config_default, styles_default } from "./defaults.js";

export async function mergeConfig(config_user) {
  const c = config_user?.config ?? {};
  const s = config_user?.style ?? {};

  const mapC = {
    isfrcam: "is_front_camera",
    camId: "camera_id",
    camera_source: "camera_source",
    cam_res: "max_camera_res",
    c2bt: "time_to_blink",
    det_conf: "min_face_detection_conf",
    fc_ar_thresh: "face_area_thres",
    multi_fces: "allow_multiple_faces",
    p_thresh: "pitch_thresh",
    y_thresh: "yaw_thresh",
    r_thresh: "roll_thresh",
    be_frms: "blink_eye_frames",
    be_win: "blink_window_size",
    max_fces: "max_number_faces",
    trck_conf: "min_tracking_conf",
    indices: "indices",
    be_thresh: "blink_eye_thresh",
    enc_key: "enc_key",
    dec_key: "dec_key",
    encrypt: "encrypt",
    assetBaseUrl: "assetBaseUrl",
    inferenceFps: "inferenceFps",
  };

  const mapS = {
    VIS: "vis",
    DOC_COLOR: "doc_color",
    DOC_OPACITY: "doc_opacity",
    HOLE_HEIGHT: "hole_height",
    HOLE_WIDTH: "hole_width",
    FACE_COLOR_SUCESS: "face_color_success",
    FACE_COLOR_FAIL: "face_color_fail",
    FONT_SIZE: "font_size",
  };

  const out = {};
  for (const k in mapC) out[k] = (mapC[k] in c) ? c[mapC[k]] : config_default[k];
  for (const k in mapS) out[k] = (mapS[k] in s) ? s[mapS[k]] : styles_default[k];

  out.containerId = c.containerId ?? null;

  out.onCaptureComplete = config_user?.onCaptureComplete;
  out.onError = config_user?.onError;
  out.onClose = config_user?.onClose;

  return out;
}


// export async function mergeConfig(config_default, style_default, config_user) {
//     const config_mapping = {
//         "isfrcam": "is_front_camera",
//         "camId": "camera_id",
//         "camera_source": "camera_source",
//         "cam_res": "max_camera_res",
//         "c2bt": "time_to_blink",
//         "det_conf": "min_face_detection_conf",
//         "fc_ar_thresh": "face_area_thres",
//         "multi_fces": "allow_multiple_faces",
//         "p_thresh": "pitch_thresh",
//         "y_thresh": "yaw_thresh",
//         "r_thresh": "roll_thresh",
//         "be_frms": "blink_eye_frames",
//         "be_win": "blink_window_size",
//         "max_fces": "max_number_faces",
//         "trck_conf": "min_tracking_conf",
//         "indices": "indices",
//         "be_thresh": "blink_eye_thresh",
//         "enc_key": "enc_key",
//         "dec_key": "dec_key",
//         "encrypt": "encrypt",
//     }

//     const style_mapping = {
//         "VIS": "vis",
//         "DOC_COLOR": "doc_color",
//         "DOC_OPACITY": "doc_opacity",
//         "HOLE_HEIGHT": "hole_height",
//         "HOLE_WIDTH": "hole_width",
//         "FACE_COLOR_SUCESS": "face_color_success",
//         "FACE_COLOR_FAIL": "face_color_fail",
//         "FONT_SIZE": "font_size",
//     }

//     let config = {};
//     for (let key in config_mapping) {
//         if ("config" in config_user && config_mapping[key] in config_user.config) {
//             config[key] = config_user.config[config_mapping[key]];
//         } else {
//             config[key] = config_default[key];
//         }
//     }

//     for (let key in style_mapping) {
//         if ("style" in config_user && style_mapping[key] in config_user.style) {
//             config[key] = config_user.style[style_mapping[key]];
//         } else {
//             config[key] = style_default[key];
//         }
//     }

//     if ("config" in config_user) config["containerId"] = config_user.config["containerId"];
//     // add callbacks as it as
//     config["onCaptureComplete"] = config_user["onCaptureComplete"];
//     config["onError"] = config_user["onError"];
//     config["onClose"] = config_user["onClose"];
//     return config;
// }
