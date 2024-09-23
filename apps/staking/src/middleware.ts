import { type NextRequest, NextResponse } from "next/server";
import ProxyCheck from "proxycheck-ts";

import {
  REGION_BLOCKED_SEGMENT,
  VPN_BLOCKED_SEGMENT,
} from "./config/isomorphic";
import { BLOCKED_REGIONS, PROXYCHECK_API_KEY } from "./config/server";

const PROXY_BLOCK_PATH = `/${REGION_BLOCKED_SEGMENT}`;
const VPN_BLOCK_PATH = `/${VPN_BLOCKED_SEGMENT}`;

const proxyCheckClient = PROXYCHECK_API_KEY
  ? new ProxyCheck({ api_key: PROXYCHECK_API_KEY })
  : undefined;

export const middleware = async (request: NextRequest) => {
  if (isRegionBlocked(request)) {
    return rewrite(request, PROXY_BLOCK_PATH);
  } else if (await isProxyBlocked(request)) {
    return rewrite(request, VPN_BLOCK_PATH);
  } else if (isBlockedSegment(request)) {
    return rewrite(request, "/not-found");
  } else {
    return;
  }
};

const rewrite = (request: NextRequest, path: string) =>
  NextResponse.rewrite(new URL(path, request.url));

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
  pathname.startsWith(`/${REGION_BLOCKED_SEGMENT}`) ||
  pathname.startsWith(`/${VPN_BLOCKED_SEGMENT}`);

export const config = {
  matcher: [String.raw`/((?!_next/static|_next/image|.*\.).*)`],
};
