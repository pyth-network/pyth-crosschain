import { createHash } from "node:crypto";
import pino from "pino";
import {
  computeTokenHash,
  getApiKeyLast4,
  logSessionEnd,
  logSessionStart,
  logToolCall,
} from "../../src/utils/logger.js";

describe("computeTokenHash", () => {
  it("returns null for undefined", () => {
    expect(computeTokenHash(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(computeTokenHash("")).toBeNull();
  });

  it("returns first 16 hex chars of SHA-256", () => {
    const token = "my-secret-token";
    const expected = createHash("sha256")
      .update(token)
      .digest("hex")
      .slice(0, 16);
    expect(computeTokenHash(token)).toBe(expected);
  });

  it("returns 16 character string", () => {
    const hash = computeTokenHash("test-token");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic", () => {
    expect(computeTokenHash("abc")).toBe(computeTokenHash("abc"));
  });

  it("differs for different tokens", () => {
    expect(computeTokenHash("token-a")).not.toBe(computeTokenHash("token-b"));
  });
});

describe("getApiKeyLast4", () => {
  it("returns null for undefined", () => {
    expect(getApiKeyLast4(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getApiKeyLast4("")).toBeNull();
  });

  it("returns null for token shorter than 4 chars", () => {
    expect(getApiKeyLast4("abc")).toBeNull();
    expect(getApiKeyLast4("ab")).toBeNull();
    expect(getApiKeyLast4("a")).toBeNull();
  });

  it("returns last 4 chars for token of exactly 4 chars", () => {
    expect(getApiKeyLast4("abcd")).toBe("abcd");
  });

  it("returns last 4 chars for longer token", () => {
    expect(getApiKeyLast4("my-secret-token-xyz1")).toBe("xyz1");
  });
});

describe("logToolCall", () => {
  it("logs required fields", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logToolCall(logger, {
      latencyMs: 100,
      status: "success",
      tool: "get_latest_price",
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].event).toBe("tool_call");
    expect(logs[0].tool).toBe("get_latest_price");
    expect(logs[0].status).toBe("success");
    expect(logs[0].latency_ms).toBe(100);
  });

  it("includes optional fields when provided", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logToolCall(logger, {
      apiKeyLast4: "ab12",
      clientName: "claude-desktop",
      clientVersion: "1.0.0",
      errorType: "auth",
      latencyMs: 50,
      numFeedsRequested: 3,
      numFeedsReturned: 2,
      requestId: 7,
      responseSizeBytes: 1024,
      sessionId: "sess-123",
      status: "error",
      tokenHash: "abcdef1234567890",
      tool: "get_latest_price",
      upstreamLatencyMs: 40,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].api_key_last4).toBe("ab12");
    expect(logs[0].token_hash).toBe("abcdef1234567890");
    expect(logs[0].client_name).toBe("claude-desktop");
    expect(logs[0].client_version).toBe("1.0.0");
    expect(logs[0].session_id).toBe("sess-123");
    expect(logs[0].request_id).toBe(7);
    expect(logs[0].upstream_latency_ms).toBe(40);
    expect(logs[0].num_feeds_requested).toBe(3);
    expect(logs[0].num_feeds_returned).toBe(2);
    expect(logs[0].response_size_bytes).toBe(1024);
    expect(logs[0].error_type).toBe("auth");
  });

  it("omits optional fields when not provided", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logToolCall(logger, {
      latencyMs: 10,
      status: "success",
      tool: "get_symbols",
    });

    expect(logs[0]).not.toHaveProperty("upstream_latency_ms");
    expect(logs[0]).not.toHaveProperty("error_type");
    expect(logs[0]).not.toHaveProperty("api_key_last4");
    expect(logs[0]).not.toHaveProperty("token_hash");
    expect(logs[0]).not.toHaveProperty("client_name");
  });

  it("includes null api_key_last4 and token_hash when explicitly set", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logToolCall(logger, {
      apiKeyLast4: null,
      latencyMs: 10,
      status: "success",
      tokenHash: null,
      tool: "get_symbols",
    });

    expect(logs[0].api_key_last4).toBeNull();
    expect(logs[0].token_hash).toBeNull();
  });
});

describe("logSessionStart", () => {
  it("logs session_start event with all fields", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logSessionStart(logger, {
      clientName: "claude-desktop",
      clientVersion: "1.2.0",
      serverVersion: "0.3.0",
      sessionId: "sess-abc",
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].event).toBe("session_start");
    expect(logs[0].client_name).toBe("claude-desktop");
    expect(logs[0].client_version).toBe("1.2.0");
    expect(logs[0].server_version).toBe("0.3.0");
    expect(logs[0].session_id).toBe("sess-abc");
  });

  it("defaults missing fields to 'unknown'", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logSessionStart(logger, {
      serverVersion: "0.1.0",
    });

    expect(logs[0].client_name).toBe("unknown");
    expect(logs[0].client_version).toBe("unknown");
    expect(logs[0].session_id).toBe("unknown");
  });
});

describe("logSessionEnd", () => {
  it("logs session_end event with all fields", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logSessionEnd(logger, {
      durationMs: 45_000,
      sessionId: "sess-xyz",
      totalToolCalls: 12,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].event).toBe("session_end");
    expect(logs[0].session_id).toBe("sess-xyz");
    expect(logs[0].duration_ms).toBe(45_000);
    expect(logs[0].total_tool_calls).toBe(12);
  });

  it("defaults missing sessionId to 'unknown'", () => {
    const logs: Record<string, unknown>[] = [];
    const logger = pino({ level: "info" }, {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    } as pino.DestinationStream);

    logSessionEnd(logger, {
      durationMs: 1000,
      totalToolCalls: 0,
    });

    expect(logs[0].session_id).toBe("unknown");
  });
});
