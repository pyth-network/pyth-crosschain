import { CHANGELOG_PRODUCTS } from "../../lib/changelog";
import { parseListParam } from "./facets";

describe("parseListParam", () => {
  it("returns an empty list for null or empty input", () => {
    expect(parseListParam(null, CHANGELOG_PRODUCTS)).toEqual([]);
    expect(parseListParam("", CHANGELOG_PRODUCTS)).toEqual([]);
  });

  it("keeps only allowed values, preserving order", () => {
    expect(parseListParam("entropy,pyth-pro", CHANGELOG_PRODUCTS)).toEqual([
      "entropy",
      "pyth-pro",
    ]);
  });

  it("drops values outside the allowed set", () => {
    expect(parseListParam("pyth-pro,bogus", CHANGELOG_PRODUCTS)).toEqual([
      "pyth-pro",
    ]);
  });
});
