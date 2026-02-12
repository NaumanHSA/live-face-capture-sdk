import { getWorkingCameras } from "../util/cameras.js";

export async function computeCameraConstraints(videoEl, config) {
    let isFrontCamera = !!config.isfrcam;
    let deviceId = config.camId ?? null;
    let facingMode = isFrontCamera ? "user" : "environment";

    // Resolve deviceId if numeric index passed
    if (deviceId != null) {
        const isIndex =
            typeof deviceId === "number" ||
            (typeof deviceId === "string" && /^-?\d+$/.test(deviceId));

        if (isIndex) {
            const idx = typeof deviceId === "number" ? deviceId : parseInt(deviceId, 10);
            const cams = await getWorkingCameras();
            if (!cams[idx]) throw new Error(`camera index ${idx} out of range`);
            deviceId = cams[idx].deviceId; // ✅ convert index -> real deviceId
        } else if (typeof deviceId !== "string") {
            throw new Error("camera_id must be a deviceId string or index number");
        }
    }

    // Determine max res from capabilities (best-effort)
    let tmpStream = null;
    try {
        if (deviceId) {
            tmpStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        } else {
            try {
                tmpStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } } });
            } catch {
                isFrontCamera = !isFrontCamera; // FIXED (no bitwise bug)
                facingMode = isFrontCamera ? "user" : "environment";
                tmpStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } } });
            }
        }

        const track = tmpStream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() ?? {};
        const maxWidth = caps.width?.max || 0;
        const maxHeight = caps.height?.max || 0;

        const target = Math.min(Math.max(maxWidth, maxHeight) || config.cam_res, config.cam_res);

        // portrait-aware ideal size
        const isPortrait = window.innerHeight > window.innerWidth;
        const idealW = isPortrait ? target : target;
        const idealH = isPortrait ? target : target;

        return {
            isFrontCamera,
            constraints: {
                video: {
                    width: { ideal: idealW },
                    height: { ideal: idealH },
                    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } }),
                },
                audio: false,
            },
        };
    } finally {
        if (tmpStream) tmpStream.getTracks().forEach(t => t.stop());
    }
}

export async function startCamera(videoEl, constraints) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play?.().catch(() => { });
    return stream;
}

export function stopStream(stream) {
    try { stream?.getTracks()?.forEach(t => t.stop()); } catch { }
}
