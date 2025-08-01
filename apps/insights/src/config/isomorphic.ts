/* eslint-disable n/no-process-env */

import { getPythClusterApiUrl } from "@pythnetwork/client";

/**
 * Indicates this is a production-optimized build.  Note this does NOT
 * necessarily indicate that we're running on a cloud machine or the live build
 * -- use `RUNNING_IN_CLOUD` or `IS_PRODUCTION_SERVER` out of `config/server.ts`
 * for that (if you need that on the client you'll need to write a client
 * component that receives that value as a prop).
 *
 * Basically this indicates if we're minified, excluding source maps, running
 * with the optimized React build, etc.
 */
export const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

export const PYTHNET_RPC =
  process.env.NEXT_PUBLIC_PYTHNET_RPC ?? getPythClusterApiUrl("pythnet");
export const PYTHTEST_CONFORMANCE_RPC =
  process.env.NEXT_PUBLIC_PYTHTEST_CONFORMANCE_RPC ??
  getPythClusterApiUrl("pythtest-conformance");
