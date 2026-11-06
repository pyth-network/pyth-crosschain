/* eslint-disable @typescript-eslint/no-non-null-assertion */
function camelToSnakeCase(str: string): string {
  return str.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function camelToSnakeCaseObject(
  obj: Record<string, string | boolean>,
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const key of Object.keys(obj)) {
    const newKey = camelToSnakeCase(key);
    const val = obj[key];
    result[newKey] = val!;
  }
  return result;
}

export function mergeHeaders(
  ...sources: (HeadersInit | undefined)[]
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    if (typeof Headers !== "undefined" && source instanceof Headers) {
      source.forEach((val, key) => {
        merged[key.toLowerCase()] = val;
      });
    } else if (Array.isArray(source)) {
      for (const [key, val] of source) {
        if (key) merged[key.toLowerCase()] = String(val);
      }
    } else if (typeof source === "object") {
      for (const [key, val] of Object.entries(source)) {
        if (val !== undefined && val !== null) {
          merged[key.toLowerCase()] = String(val);
        }
      }
    }
  }
  return merged;
}
