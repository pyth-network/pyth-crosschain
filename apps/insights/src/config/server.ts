// Disable the following rule because this file is the intended place to declare
// and load all env variables.
/* eslint-disable n/no-process-env, @typescript-eslint/no-non-null-assertion, turbo/no-undeclared-env-vars */

import { Redis } from 'ioredis';
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
export const IS_PREVIEW_SERVER = process.env.VERCEL_ENV === "preview";

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


let redisClient: Redis | undefined;

export function getRedis(): Redis {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  const password = process.env.REDIS_PASSWORD;
  if (!host || !port) {
    throw new Error('REDIS_HOST, and REDIS_PORT must be set');
  }
  if(redisClient) {
    return redisClient;
  }
  redisClient = new Redis({ 
    username: 'default',
    password: password ?? '',
    host,
    port: Number.parseInt(port),
    });
  return redisClient;
}

export const PUBLIC_URL = (() => {
  if (IS_PRODUCTION_SERVER) {
    
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL!}`;
  } else if (IS_PREVIEW_SERVER) {
    return `https://${process.env.VERCEL_URL!}`;
  } else {
    return `http://localhost:3003`;
  }
})();

export const VERCEL_AUTOMATION_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET!;