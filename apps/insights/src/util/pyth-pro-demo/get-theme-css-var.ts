const varCache: Record<string, string> = {};

/**
 * attemps to read the value of a CSS variable from the
 * available css variables.
 * if the variable doesn't exist, and error is thrown
 */
export function getThemeCssVar(varName: string) {
  const doc = globalThis.document as typeof globalThis.document | undefined;
  if (!doc?.documentElement) return;

  const val = varCache[varName];
  if (val) return val;
  const computed = getComputedStyle(doc.documentElement);
  const cssVarVal = computed.getPropertyValue(varName);

  varCache[varName] = cssVarVal;

  return cssVarVal;
}
