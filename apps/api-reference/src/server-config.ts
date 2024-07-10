// Disable the following rule because this file is the intended place to declare
// and load all env variables.
/* eslint-disable n/no-process-env */

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
 * Indicates that we're running in a github actions workflow.
 */
export const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

/**
 * Throw if the env var `key` is not set, unless we're running in github
 * actions.  If running in GHA, then allow the variable to be unset and return
 * an empty string if so.
 *
 * This is useful because for some variables, we want an invariant that the
 * value is always present.  However, we don't necessarily need the value just
 * to run code checks, some of which require a build, we don't want to
 * expose the secret to GHA unnecessarily, and we don't want to have to.
 *
 * So, in effect, variables marked with this will be asserted to be present in
 * Vercel or in local dev, and will type check as `string`, but will not throw
 * when running code checks in GHA.
 *
 * Note we use `IS_GITHUB_ACTIONS` and not e.g. `process.env.CI` here because
 * both Vercel and Github Actions set `process.env.CI`, and we specifically want
 * to only allow these variables to be nonpresent only if running a build just
 * for running code checks.  Any build that will actually serve traffic must
 * have these variables set.  Github Actions is the only environment that is
 * exclusively used for running checks, so semantically this is correct, but
 * this would need to be updated if we change infrastructure.
 */
const demandExceptGHA = IS_GITHUB_ACTIONS
  ? (key: string) => process.env[key] ?? ""
  : demand;

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
export const WALLETCONNECT_PROJECT_ID = demandExceptGHA(
  "WALLETCONNECT_PROJECT_ID",
);
