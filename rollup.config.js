import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: "src/index.js",
  output: [
    { file: "dist/live-face-capture.esm.js", format: "es", sourcemap: true },
    { file: "dist/live-face-capture.umd.js", format: "umd", name: "LiveFaceCapture", sourcemap: true },
  ],
  plugins: [
    terser(),
    copy({
      targets: [
        { src: "src/assets/assets/*", dest: "dist/assets" },
        { src: "src/assets/libs/*", dest: "dist/libs" },
      ],
    }),
  ],
};
