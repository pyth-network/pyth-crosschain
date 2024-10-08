import ipRangeCheck from "ip-range-check";
import { type NextRequest, NextResponse } from "next/server";
import ProxyCheck from "proxycheck-ts";

import {
  GEO_BLOCKED_SEGMENT,
  GOVERNANCE_ONLY_SEGMENT,
  VPN_BLOCKED_SEGMENT,
} from "./config/isomorphic";
import {
  BLOCKED_REGIONS,
  GOVERNANCE_ONLY_REGIONS,
  PROXYCHECK_API_KEY,
  IP_ALLOWLIST,
} from "./config/server";

const GEO_BLOCKED_PATH = `/${GEO_BLOCKED_SEGMENT}`;
const GOVERNANCE_ONLY_PATH = `/${GOVERNANCE_ONLY_SEGMENT}`;
const VPN_BLOCKED_PATH = `/${VPN_BLOCKED_SEGMENT}`;

const proxyCheckClient = PROXYCHECK_API_KEY
  ? new ProxyCheck({ api_key: PROXYCHECK_API_KEY })
  : undefined;

export const middleware = async (request: NextRequest) => {
  if (isIpAllowlisted(request)) {
    return isBlockedSegment(request)
      ? rewrite(request, "/not-found")
      : undefined;
  } else {
    if (await isProxyBlocked(request)) {
      return rewrite(request, VPN_BLOCKED_PATH);
    } else if (isGovernanceOnlyRegion(request)) {
      return rewrite(request, GOVERNANCE_ONLY_PATH);
    } else if (isRegionBlocked(request)) {
      return rewrite(request, GEO_BLOCKED_PATH);
    } else if (isBlockedSegment(request)) {
      return rewrite(request, "/not-found");
    } else {
      return;
    }
  }
};

const rewrite = (request: NextRequest, path: string) =>
  NextResponse.rewrite(new URL(path, request.url));

const isIpAllowlisted = ({ ip }: NextRequest) =>
  ip !== undefined &&
  IP_ALLOWLIST.some((allowedRange) => ipRangeCheck(ip, allowedRange));

const isGovernanceOnlyRegion = ({ geo }: NextRequest) =>
  geo?.country !== undefined &&
  GOVERNANCE_ONLY_REGIONS.includes(geo.country.toLowerCase());

const isRegionBlocked = ({ geo }: NextRequest) =>
  geo?.country !== undefined &&
  BLOCKED_REGIONS.includes(geo.country.toLowerCase());

const isProxyBlocked = async ({ ip }: NextRequest) => {
  if (proxyCheckClient === undefined || ip === undefined) {
    return false;
  } else {
    const result = await proxyCheckClient.checkIP(ip, { vpn: 2 });
    return result[ip]?.proxy === "yes";
  }
};

const isBlockedSegment = ({ nextUrl: { pathname } }: NextRequest) =>
  pathname.startsWith(VPN_BLOCKED_PATH) ||
  pathname.startsWith(GEO_BLOCKED_PATH) ||
  pathname.startsWith(GOVERNANCE_ONLY_PATH);

export const config = {
  // Next.js requires that this is a static string and fails to read it if it's
  // a String.raw, so let's disable this rule
  // eslint-disable-next-line unicorn/prefer-string-raw
  matcher: ["/((?!_next/static|_next/image|api/|terms-of-service|.*\\.).*)"],
};
