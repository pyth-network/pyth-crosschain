import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { Cookies } from "../../../../cookies/initialAccessTokenCookie";

export async function POST(request: NextRequest) {
  await Cookies.setInitialAccessToken(request);
  return redirect("/playground");
}
