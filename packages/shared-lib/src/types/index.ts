/**
 * type that allows for either the type of the value
 * you desired, or falls back to null or undefined.
 * useful to indicate whether or not something is considered
 * optional.
 */
export type Nullish<T> = T | null | undefined;
