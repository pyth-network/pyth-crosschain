export const bigintMax = (a: bigint | undefined, b: bigint | undefined) => {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return a > b ? a : b;
};
