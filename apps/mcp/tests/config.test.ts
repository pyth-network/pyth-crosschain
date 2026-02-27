// biome-ignore-all lint/style/noProcessEnv: test file that manipulates environment variables
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all PYTH_ env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("PYTH_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns defaults when no env vars set", () => {
    const config = loadConfig();
    expect(config.channel).toBe("fixed_rate@200ms");
    expect(config.routerUrl).toBe("https://pyth-lazer.dourolabs.app");
    expect(config.historyUrl).toBe("https://history.pyth-lazer.dourolabs.app");
    expect(config.logLevel).toBe("info");
    expect(config.requestTimeoutMs).toBe(10_000);
  });

  it("reads custom channel from env", () => {
    process.env.PYTH_CHANNEL = "real_time";
    const config = loadConfig();
    expect(config.channel).toBe("real_time");
  });

  it("coerces timeout string to number", () => {
    process.env.PYTH_REQUEST_TIMEOUT_MS = "5000";
    const config = loadConfig();
    expect(config.requestTimeoutMs).toBe(5000);
  });

  it("rejects invalid log level", () => {
    process.env.PYTH_LOG_LEVEL = "invalid";
    expect(() => loadConfig()).toThrow();
  });

  it("rejects invalid URL", () => {
    process.env.PYTH_ROUTER_URL = "not-a-url";
    expect(() => loadConfig()).toThrow();
  });
});
