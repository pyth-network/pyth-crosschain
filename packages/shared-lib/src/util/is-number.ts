import { isNullOrUndefined } from "./is-null-or-undefined.js";

/**
 * checks an arbitrary input value and validates if it's a number.
 * properly typeguards the result for convenience
 */
export function isNumber(thing: unknown): thing is number {
  return !isNullOrUndefined(thing) && !Number.isNaN(thing);
}
