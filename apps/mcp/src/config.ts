// biome-ignore-all lint/style/noProcessEnv: config.ts is the designated env var loading point
// biome-ignore-all lint/nursery/noUndeclaredEnvVars: MCP server uses its own env vars, not cached by turbo
import { z } from "zod";
import { CHANNELS } from "./constants.js";

const ConfigSchema = z.object({
  channel: z.enum(CHANNELS).default("fixed_rate@200ms"),
  historyUrl: z
    .string()
    .url()
    // History API base. Serves /v1/symbols and the token-gated
    // /v1/{channel}/price and /v1/{channel}/history routes.
    .default("https://pyth.dourolabs.app")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  requestTimeoutMs: z.coerce.number().int().positive().default(10_000),
  routerUrl: z
    .string()
    .url()
    .default("https://pyth-lazer.dourolabs.app")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    channel: process.env.PYTH_CHANNEL,
    historyUrl: process.env.PYTH_HISTORY_URL,
    logLevel: process.env.PYTH_LOG_LEVEL,
    requestTimeoutMs: process.env.PYTH_REQUEST_TIMEOUT_MS,
    routerUrl: process.env.PYTH_ROUTER_URL,
  });
}

/**
 * The user's own key from the environment their MCP client gives a local
 * stdio server. Only the stdio entry point (index.ts) calls this; the HTTP
 * server (http.ts) never does, so a key set on a hosted deployment is
 * ignored and the server never answers with a key of its own.
 */
export function loadStdioAccessToken(): string | undefined {
  return process.env.PYTH_PRO_ACCESS_TOKEN;
}
