import { headers } from "next/headers";

import {
  demand,
  IS_PREVIEW_SERVER,
  IS_PRODUCTION_SERVER,
} from "../config/server";

/**
 * Returns an absolute URL for the given pathname.
 *
 * @param pathname - The pathname to make absolute.
 * @returns A URL object with the absolute URL.
 */
export async function absoluteUrl(pathname: string) {
  let origin: string | undefined;

  try {
    // note that using headers() makes the context dynamic (disables full static optimization)
    const nextHeaders = await headers();
    // this can be comma-separated, so we take the first one
    const xfHost = nextHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = xfHost ?? nextHeaders.get("host") ?? undefined;

    // this can be comma-separated, so we take the first one
    const proto =
      nextHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host?.startsWith("localhost") ? "http" : "https");

    // if we have a host and a proto, we can construct the origin
    if (host && proto) origin = `${proto}://${host}`;
  } catch {
    // headers() is unavailable
  }

  // Fallbacks for requests where headers() is not available
  if (!origin) {
    if (IS_PRODUCTION_SERVER) {
      const productionUrl = demand("VERCEL_PROJECT_PRODUCTION_URL");
      origin = `https://${productionUrl}`;
    } else if (IS_PREVIEW_SERVER) {
      const previewUrl = demand("VERCEL_URL");
      origin = `https://${previewUrl}`;
    } else {
      origin = "http://localhost:3003";
    }
  }

  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(origin + path);
}
