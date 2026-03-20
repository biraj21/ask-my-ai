const shadowStyleSheetCache = new Map<string, CSSStyleSheet>();

function supportsAdoptedStyleSheets(shadowRoot: ShadowRoot): shadowRoot is ShadowRoot & {
  adoptedStyleSheets: CSSStyleSheet[];
} {
  return "adoptedStyleSheets" in shadowRoot && typeof CSSStyleSheet !== "undefined";
}

export function applyShadowStyles(shadowRoot: ShadowRoot, cssText: string) {
  if (supportsAdoptedStyleSheets(shadowRoot) && "replaceSync" in CSSStyleSheet.prototype) {
    let styleSheet = shadowStyleSheetCache.get(cssText);

    if (!styleSheet) {
      styleSheet = new CSSStyleSheet();
      styleSheet.replaceSync(cssText);
      shadowStyleSheetCache.set(cssText, styleSheet);
    }

    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, styleSheet];
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.textContent = cssText;
  shadowRoot.prepend(styleElement);
}

export function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((html, [key, value]) => {
    return html.replaceAll(`__${key}__`, value);
  }, template);
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
