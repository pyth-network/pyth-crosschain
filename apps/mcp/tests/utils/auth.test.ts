import type { Config } from "../../src/config.js";
import { assertNoServerKey, resolveAccessToken } from "../../src/utils/auth.js";

const baseConfig: Config = {
  channel: "fixed_rate@200ms",
  historyUrl: "https://pyth.dourolabs.app",
  logLevel: "info",
  requestTimeoutMs: 10_000,
  routerUrl: "https://pyth-lazer.dourolabs.app",
};

describe("resolveAccessToken", () => {
  it("prefers the per-call token over the env key", () => {
    expect(
      resolveAccessToken("per-call", { ...baseConfig, accessToken: "env" }),
    ).toBe("per-call");
  });

  it("falls back to the env key", () => {
    expect(
      resolveAccessToken(undefined, { ...baseConfig, accessToken: "env" }),
    ).toBe("env");
  });

  it("returns undefined when neither is set", () => {
    expect(resolveAccessToken(undefined, baseConfig)).toBeUndefined();
  });
});

describe("assertNoServerKey", () => {
  it("passes when no server-side key is configured", () => {
    expect(() => assertNoServerKey(baseConfig)).not.toThrow();
  });

  it("throws when PYTH_PRO_ACCESS_TOKEN is set", () => {
    expect(() =>
      assertNoServerKey({ ...baseConfig, accessToken: "shared-key" }),
    ).toThrow("PYTH_PRO_ACCESS_TOKEN must not be set in HTTP mode");
  });

  it("does not echo the key in the error message", () => {
    expect(() =>
      assertNoServerKey({ ...baseConfig, accessToken: "shared-key" }),
    ).not.toThrow("shared-key");
  });
});
