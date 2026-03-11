import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Cookies } from "../../../../cookies/initialAccessTokenCookie";

export async function POST(request: NextRequest) {
  await Cookies.setInitialAccessToken(request);
  return NextResponse.redirect(new URL("/playground", request.url), { status: 303 });
}
