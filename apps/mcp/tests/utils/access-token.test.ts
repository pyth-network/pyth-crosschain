import {
  accessTokenSchema,
  clientTokenFromEnv,
  clientTokenFromHeader,
  resolveAccessToken,
} from "../../src/utils/access-token.js";

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

describe("clientTokenFromHeader", () => {
  it("is undefined when the client sends no Authorization header", () => {
    expect(clientTokenFromHeader(undefined)).toBeUndefined();
  });

  it.each([
    ["Bearer abc.DEF-123"],
    ["bearer abc.DEF-123"],
    ["  Bearer   abc.DEF-123  "],
  ])("reads the token from %j", (header) => {
    expect(clientTokenFromHeader(header)).toEqual({
      kind: "token",
      source: "http_header",
      token: "abc.DEF-123",
    });
  });

  it("uses the first value when the header is repeated", () => {
    expect(clientTokenFromHeader(["Bearer one", "Bearer two"])).toMatchObject({
      token: "one",
    });
  });

  it.each([
    ["no scheme", "abc123"],
    ["another scheme", "Basic abc123"],
    ["a space inside the token", "Bearer abc 123"],
    ["an empty token", "Bearer "],
  ])("reports %s without echoing the value", (_label, header) => {
    const result = clientTokenFromHeader(header);
    expect(result?.kind).toBe("invalid");
    expect(JSON.stringify(result)).not.toContain("abc");
    expect(JSON.stringify(result)).toContain("Authorization header");
  });
});

describe("clientTokenFromEnv", () => {
  it("is undefined when unset or blank", () => {
    expect(clientTokenFromEnv(undefined)).toBeUndefined();
    expect(clientTokenFromEnv("  ")).toBeUndefined();
  });

  it("reads and trims the token", () => {
    expect(clientTokenFromEnv(" abc123\n")).toEqual({
      kind: "token",
      source: "stdio_env",
      token: "abc123",
    });
  });

  it("reports a token with a space inside without echoing it", () => {
    const result = clientTokenFromEnv("abc 123");
    expect(result?.kind).toBe("invalid");
    expect(JSON.stringify(result)).not.toContain("abc");
  });
});

describe("resolveAccessToken", () => {
  const configured = clientTokenFromHeader("Bearer from-client");
  const broken = clientTokenFromHeader("Basic nope");

  it("prefers the token passed on the call", () => {
    expect(resolveAccessToken("from-call", configured)).toEqual({
      source: "call",
      token: "from-call",
    });
  });

  it("falls back to the client-configured token", () => {
    expect(resolveAccessToken(undefined, configured)).toEqual({
      source: "http_header",
      token: "from-client",
    });
  });

  it("reports a malformed client token only when the call has none", () => {
    expect(resolveAccessToken(undefined, broken).error).toContain(
      "Authorization header",
    );
    expect(resolveAccessToken("from-call", broken)).toEqual({
      source: "call",
      token: "from-call",
    });
  });

  it("has no token when neither is set", () => {
    expect(resolveAccessToken(undefined, undefined)).toEqual({});
  });
});
