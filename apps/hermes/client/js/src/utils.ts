function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function camelToSnakeCaseObject(
  obj: Record<string, string | boolean>,
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  Object.keys(obj).forEach((key) => {
    result[camelToSnakeCase(key)] = obj[key];
  });
  return result;
}
