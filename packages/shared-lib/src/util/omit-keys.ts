/**
 * Given an input object, removes
 * all of the strongly-typed keys
 * from it, and returns a new object.
 *
 * The typing of the object will also
 * indicate that the keys have been removed
 */
export const omitKeys = <
  T extends Record<string, unknown>,
  K extends keyof T = keyof T,
>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete result[key];
  }
  return result as Omit<T, K>;
};
