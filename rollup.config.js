import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';


export default {
    input: 'src/index.js',        // Entry point
    output: [
        {
            file: 'dist/live-face-capture.js',  // Output for development
            format: 'umd',               // Universal Module Definition
            name: 'LiveFaceCapture',            // Global variable for browser
        },
        {
            file: 'dist/live-face-capture.min.js', // Minified output
            format: 'umd',
            name: 'LiveFaceCapture',
            plugins: [terser()]
        },
    ],
    // plugins: [
    //     copy({
    //         targets: [
    //             { src: 'src/assets/*', dest: 'dist/assets' }, // Copy all files in assets folder
    //         ],
    //     }),
    // ],
};