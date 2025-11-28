/**
 * type-guards your input parameter
 * and checks if it is null or undefined,
 * and returns true if it is
 */
export function isNullOrUndefined(thing: unknown): thing is null | undefined {
  return thing === null || thing === undefined;
}
