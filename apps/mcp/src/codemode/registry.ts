/**
 * Registers Code Mode tools (search, execute) on an MCP server.
 * Public endpoint exposes only these two tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BindingContext } from "./bindings.js";
import { createBindings } from "./bindings.js";
import { createExecutor } from "./executor.js";
import { CODE_MODE_TYPES } from "./types.js";

export function registerCodeModeTools(
  server: McpServer,
  bindingContext: BindingContext,
  executionContext: {
    executionId: () => string;
    onToolCall?: () => void;
    requestId?: string | number;
    sessionId?: string;
  },
): void {
  const bindings = createBindings(bindingContext);
  const { execute } = createExecutor({ timeoutMs: 30_000 });

  server.registerTool(
    "search",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description:
        "Return Pyth Pro Code Mode type definitions. Lists all available codemode.* functions and their input/output shapes.",
      inputSchema: z.object({}),
    },
    async () => {
      executionContext.onToolCall?.();
      return { content: [{ text: CODE_MODE_TYPES, type: "text" as const }] };
    },
  );

  server.registerTool(
    "execute",
    {
      annotations: { destructiveHint: false, readOnlyHint: true },
      description: `Execute JavaScript code against the Pyth Pro API. Write async code using codemode.* functions. Token for get_latest_price is injected automatically.\n\n${CODE_MODE_TYPES}`,
      inputSchema: z.object({
        code: z
          .string()
          .describe(
            "JavaScript async arrow function. Use codemode.get_symbols(), codemode.get_historical_price(), codemode.get_candlestick_data(), codemode.get_latest_price(). Return the data you need.",
          ),
      }),
    },
    async ({ code }, extra) => {
      executionContext.onToolCall?.();
      const execId = executionContext.executionId();
      const start = Date.now();
      const metrics = { toolsCalled: [] as string[], toolCallsInExecution: 0 };

      const hostCall = async (toolName: string, arg: unknown): Promise<unknown> => {
        const fn = bindings[toolName];
        if (!fn) throw new Error(`Unknown codemode function: ${toolName}`);
        metrics.toolsCalled.push(toolName);
        metrics.toolCallsInExecution += 1;
        return fn(arg);
      };

      const result = await execute(code, hostCall);

      const executionTimeMs = Date.now() - start;

      if (!result.ok) {
        bindingContext.logger.info({
          error_type: "sandbox",
          event: "codemode_execute",
          execution_error: result.error,
          execution_id: execId,
          execution_time_ms: executionTimeMs,
          request_id: extra.requestId ?? executionContext.requestId,
          result_size_bytes: 0,
          session_id: extra.sessionId ?? executionContext.sessionId,
          tool_calls_in_execution: metrics.toolCallsInExecution,
          tools_called: [...metrics.toolsCalled],
        });
        return {
          content: [{ text: result.error, type: "text" as const }],
          isError: true as const,
        };
      }

      const raw =
        typeof result.result === "string"
          ? result.result
          : JSON.stringify(result.result) ?? "undefined";
      const resultText = raw ?? "undefined";
      const resultSizeBytes = Buffer.byteLength(resultText);

      bindingContext.logger.info({
        event: "codemode_execute",
        execution_id: execId,
        execution_time_ms: executionTimeMs,
        request_id: extra.requestId ?? executionContext.requestId,
        result_size_bytes: resultSizeBytes,
        session_id: extra.sessionId ?? executionContext.sessionId,
        tool_calls_in_execution: metrics.toolCallsInExecution,
        tools_called: [...metrics.toolsCalled],
      });

      return {
        content: [{ text: resultText, type: "text" as const }],
      };
    },
  );
}
