export async function drawHole(root, videoElement, config, borderColor, message) {
  const canvas = root.querySelector('[data-lfc="holeCanvas"]');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = config.DOC_COLOR;
  ctx.globalAlpha = config.DOC_OPACITY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ovalHeight = canvas.height * config.HOLE_HEIGHT;
  const ovalWidth = ovalHeight * config.HOLE_WIDTH;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
  ctx.stroke();

  let fontSize = config.FONT_SIZE;
  if (!fontSize) fontSize = Math.round(canvas.height * 0.03);
  ctx.fillStyle = borderColor;
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.globalAlpha = 1;
  ctx.fillText(message, canvas.width / 2, canvas.height * 0.05);

  return [centerX, centerY, ovalWidth, ovalHeight];
}



// export async function drawHole(videoElement, config, borderColor, message) {
//     const canvas = document.getElementById('holeCanvas');
//     canvas.width = videoElement.videoWidth;
//     canvas.height = videoElement.videoHeight;
//     const ctx = canvas.getContext('2d');

//     // Draw a semi-transparent overlay
//     // ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
//     ctx.fillStyle = config.DOC_COLOR;
//     ctx.globalAlpha = config.DOC_OPACITY;
//     ctx.fillRect(0, 0, canvas.width, canvas.height);

//     // Define the oval dimensions and position
//     const ovalHeight = canvas.height * config.HOLE_HEIGHT;
//     const ovalWidth = ovalHeight * config.HOLE_WIDTH;
//     const centerX = canvas.width / 2;
//     const centerY = canvas.height / 2;

//     // Clear an oval in the center
//     ctx.globalCompositeOperation = 'destination-out';
//     ctx.beginPath();
//     ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
//     ctx.fill();
//     // Reset global composite operation for the border
//     ctx.globalCompositeOperation = 'source-over';

//     // Draw the border around the oval
//     ctx.strokeStyle = borderColor;
//     ctx.lineWidth = 10; // Border thickness
//     ctx.beginPath();
//     ctx.ellipse(centerX, centerY, ovalWidth / 2, ovalHeight / 2, 0, 0, 2 * Math.PI);
//     ctx.stroke();

//     // Add text at the top of the canvas
//     let fontSize = config.FONT_SIZE;
//     if (!fontSize) {
//         const fontScale = 0.03; // Adjust this value to control the relative font size
//         fontSize = Math.round(canvas.height * fontScale); // Calculate font size based on canvas width    
//     }
//     ctx.fillStyle = borderColor;
//     ctx.font = `${fontSize}px Arial`; // Apply responsive font size
//     ctx.textAlign = "center"; // Center the text horizontally

//     // const ovalTop = centerY - (ovalHeight / 2);
//     ctx.fillText(message, canvas.width / 2, canvas.height * 0.05); // Position text near the top
//     // ctx.fillText(message, canvas.width / 2, canvas.height * 0.92); // Position text near the top
//     const hole = [centerX, centerY, ovalWidth, ovalHeight];
//     return hole;
// }
