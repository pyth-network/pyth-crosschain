// biome-ignore-all lint/style/noProcessEnv: config.ts is the designated env var loading point
// biome-ignore-all lint/nursery/noUndeclaredEnvVars: MCP server uses its own env vars, not cached by turbo
import { z } from "zod";

const ConfigSchema = z.object({
  channel: z.string().default("fixed_rate@200ms"),
  historyUrl: z
    .string()
    .url()
    .default("https://history.pyth-lazer.dourolabs.app")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  requestTimeoutMs: z.coerce.number().int().positive().default(10_000),
  routerUrl: z
    .string()
    .url()
    .default("https://pyth-lazer.dourolabs.app")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS"),
  /** Server-managed Pyth Pro token for Code Mode get_latest_price injection. Never exposed to LLM. */
  pythProAccessToken: z.string().min(1).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    channel: process.env.PYTH_CHANNEL,
    historyUrl: process.env.PYTH_HISTORY_URL,
    logLevel: process.env.PYTH_LOG_LEVEL,
    pythProAccessToken: process.env.PYTH_PRO_ACCESS_TOKEN,
    requestTimeoutMs: process.env.PYTH_REQUEST_TIMEOUT_MS,
    routerUrl: process.env.PYTH_ROUTER_URL,
  });
}
