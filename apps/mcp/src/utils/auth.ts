import type { Config } from "../config.js";

/**
 * Pick the token for an authenticated call: the per-call `access_token`
 * wins, otherwise the user's own key from PYTH_PRO_ACCESS_TOKEN (stdio only).
 */
export function resolveAccessToken(
  perCallToken: string | undefined,
  config: Config,
): string | undefined {
  return perCallToken ?? config.accessToken;
}

/**
 * Every user brings their own key. A hosted HTTP server must never hold one,
 * or every visitor would query Pyth Pro with it.
 */
export function assertNoServerKey(config: Config): void {
  if (config.accessToken !== undefined) {
    throw new Error(
      "PYTH_PRO_ACCESS_TOKEN must not be set in HTTP mode: every caller must pass their own access_token. Unset it, or use stdio mode for a personal key.",
    );
  }
}
