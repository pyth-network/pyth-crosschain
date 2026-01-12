import { isNullOrUndefined } from "./is-null-or-undefined.js";

/**
 * given an object that may be error-like,
 * attempts to return the most appropriate,
 * useful string representation of the error
 */
export function errorToString(error: unknown) {
  const defaultReturn = "Unknown Error";

  if (isNullOrUndefined(error)) {
    return defaultReturn;
  }

  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    // might be a JSON string.
    // let's try to parse it into an object first
    try {
      const parsed: unknown = JSON.parse(error);

      return errorToString(parsed);
    } catch {
      return error;
    }
  }
  if (typeof error === "object") {
    if (!isNullOrUndefined(error) && "error" in error) {
      return errorToString(error.error);
    }
    return JSON.stringify(error);
  }
  return defaultReturn;
}
