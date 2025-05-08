export const omitKeys = (obj: Record<string, unknown>, keys: string[]) => {
  const omitSet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !omitSet.has(key)),
  );
};
