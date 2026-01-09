// Disable the following rule because this file is the intended place to declare
// and load all Pyth Pro env variables.
/* eslint-disable n/no-process-env */

import "server-only";

const getEnvOrDefault = (key: string, defaultValue: string) =>
  process.env[key] ?? defaultValue;

// Pyth Pro WebSocket endpoint
export const PYTH_PRO_WS_ENDPOINT = getEnvOrDefault(
  "PYTH_PRO_WS_ENDPOINT",
  "wss://pyth-lazer.dourolabs.app/v1/stream",
);

// Demo token for playground (required in production)
export const PYTH_PRO_DEMO_TOKEN = process.env.PYTH_PRO_DEMO_TOKEN;

// Maximum stream duration in milliseconds (default: 60 seconds)
export const PLAYGROUND_MAX_STREAM_DURATION_MS = Number.parseInt(
  getEnvOrDefault("PLAYGROUND_MAX_STREAM_DURATION_MS", "60000"),
  10,
);

// Rate limit: window duration in milliseconds (default: 60 seconds)
export const PLAYGROUND_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  getEnvOrDefault("PLAYGROUND_RATE_LIMIT_WINDOW_MS", "60000"),
  10,
);

// Rate limit: max requests per window (default: 5)
export const PLAYGROUND_RATE_LIMIT_MAX_REQUESTS = Number.parseInt(
  getEnvOrDefault("PLAYGROUND_RATE_LIMIT_MAX_REQUESTS", "5"),
  10,
);
