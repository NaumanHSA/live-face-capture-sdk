// export function resolveMount(config) {
//   if (config.containerId) {
//     const el = document.getElementById(config.containerId);
//     if (!el) throw new Error(`containerId '${config.containerId}' not found`);
//     return el;
//   }
//   return document.body;
// }

export function resolveMount(config) {
  return document.body;
}

export function createRoot(mount) {
  const root = document.createElement("div");
  root.id = "root-container";
  root.className = "root-container";
  mount.appendChild(root);
  return root;
}

