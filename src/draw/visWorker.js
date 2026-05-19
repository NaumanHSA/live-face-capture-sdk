// Off-thread visualization worker.
// Receives landmark + bbox data from the main thread and draws to an
// OffscreenCanvas — keeping paint calls off the main thread entirely.

let ctx = null;
let W = 0;
let H = 0;

self.onmessage = ({ data }) => {
    const { type } = data;

    if (type === "init") {
        ctx = data.canvas.getContext("2d");
        return;
    }

    if (type === "draw") {
        W = data.W;
        H = data.H;

        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);

        // Landmark dots
        ctx.fillStyle = "red";
        const lms = data.landmarks;
        const r = data.radius;
        for (let i = 0; i < lms.length; i += 2) {
            ctx.beginPath();
            ctx.arc(lms[i], lms[i + 1], r, 0, 6.2832);
            ctx.fill();
        }

        // Face bounding box
        const b = data.bbox;
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 5;
        ctx.setLineDash([15, 15]);
        ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);

        return;
    }

    if (type === "clear") {
        if (ctx) ctx.clearRect(0, 0, W, H);
    }
};
