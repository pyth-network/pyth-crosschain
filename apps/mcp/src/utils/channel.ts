import type { Config } from "../config.js";
import type { Channel } from "../constants.js";

const DEFAULT_CHANNEL: Channel = "fixed_rate@200ms";

/**
 * Resolve channel with 3-step priority:
 * 1. Per-tool parameter (if provided)
 * 2. Config channel (from PYTH_CHANNEL env var)
 * 3. Hardcoded default
 */
export function resolveChannel(
  perToolChannel: Channel | undefined,
  config: Config,
): Channel {
  return perToolChannel ?? config.channel ?? DEFAULT_CHANNEL;
}
