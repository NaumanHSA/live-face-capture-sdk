export async function getWorkingCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === "videoinput");
  const working = [];

  for (const d of videoDevices) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: d.deviceId } } });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      working.push({ label: d.label, deviceId: d.deviceId });
      stream.getTracks().forEach(t => t.stop());
    } catch {}
  }
  return working;
}

// export async function getWorkingCameras() {
//     const devices = await navigator.mediaDevices.enumerateDevices();
//     // Filter to only video input devices
//     const videoDevices = devices.filter(device => device.kind === "videoinput");
//     const workingCameras = [];
//     for (const device of videoDevices) {
//         try {
//             const stream = await navigator.mediaDevices.getUserMedia({
//                 video: { deviceId: { exact: device.deviceId } },
//             });
//             const video = document.createElement("video");
//             video.srcObject = stream;
//             video.muted = true; // Mute to avoid audio playback
//             video.playsInline = true; // Prevent fullscreen on mobile devices
//             video.play();
//             const isPlaying = await new Promise((resolve, reject) => {
//                 video.onplaying = () => resolve(true);
//                 video.onerror = () => reject(new Error("Preview not available"));
//             });
//             if (isPlaying) {
//                 workingCameras.push({
//                     label: device.label,
//                     deviceId: device.deviceId,
//                 });
//             }
//             stream.getTracks().forEach(track => track.stop());
//         } catch (error) { }
//     }
//     return workingCameras;
// }