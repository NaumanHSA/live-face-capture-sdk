import { initializeCapture,  shutDown} from './core.js';


const LiveFaceCapture = {
    open(config) {
        if (!config || typeof config !== 'object') {
            throw new Error("Invalid configuration object provided.");
        }
        // Initialize the capture process
        initializeCapture(config);
    },
    async close(){
        return shutDown();
    }
};

export default LiveFaceCapture;


