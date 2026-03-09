import {
  redactAuthHeader,
  redactSecrets,
  safeForLog,
} from "../../src/utils/redact.js";

describe("redactSecrets", () => {
  it("redacts access_token", () => {
    const out = redactSecrets({ access_token: "sk_secret123" });
    expect(out.access_token).toBe("[REDACTED]");
  });

  it("redacts nested accessToken", () => {
    const out = redactSecrets({ payload: { accessToken: "pk_xxx" } });
    expect(out.payload.accessToken).toBe("[REDACTED]");
  });

  it("preserves non-secret keys", () => {
    const out = redactSecrets({ query: "BTC", limit: 50 });
    expect(out.query).toBe("BTC");
    expect(out.limit).toBe(50);
  });

  it("does not redact keys that merely contain secret-like substrings", () => {
    const out = redactSecrets({
      author: "Alice",
      authority: "admin",
      token_count: 42,
    });
    expect(out.author).toBe("Alice");
    expect(out.authority).toBe("admin");
    expect(out.token_count).toBe(42);
  });

  it("handles arrays", () => {
    const out = redactSecrets([{ access_token: "x" }, { id: 1 }]);
    expect(out[0].access_token).toBe("[REDACTED]");
    expect(out[1].id).toBe(1);
  });

  it("handles null and undefined", () => {
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(undefined)).toBe(undefined);
  });
});

describe("redactAuthHeader", () => {
  it("redacts Bearer token", () => {
    expect(redactAuthHeader("Bearer sk_abc123")).toBe("Bearer [REDACTED]");
  });

  it("handles empty", () => {
    expect(redactAuthHeader(undefined)).toBe("");
    expect(redactAuthHeader("")).toBe("");
  });
});

describe("safeForLog", () => {
  it("redacts token-like strings", () => {
    expect(safeForLog("sk_abcdef")).toBe("[REDACTED]");
    expect(safeForLog("pk_abcdef")).toBe("[REDACTED]");
    expect(safeForLog("Bearer xyz")).toBe("[REDACTED]");
  });

  it("does not redact pk_ or Bearer when embedded mid-string", () => {
    expect(safeForLog("error: invalid pk_xxx")).toBe("error: invalid pk_xxx");
    expect(safeForLog("no Bearer here")).toBe("no Bearer here");
  });

  it("passes through safe strings", () => {
    expect(safeForLog("hello")).toBe("hello");
    expect(safeForLog("error message")).toBe("error message");
  });

  it("redacts objects recursively", () => {
    const out = safeForLog({ access_token: "sk_x", foo: "bar" }) as Record<
      string,
      string
    >;
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.foo).toBe("bar");
  });
});
