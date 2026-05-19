import { Session } from "./session/Session.js";

export function createLiveFaceCapture() {
  const session = new Session();
  return {
    open: (config) => session.open(config),
    close: () => session.close(),
    getState: () => session.getState(),
  };
}

// Convenience singleton — fine for apps that need only one instance.
export const LiveFaceCapture = createLiveFaceCapture();

export default LiveFaceCapture;
