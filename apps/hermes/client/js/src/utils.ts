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
