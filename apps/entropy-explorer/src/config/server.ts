// Disable the following rule because this file is the intended place to declare
// and load all env variables.
/* eslint-disable n/no-process-env */

import "server-only";

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

export const ENABLE_ACCESSIBILITY_REPORTING =
  !IS_PRODUCTION_SERVER && !process.env.DISABLE_ACCESSIBILITY_REPORTING;
