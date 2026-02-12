import { Session } from "./session/Session.js";

export function createLiveFaceCapture() {
  const session = new Session();
  return {
    open: (config) => session.open(config),
    close: () => session.close(),
    getState: () => session.getState(),
  };
}

const singleton = createLiveFaceCapture();

const LiveFaceCapture = {
  open(config) {
    return singleton.open(config);
  },
  close() {
    return singleton.close();
  },
  getState() {
    return singleton.getState();
  },
};

export default LiveFaceCapture;
