import { accessTokenSchema } from "../../src/utils/access-token.js";

describe("accessTokenSchema", () => {
  const schema = accessTokenSchema("token");

  it("accepts a normal token and trims surrounding whitespace", () => {
    expect(schema.parse("  abc.DEF-123_xyz\n")).toBe("abc.DEF-123_xyz");
  });

  it("accepts a missing token", () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it.each([
    ["a line break", "abc\ndef"],
    ["a carriage return", "abc\r\ndef"],
    ["a NUL byte", "abc\u0000def"],
    ["a space", "abc def"],
    ["a tab", "abc\tdef"],
    ["a non-ASCII character", "abcédef"],
  ])("rejects a token containing %s", (_label, token) => {
    const result = schema.safeParse(token);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain("abc");
  });
});
