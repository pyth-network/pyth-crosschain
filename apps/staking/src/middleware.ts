import { type NextRequest, NextResponse } from "next/server";

import { BLOCKED_SEGMENT } from "./config/isomorphic";
import { BLOCKED_REGIONS } from "./config/server";

export const middleware = (request: NextRequest) => {
  if (blockRequest(request)) {
    return NextResponse.rewrite(new URL(`/${BLOCKED_SEGMENT}`, request.url));
  } else if (request.nextUrl.pathname.startsWith("/blocked")) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  } else {
    return;
  }
};

const blockRequest = (request: NextRequest) =>
  request.geo?.country !== undefined &&
  BLOCKED_REGIONS.includes(request.geo.country.toLowerCase());

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
