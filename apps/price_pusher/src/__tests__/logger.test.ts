import { Writable } from "node:stream";

import {
  createLogger,
  createRedactor,
  extractSecrets,
  REDACTED,
  redactSecrets,
} from "../logger.js";

describe("extractSecrets", () => {
  it("returns the API key in a URL path", () => {
    expect(
      extractSecrets(
        "https://eth-mainnet.g.alchemy.com/v2/abcdef0123456789xyz",
      ),
    ).toEqual(["abcdef0123456789xyz", "abcdef0123456789xyz"]);
  });

  it("keeps short path segments", () => {
    expect(extractSecrets("https://rpc.example.com/v2/mainnet/")).toEqual([]);
  });

  it("returns the userinfo and long query values", () => {
    const secrets = extractSecrets(
      "wss://user:p%40ss@rpc.example.com/?network=mainnet&api-key=0123456789abcdef",
    );
    expect(secrets).toContain("user");
    expect(secrets).toContain("p%40ss");
    expect(secrets).toContain("p@ss");
    expect(secrets).toContain("0123456789abcdef");
    expect(secrets).not.toContain("mainnet");
  });

  it("returns the value of a key=value header", () => {
    expect(extractSecrets("x-token=supersecret")).toEqual(["supersecret"]);
  });

  it("returns a raw token whole", () => {
    expect(extractSecrets("my-bearer-token")).toEqual(["my-bearer-token"]);
  });

  it("returns nothing for an empty string", () => {
    expect(extractSecrets("  ")).toEqual([]);
  });
});

describe("createRedactor", () => {
  it("redacts every secret from a line", () => {
    const redact = createRedactor([
      "https://x.quiknode.pro/0123456789abcdef0123/",
      undefined,
      "x-api-key=blockvision-key",
      "hermes-token",
    ]);
    expect(
      redact(
        "URL: https://x.quiknode.pro/0123456789abcdef0123/ header blockvision-key bearer hermes-token",
      ),
    ).toBe(
      `URL: https://x.quiknode.pro/${REDACTED}/ header ${REDACTED} bearer ${REDACTED}`,
    );
  });

  it("returns the line unchanged when there are no secrets", () => {
    const redact = createRedactor([undefined, "https://rpc.example.com"]);
    expect(redact("https://rpc.example.com/")).toBe("https://rpc.example.com/");
  });
});

describe("createLogger", () => {
  it("redacts the RPC key from error logs of child loggers", () => {
    const endpoint = "https://eth-mainnet.g.alchemy.com/v2/abcdef0123456789xyz";
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger("debug", [endpoint], stream);

    const error = new Error(
      `HTTP request failed.\n\nURL: ${endpoint}\nRequest body: {}`,
    );
    logger
      .child({ module: "Controller" }, { level: "info" })
      .error(error, "Push failed");

    const output = lines.join("");
    expect(output).toContain("Push failed");
    expect(output).toContain(REDACTED);
    expect(output).not.toContain("abcdef0123456789xyz");
  });
});

describe("redactSecrets", () => {
  it("uses the secrets of the last logger created", () => {
    createLogger("info", ["https://rpc.example.com/?key=0123456789abcdef"]);
    expect(
      redactSecrets("URL: https://rpc.example.com/?key=0123456789abcdef"),
    ).toBe(`URL: https://rpc.example.com/?key=${REDACTED}`);
  });
});
