// Disable the following rule because this file is the intended place to declare
// and load all env variables.
/* eslint-disable n/no-process-env */

import "server-only";

/**
 * Throw if the env var `key` is not set (at either runtime or build time).
 */
const demand = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new MissingEnvironmentError(key);
  } else {
    return value;
  }
};

class MissingEnvironmentError extends Error {
  constructor(name: string) {
    super(`Missing environment variable: ${name}!`);
    this.name = "MissingEnvironmentError";
  }
}

const getEnvOrDefault = (key: string, defaultValue: string) =>
  process.env[key] ?? defaultValue;

/**
 * Indicates that this server is the live customer-facing production server.
 */
export const IS_PRODUCTION_SERVER = process.env.VERCEL_ENV === "production";

const defaultInProduction = IS_PRODUCTION_SERVER
  ? getEnvOrDefault
  : (key: string) => process.env[key];

export const GOOGLE_ANALYTICS_ID = defaultInProduction(
  "GOOGLE_ANALYTICS_ID",
  "G-E1QSY256EQ",
);
export const AMPLITUDE_API_KEY = defaultInProduction(
  "AMPLITUDE_API_KEY",
  "6faa78c51eff33087eb19f0f3dc76f33",
);
export const CLICKHOUSE = {
  url:
    process.env.CLICKHOUSE_URL ??
    "https://oxcuvjrqq7.eu-west-2.aws.clickhouse.cloud:8443",
  username: process.env.CLICKHOUSE_USERNAME ?? "insights",
  password: demand("CLICKHOUSE_PASSWORD"),
};

export const SOLANA_RPC =
  process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export const ENABLE_ACCESSIBILITY_REPORTING =
  !IS_PRODUCTION_SERVER && !process.env.DISABLE_ACCESSIBILITY_REPORTING;
