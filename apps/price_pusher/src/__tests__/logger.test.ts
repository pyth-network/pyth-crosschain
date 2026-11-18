import { Writable } from "node:stream";

import {
  createLogger,
  createRedactor,
  extractSecrets,
  REDACTED,
  redactSecrets,
} from "../logger.js";

// Fake keys with the same shapes as the providers' keys.
const ALCHEMY_KEY = "Ab0CdEfGh1IjKlMnOpQrStUvWxYz_234"; // 32 chars
const QUICKNODE_KEY = "0123456789abcdef0123456789abcdef01234567"; // 40 chars
const ANKR_KEY = "0123456789abcdef".repeat(4); // 64 chars

describe("extractSecrets", () => {
  it("returns path segments longer than 30 characters", () => {
    expect(
      extractSecrets(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    ).toEqual([ALCHEMY_KEY]);
    expect(
      extractSecrets(
        `https://a-b-c.hype-mainnet.quiknode.pro/${QUICKNODE_KEY}/evm`,
      ),
    ).toEqual([QUICKNODE_KEY]);
  });

  it("keeps a URL with no long path segment", () => {
    expect(extractSecrets("https://hermes-stable-green.dourolabs.app")).toEqual(
      [],
    );
    expect(extractSecrets("http://erpc.erpc:4000/price-pusher/evm/1")).toEqual(
      [],
    );
  });

  it("returns the x-token value", () => {
    expect(extractSecrets(`x-token=${ANKR_KEY}`)).toEqual([ANKR_KEY]);
  });

  it("returns any other value longer than 30 characters whole", () => {
    expect(extractSecrets(QUICKNODE_KEY)).toEqual([QUICKNODE_KEY]);
    expect(extractSecrets("sui.grpc.ankr.com:443")).toEqual([]);
    expect(extractSecrets("short-token")).toEqual([]);
  });
});

describe("createRedactor", () => {
  it("replaces every secret with <token>", () => {
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

describe("redactSecrets", () => {
  it("uses the secrets of the last logger created", () => {
    createLogger("info", [`https://rpc.example.com/${QUICKNODE_KEY}`]);
    expect(redactSecrets(`https://rpc.example.com/${QUICKNODE_KEY}`)).toBe(
      `https://rpc.example.com/${REDACTED}`,
    );
  });
});
