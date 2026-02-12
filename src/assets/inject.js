export function injectStylesheetOnce(href, key) {
  const attr = `data-lfc-${key}`;
  if (document.querySelector(`link[${attr}]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(attr, "1");
  document.head.appendChild(link);
}
