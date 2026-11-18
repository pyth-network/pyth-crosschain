import { Writable } from "node:stream";

import { createLogger, createRedactor, REDACTED } from "../logger.js";

// Fake keys with the same shapes as the providers' keys.
const ALCHEMY_KEY = "Ab0CdEfGh1IjKlMnOpQrStUvWxYz_234"; // 32 chars
const QUICKNODE_KEY = "0123456789abcdef0123456789abcdef01234567"; // 40 chars
const ANKR_KEY = "0123456789abcdef".repeat(4); // 64 chars

describe("createRedactor", () => {
  const redacts = (source: string, secret: string) =>
    createRedactor([source])(`log ${secret} log`) === `log ${REDACTED} log`;

  it("redacts URL path segments longer than 30 characters", () => {
    expect(
      redacts(
        `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
        ALCHEMY_KEY,
      ),
    ).toBe(true);
    const endpoint = `https://a-b-c.hype-mainnet.quiknode.pro/${QUICKNODE_KEY}/evm`;
    expect(createRedactor([endpoint])(endpoint)).toBe(
      `https://a-b-c.hype-mainnet.quiknode.pro/${REDACTED}/evm`,
    );
  });

  it("keeps a URL with no long path segment", () => {
    for (const endpoint of [
      "https://hermes-stable-green.dourolabs.app",
      "http://erpc.erpc:4000/price-pusher/evm/1",
    ]) {
      expect(createRedactor([endpoint])(endpoint)).toBe(endpoint);
    }
  });

  it("redacts an x-token value longer than 30 characters", () => {
    expect(redacts(`x-token=${ANKR_KEY}`, ANKR_KEY)).toBe(true);
    expect(redacts("x-token=short-token", "short-token")).toBe(false);
  });

  it("redacts any other value longer than 30 characters whole", () => {
    expect(redacts(QUICKNODE_KEY, QUICKNODE_KEY)).toBe(true);
    expect(redacts("sui.grpc.ankr.com:443", "sui.grpc.ankr.com:443")).toBe(
      false,
    );
    expect(redacts("short-token", "short-token")).toBe(false);
  });

  it("replaces every secret, longest first", () => {
    const redact = createRedactor([
      `https://x.quiknode.pro/${QUICKNODE_KEY}/`,
      undefined,
      `x-token=${ANKR_KEY}`,
    ]);
    expect(
      redact(`URL: https://x.quiknode.pro/${QUICKNODE_KEY}/ token ${ANKR_KEY}`),
    ).toBe(`URL: https://x.quiknode.pro/${REDACTED}/ token ${REDACTED}`);
  });
});

describe("createLogger", () => {
  it("redacts the RPC key from error logs of child loggers", () => {
    const endpoint = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger("debug", [endpoint], stream);

    logger
      .child({ module: "Controller" }, { level: "info" })
      .error(new Error(`HTTP request failed.\n\nURL: ${endpoint}`), "failed");

    const output = lines.join("");
    expect(output).toContain(`/v2/${REDACTED}`);
    expect(output).not.toContain(ALCHEMY_KEY);
    for (const line of output.split("\n").filter((l) => l !== "")) {
      expect(() => JSON.parse(line) as unknown).not.toThrow();
    }
  });
});
