/* eslint-disable n/no-process-env */

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

/**
 * Region or VPN-blocked requests will be redirected here if they are eligible
 * for "restricted mode" (aka only allowing withdrawals).  This is used in the
 * middleware to implement the block, and also consumed in any components that
 * are part of the page layout but need to know if the request is blocked from
 * accessing the app, such as the WalletButton in the app header.
 *
 * Don't change unless you also change the relevant app route path to match.
 */
export const RESTRICTED_MODE_SEGMENT = "restricted-mode";

/**
 * Similar to `RESTRICTED_MODE_SEGMENT`; this is where vpn-blocked traffic will
 * be rewritten to if it isn't eligible for restricted mode.
 *
 * Don't change unless you also change the relevant app route path to match.
 */
export const VPN_BLOCKED_SEGMENT = "vpn-blocked";
