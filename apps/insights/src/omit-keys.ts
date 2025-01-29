export const omitKeys = <T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
) => {
  const omitSet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !omitSet.has(key)),
  );
};
