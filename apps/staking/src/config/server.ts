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
  if (value === undefined || value === "") {
    throw new MissingEnvironmentError(key);
  } else {
    return value;
  }
};

const fromCsv = (value: string): string[] =>
  value.split(",").map((entry) => entry.toLowerCase().trim());

const transform = <T>(key: string, fn: (value: string | undefined) => T): T => {
  const value = process.env[key];
  return fn(value === "" ? undefined : value);
};

const transformOr = <T>(
  key: string,
  fn: (value: string) => T,
  defaultValue: T,
): T => transform(key, (value) => (value ? fn(value) : defaultValue));

const getOr = (key: string, defaultValue: string): string =>
  transform(key, (value) => value ?? defaultValue);

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
export const MAINNET_RPC = process.env.MAINNET_RPC;
export const MAINNET_API_RPC =
  process.env.MAINNET_API_RPC ?? process.env.MAINNET_RPC;
export const PYTHNET_RPC = getOr("PYTHNET_RPC", "https://pythnet.rpcpool.com");
export const HERMES_URL = getOr("HERMES_URL", "https://hermes.pyth.network");
export const BLOCKED_REGIONS = transformOr("BLOCKED_REGIONS", fromCsv, []);
export const IP_ALLOWLIST = transformOr("IP_ALLOWLIST", fromCsv, []);
export const VPN_ORGANIZATION_ALLOWLIST = transformOr(
  "VPN_ORGANIZATION_ALLOWLIST",
  fromCsv,
  ["iCloud Private Relay"],
);
export const GOVERNANCE_ONLY_REGIONS = transformOr(
  "GOVERNANCE_ONLY_REGIONS",
  fromCsv,
  [],
);
export const PROXYCHECK_API_KEY = demandInProduction("PROXYCHECK_API_KEY");
// This needs to be a public key that has SOL in it all the time, it will be used as a payer in the transaction simulation to compute the claimable rewards
// such simulation fails when the payer has no funds.
export const SIMULATION_PAYER_ADDRESS = getOr(
  "SIMULATION_PAYER_ADDRESS",
  "E5KR7yfb9UyVB6ZhmhQki1rM1eBcxHvyGKFZakAC5uc",
);

class MissingEnvironmentError extends Error {
  constructor(name: string) {
    super(`Missing environment variable: ${name}!`);
    this.name = "MissingEnvironmentError";
  }
}
