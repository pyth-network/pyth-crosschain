export type ConstrainedOmit<T, K> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T as Exclude<P, K & keyof any>]: T[P];
};
