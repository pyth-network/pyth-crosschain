// Disable the following rule because this file is the intended place to declare
// and load all env variables.
/* eslint-disable n/no-process-env */

// Disable the following rule because variables in this file are only loaded at
// runtime and do not influence the build outputs, thus they need not be
// declared to turbo for it to be able to cache build outputs correctly.
/* eslint-disable turbo/no-undeclared-env-vars */

import "server-only";

/**
 * Throw if the env var `key` is not set (at either runtime or build time).
 */
const demand = (key: string): string => {
  const value = process.env[key];
  if (value && value !== "") {
    return value;
  } else {
    throw new Error(`Missing environment variable ${key}!`);
  }
};

/**
 * Indicates that this server is the live customer-facing production server.
 */
export const IS_PRODUCTION_SERVER = process.env.VERCEL_ENV === "production";

/**
 * Throw if the env var `key` is not set in the live customer-facing production
 * server, but allow it to be unset in any other environment.
 */
const demandInProduction = IS_PRODUCTION_SERVER
  ? demand
  : (key: string) => process.env[key];

export const GOOGLE_ANALYTICS_ID = demandInProduction("GOOGLE_ANALYTICS_ID");
export const AMPLITUDE_API_KEY = demandInProduction("AMPLITUDE_API_KEY");
export const WALLETCONNECT_PROJECT_ID = demandInProduction(
  "WALLETCONNECT_PROJECT_ID",
);
