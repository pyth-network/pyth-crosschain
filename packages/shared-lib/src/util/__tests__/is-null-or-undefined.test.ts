/* eslint-disable unicorn/no-null */
import { isNullOrUndefined } from "../is-null-or-undefined.js";

describe("isNullOrUndefined()", () => {
  it("should return true if something is null or undefined and false if otherwise", () => {
    const nil = null;
    const undef = undefined;
    const neither = { tacos: "absolutely!" };

    expect(isNullOrUndefined(nil)).toBeTruthy();
    expect(isNullOrUndefined(undef)).toBeTruthy();
    expect(isNullOrUndefined(neither)).toBeFalsy();
  });
});
