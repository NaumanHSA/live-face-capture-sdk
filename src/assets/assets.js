const currentURL = new URL(".", import.meta.url);

export function assetUrl(config, rel) {
  // allow user to host assets on CDN
  const base = config.assetBaseUrl ? new URL(config.assetBaseUrl) : currentURL;
  return new URL(rel, base).href;
}
