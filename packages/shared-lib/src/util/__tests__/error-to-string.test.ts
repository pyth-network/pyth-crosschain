/* eslint-disable unicorn/no-null */
import { errorToString } from "../error-to-string.js";

describe("errorToString()", () => {
  it("returns the error message for Error instances", () => {
    const error = new Error("boom");

    expect(errorToString(error)).toBe("boom");
  });

  it("returns an empty string when the Error message is empty", () => {
    // eslint-disable-next-line unicorn/error-message
    const error = new Error("");

    expect(errorToString(error)).toBe("");
  });

  it("returns the string directly for non-JSON strings", () => {
    expect(errorToString("plain error")).toBe("plain error");
  });

  it("parses JSON strings and resolves nested error fields", () => {
    const error = JSON.stringify({ error: "nested" });

    expect(errorToString(error)).toBe("nested");
  });

  it("parses JSON strings that resolve to objects", () => {
    const error = JSON.stringify({ message: "oops", code: 400 });

    expect(errorToString(error)).toBe('{"message":"oops","code":400}');
  });

  it("parses JSON strings that resolve to string literals", () => {
    const error = JSON.stringify("wrapped");

    expect(errorToString(error)).toBe("wrapped");
  });

  it("falls back to the default for JSON strings that resolve to null", () => {
    const error = JSON.stringify(null);

    expect(errorToString(error)).toBe("Unknown Error");
  });

  it("falls back to the default for JSON strings that resolve to numbers", () => {
    const error = JSON.stringify(123);

    expect(errorToString(error)).toBe("Unknown Error");
  });

  it("uses the default for undefined", () => {
    expect(errorToString(undefined)).toBe("Unknown Error");
  });

  it("Returns 'Unknown Error' for nullish values", () => {
    expect(errorToString(null)).toBe("Unknown Error");
    expect(errorToString(undefined)).toBe("Unknown Error");
  });

  it("unwraps error objects that contain an Error instance", () => {
    const wrapped = { error: new Error("wrapped error") };

    expect(errorToString(wrapped)).toBe("wrapped error");
  });

  it("returns JSON for objects without an error field", () => {
    const value = { errorMessage: "nope" };

    expect(errorToString(value)).toBe('{"errorMessage":"nope"}');
  });

  it("falls back to default for symbols", () => {
    expect(errorToString(Symbol("oops"))).toBe("Unknown Error");
  });
});
