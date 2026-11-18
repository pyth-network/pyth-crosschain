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
      "wss://myuser:p%40ssword@rpc.example.com/?network=mainnet&api-key=0123456789abcdef",
    );
    expect(secrets).toContain("myuser");
    expect(secrets).toContain("p%40ssword");
    expect(secrets).toContain("p@ssword");
    expect(secrets).toContain("0123456789abcdef");
    expect(secrets).not.toContain("mainnet");
  });

  it("returns the value of a key=value header", () => {
    expect(extractSecrets("x-token=supersecret")).toEqual([
      "x-token=supersecret",
      "supersecret",
    ]);
  });

  it("returns a token that contains = whole", () => {
    expect(extractSecrets("abcdefghijklmnop==")).toEqual([
      "abcdefghijklmnop==",
    ]);
    expect(extractSecrets("abc=defghijk")).toContain("abc=defghijk");
  });

  it("returns raw query values with lowercase percent-encoding", () => {
    const secrets = extractSecrets(
      "https://rpc.example.com/?api-key=abcdefghijkl%2fmnop",
    );
    expect(secrets).toContain("abcdefghijkl%2fmnop");
    expect(secrets).toContain("abcdefghijkl/mnop");
  });

  it("keeps short userinfo", () => {
    expect(extractSecrets("https://30:a@rpc.example.com/")).toEqual([]);
  });

  it("keeps a short raw value and a short header", () => {
    expect(extractSecrets("x=1")).toEqual([]);
    expect(extractSecrets("abc")).toEqual([]);
  });

  it("returns a raw token whole", () => {
    expect(extractSecrets("my-bearer-token")).toEqual(["my-bearer-token"]);
  });

  it("keeps a segment with an invalid percent sequence as it is", () => {
    expect(extractSecrets("https://rpc.example.com/abcdefghijkl%zz")).toEqual([
      "abcdefghijkl%zz",
      "abcdefghijkl%zz",
    ]);
    expect(extractSecrets("https://user%zz:pass%zz@rpc.example.com/")).toEqual([
      "user%zz",
      "user%zz",
      "pass%zz",
      "pass%zz",
    ]);
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

describe("createLogger with short credentials", () => {
  it("emits valid JSON lines", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(
          ...chunk
            .toString()
            .split("\n")
            .filter((l) => l !== ""),
        );
        callback();
      },
    });
    const logger = createLogger(
      "info",
      ["https://30:a@rpc.example.com/", "x=1"],
      stream,
    );
    logger.info("pushed a price");
    logger.error(new Error("failed"), "push failed");

    // Neither source has a secret long enough to register.
    expect(redactSecrets('"level":30 x=1')).toBe('"level":30 x=1');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line) as unknown).not.toThrow();
    }
  });
});

describe("createRedactor length floor", () => {
  it("drops decoded secrets shorter than the floor", () => {
    // The raw path segment is 15 chars, but it decodes to `00000`, which is
    // under the floor and would rewrite `10000` in the JSON line.
    const redact = createRedactor([
      "https://rpc.example.com/%30%30%30%30%30?x=1",
    ]);
    expect(redact('{"level":30,"time":10000}')).toBe(
      '{"level":30,"time":10000}',
    );
  });
});

describe("createRedactor with raw tokens", () => {
  it("redacts a token that ends in =", () => {
    const redact = createRedactor(["abcdefghijklmnop=="]);
    expect(redact("Bearer abcdefghijklmnop==")).toBe(`Bearer ${REDACTED}`);
  });

  it("redacts a lowercase percent-encoded query value as configured", () => {
    const endpoint = "https://rpc.example.com/?api-key=abcdefghijkl%2fmnop";
    const redact = createRedactor([endpoint]);
    expect(redact(`URL: ${endpoint}`)).toBe(
      `URL: https://rpc.example.com/?api-key=${REDACTED}`,
    );
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

describe("solana secretSources", () => {
  it("leaves out the Jito relay hostnames", async () => {
    const { secretSources } = await import("../solana/command.js");
    const argv = {
      endpoint: "https://rpc.example.com/abcdefghijklmnop",
      hermesAccessToken: "hermes-token-123",
      jitoEndpoints:
        "mainnet.block-engine.jito.wtf,ny.mainnet.block-engine.jito.wtf",
      priceServiceEndpoint: "https://hermes.pyth.network",
    };
    const sources = secretSources(argv);
    const redact = createRedactor(sources);
    expect(redact("endpoint mainnet.block-engine.jito.wtf")).toBe(
      "endpoint mainnet.block-engine.jito.wtf",
    );
    expect(redact("https://rpc.example.com/abcdefghijklmnop")).toBe(
      `https://rpc.example.com/${REDACTED}`,
    );
  });
});
