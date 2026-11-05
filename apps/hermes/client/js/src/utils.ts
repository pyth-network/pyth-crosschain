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

/**
 * Merges several `HeadersInit` values into a single `Headers` object. Later
 * sources take precedence over earlier ones. Unlike object spread, this
 * supports every `HeadersInit` form (plain objects, `Headers` instances and
 * arrays of name/value pairs).
 */
export function mergeHeaders(...sources: (HeadersInit | undefined)[]): Headers {
  const result = new Headers();
  for (const source of sources) {
    if (source !== undefined) {
      for (const [key, value] of new Headers(source)) {
        result.set(key, value);
      }
    }
  }
  return result;
}
