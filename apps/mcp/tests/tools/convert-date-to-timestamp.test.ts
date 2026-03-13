import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { HistoryClient } from "../../src/clients/history.js";
import { RouterClient } from "../../src/clients/router.js";
import type { SessionContext } from "../../src/server.js";
import { registerAllTools } from "../../src/tools/index.js";
import { createTestClient } from "../helpers.js";

const HISTORY_URL = "https://history.pyth-lazer.dourolabs.app";
const ROUTER_URL = "https://pyth-lazer.dourolabs.app";

const msw = setupServer(
  http.get(`${HISTORY_URL}/v1/symbols`, () => HttpResponse.json([])),
);

const logger = pino({ level: "silent" });

beforeAll(() => msw.listen({ onUnhandledRequest: "error" }));
afterEach(() => msw.resetHandlers());
afterAll(() => msw.close());

function createSessionContext(): SessionContext {
  return {
    serverVersion: "0.0.1",
    sessionId: "test-session-id",
    sessionStartTime: Date.now(),
    toolCallCount: 0,
  };
}

describe("convert_date_to_timestamp tool", () => {
  let client: Client;

  beforeAll(async () => {
    const config = {
      channel: "fixed_rate@200ms",
      historyUrl: HISTORY_URL,
      logLevel: "info" as const,
      requestTimeoutMs: 10_000,
      routerUrl: ROUTER_URL,
    };

    const mcpServer = new McpServer({ name: "test", version: "0.0.1" });
    const historyClient = new HistoryClient(config, logger);
    const routerClient = new RouterClient(config, logger);
    registerAllTools(
      mcpServer,
      config,
      historyClient,
      routerClient,
      logger,
      createSessionContext(),
    );
    client = await createTestClient(mcpServer);
  });

  it("converts bare date (YYYY-MM-DD) to UTC midnight", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-01-01" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.unix_seconds).toBe(1767225600);
    expect(data.unix_microseconds).toBe(1767225600000000);
    expect(data.iso8601).toBe("2026-01-01T00:00:00.000Z");
    expect(data.is_in_valid_range).toBe(true);
    expect(data.server_time_utc).toBeDefined();
    expect(data.valid_range.from_unix).toBe(1743465600);
  });

  it("converts ISO 8601 with timezone", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-01-01T12:00:00Z" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.unix_seconds).toBe(1767268800);
    expect(data.iso8601).toBe("2026-01-01T12:00:00.000Z");
  });

  it("returns is_in_valid_range=false for dates before April 2025", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2025-01-01" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.unix_seconds).toBe(1735689600);
    expect(data.is_in_valid_range).toBe(false);
  });

  it("returns is_in_valid_range=false for future dates", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2099-01-01" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.is_in_valid_range).toBe(false);
  });

  it("rejects datetime without timezone", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-01-01T12:00:00" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid date format");
  });

  it("rejects invalid date strings", async () => {
    const result = await client.callTool({
      arguments: { date_string: "not-a-date" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid date format");
  });

  it("rejects non-ISO formats like 'January 1, 2026'", async () => {
    const result = await client.callTool({
      arguments: { date_string: "January 1, 2026" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid date format");
  });

  it("rejects non-ISO format 'Sat Jan 01 2026 00:00:00 GMT+0000'", async () => {
    const result = await client.callTool({
      arguments: { date_string: "Sat Jan 01 2026 00:00:00 GMT+0000" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid date format");
  });

  it("rejects invalid calendar date Feb 30", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-02-30" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid calendar date");
    expect(text).toContain("does not exist");
  });

  it("rejects invalid calendar date Apr 31", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-04-31" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid calendar date");
    expect(text).toContain("does not exist");
  });

  it("accepts valid non-leap year Feb 28", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-02-28" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
  });

  it("accepts valid leap year Feb 29", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2024-02-29" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.iso8601).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rejects Feb 29 on non-leap year", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2025-02-29" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid calendar date");
  });

  it("rejects invalid calendar date with timezone offset", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-02-30T12:00:00+05:00" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]
      .text;
    expect(text).toContain("Invalid calendar date");
    expect(text).toContain("does not exist");
  });

  it("accepts datetime with offset where UTC date differs from input date", async () => {
    // 2026-01-31T23:00:00-05:00 = 2026-02-01T04:00:00Z
    // UTC date (Feb 1) differs from input date (Jan 31) — valid timezone conversion
    const result = await client.callTool({
      arguments: { date_string: "2026-01-31T23:00:00-05:00" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    expect(data.iso8601).toBe("2026-02-01T04:00:00.000Z");
  });

  it("handles timezone offset format", async () => {
    const result = await client.callTool({
      arguments: { date_string: "2026-01-01T12:00:00+05:30" },
      name: "convert_date_to_timestamp",
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text,
    );
    // 12:00 IST = 06:30 UTC
    expect(data.unix_seconds).toBe(1767249000);
    expect(data.iso8601).toBe("2026-01-01T06:30:00.000Z");
  });
});
