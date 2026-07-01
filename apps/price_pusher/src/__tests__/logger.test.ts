import { HttpRequestError, WebSocketRequestError } from "viem";

import { createLogger } from "../logger.js";

const SECRET = "SUPERSECRETKEY";
const ENDPOINT = `https://eth-mainnet.g.alchemy.com/v2/${SECRET}`;

// Collects every line pino writes so we can assert on the serialized output.
const collect = () => {
  const lines: string[] = [];
  const stream = {
    write: (chunk: string) => {
      lines.push(chunk);
    },
  };
  return { stream, lines };
};

describe("createLogger URL redaction", () => {
  it("strips the API key from a viem HttpRequestError logged positionally", () => {
    const { stream, lines } = collect();
    const logger = createLogger("debug", stream);
    const error = new HttpRequestError({
      body: { method: "eth_call" },
      status: 500,
      url: ENDPOINT,
    });

    logger.error(error, "Polling on-chain price failed.");

    const line = lines.join("");
    expect(line).not.toContain(SECRET);
    const parsed = JSON.parse(line);
    // The error is still logged with a useful message and origin.
    expect(parsed.err.message).toContain("HTTP request failed.");
    expect(line).toContain("https://eth-mainnet.g.alchemy.com/[REDACTED]");
  });

  it("strips the API key whether the error is under `err` or `error`", () => {
    const { stream, lines } = collect();
    const logger = createLogger("debug", stream);
    const error = new HttpRequestError({ status: 500, url: ENDPOINT });

    logger.error({ err: error }, "err key");
    logger.warn({ error }, "error key");

    expect(lines.join("")).not.toContain(SECRET);
    expect(lines).toHaveLength(2);
  });

  it("redacts userinfo and query-string secrets in WebSocket URLs", () => {
    const { stream, lines } = collect();
    const logger = createLogger("debug", stream);
    const wsUrl = "wss://user:topsecret@rpc.example.com/ws?apikey=QUERYSECRET";
    const error = new WebSocketRequestError({ url: wsUrl });

    logger.error(error, "socket failed");

    const line = lines.join("");
    expect(line).not.toContain("topsecret");
    expect(line).not.toContain("QUERYSECRET");
    expect(line).toContain("[REDACTED]");
  });

  it("leaves plain hosts without secrets untouched", () => {
    const { stream, lines } = collect();
    const logger = createLogger("debug", stream);

    logger.info("connecting to https://rpc.publicnode.com");

    expect(lines.join("")).toContain("https://rpc.publicnode.com");
  });
});
