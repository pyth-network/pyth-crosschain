import { tokensToString, stringToTokens } from "./tokens";

const BIDIRECTIONAL_TESTS = [
  [1n, "0.000001"],
  [10n, "0.00001"],
  [100n, "0.0001"],
  [1000n, "0.001"],
  [10_000n, "0.01"],
  [100_000n, "0.1"],
  [1_000_000n, "1"],
  [10_000_000n, "10"],
  [11_000_000n, "11"],
  [11_100_000n, "11.1"],
  [11_110_000n, "11.11"],
  [11_111_000n, "11.111"],
  [11_111_100n, "11.1111"],
  [11_111_110n, "11.11111"],
  [11_111_111n, "11.111111"],
  [11_011_111n, "11.011111"],
  [11_001_111n, "11.001111"],
  [11_000_111n, "11.000111"],
  [11_000_011n, "11.000011"],
  [11_000_001n, "11.000001"],
] as const;

const STRING_TO_TOKENS_ONLY_TESTS = [
  [".1", 100_000n],
  [".11", 110_000n],
  ["0.00000111", 1n],
  ["11.0000011", 11_000_001n],
] as const;

const INVALID_STRING_TESTS = ["foo", "10bar", "1.5baz", "biz.54"];

describe("tokensToString", () => {
  BIDIRECTIONAL_TESTS.map(([input, output]) => {
    describe(`with "${input.toString()}"`, () => {
      it(`returns "${output}"`, () => {
        expect(tokensToString(input)).toEqual(output);
      });
    });
  });
});

describe("stringToTokens", () => {
  BIDIRECTIONAL_TESTS.map(([output, input]) => {
    describe(`with "${input}"`, () => {
      it(`returns "${output.toString()}"`, () => {
        expect(stringToTokens(input)).toEqual(output);
      });
    });
  });

  STRING_TO_TOKENS_ONLY_TESTS.map(([input, output]) => {
    describe(`with "${input}"`, () => {
      it(`returns "${output.toString()}"`, () => {
        expect(stringToTokens(input)).toEqual(output);
      });
    });
  });

  INVALID_STRING_TESTS.map((str) => {
    describe(`with "${str}"`, () => {
      it(`returns undefined`, () => {
        expect(stringToTokens(str)).toBeUndefined();
      });
    });
  });
});
