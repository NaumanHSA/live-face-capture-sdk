import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const copyPlugin = copy({
  targets: [
    { src: "src/assets/assets/*", dest: "dist/assets" },
    { src: "src/assets/libs/*", dest: "dist/libs" },
    { src: "src/assets/models/face_attrib_net-onnx-w8a8/*", dest: "dist/models/face_attrib_net-onnx-w8a8" },
    { src: "src/assets/models/face_attrib_net-onnx-float/*",  dest: "dist/models/face_attrib_net-onnx-float"  },
  ],
});

export default [
  // Main SDK bundle (ESM + UMD)
  {
    input: "src/index.js",
    output: [
      { file: "dist/live-face-capture.esm.js", format: "es", exports: "named", sourcemap: true },
      { file: "dist/live-face-capture.umd.js", format: "umd", name: "LiveFaceCapture", exports: "named", sourcemap: true },
    ],
    plugins: [terser(), copyPlugin],
  },

  // Visualization worker (IIFE — runs inside a Web Worker, no module system needed)
  {
    input: "src/draw/visWorker.js",
    output: { file: "dist/vis-worker.js", format: "iife", sourcemap: false },
    plugins: [terser()],
  },

  // Face attribute inference worker (IIFE — classic worker, loads ORT via importScripts)
  {
    input: "src/faceAttr/faceAttrWorker.js",
    output: { file: "dist/face-attr-worker.js", format: "iife", sourcemap: false },
    plugins: [terser()],
  },
];
