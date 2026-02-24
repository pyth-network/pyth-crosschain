import type { Config } from "../config.js";

const DEFAULT_CHANNEL = "fixed_rate@200ms";

/**
 * Resolve channel with 3-step priority:
 * 1. Per-tool parameter (if provided)
 * 2. Config channel (from PYTH_CHANNEL env var)
 * 3. Hardcoded default
 */
export function resolveChannel(
  perToolChannel: string | undefined,
  config: Config,
): string {
  return perToolChannel ?? config.channel ?? DEFAULT_CHANNEL;
}
