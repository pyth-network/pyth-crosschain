import { type NextRequest, NextResponse } from "next/server";
import ProxyCheck from "proxycheck-ts";

import {
  REGION_BLOCKED_SEGMENT,
  VPN_BLOCKED_SEGMENT,
} from "./config/isomorphic";
import { BLOCKED_REGIONS, PROXYCHECK_API_KEY } from "./config/server";

const proxyCheckClient = PROXYCHECK_API_KEY
  ? new ProxyCheck({ api_key: PROXYCHECK_API_KEY })
  : undefined;

export const middleware = async (request: NextRequest) => {
  if (isRegionBlocked(request)) {
    return NextResponse.rewrite(
      new URL(`/${REGION_BLOCKED_SEGMENT}`, request.url),
    );
  } else if (await isProxyBlocked(request)) {
    return NextResponse.rewrite(
      new URL(`/${VPN_BLOCKED_SEGMENT}`, request.url),
    );
  } else {
    const { pathname } = request.nextUrl;
    return pathname.startsWith(`/${REGION_BLOCKED_SEGMENT}`) ||
      pathname.startsWith(`/${VPN_BLOCKED_SEGMENT}`)
      ? NextResponse.rewrite(new URL("/not-found", request.url))
      : undefined;
  }
};

const isRegionBlocked = (request: NextRequest) =>
  request.geo?.country !== undefined &&
  BLOCKED_REGIONS.includes(request.geo.country.toLowerCase());

const isProxyBlocked = async ({ ip }: NextRequest) => {
  if (proxyCheckClient === undefined || ip === undefined) {
    return false;
  } else {
    const result = await proxyCheckClient.checkIP(ip, { vpn: 2 });
    return result[ip]?.proxy === "yes";
  }
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
