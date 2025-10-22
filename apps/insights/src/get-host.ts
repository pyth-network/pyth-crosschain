import { headers } from "next/headers";

/**
 * Returns the host of the current request.
 *
 * @returns The host of the current request.
 */
export const getHost = async () => {
  const nextHeaders = await headers();
  const xfHost = nextHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost ?? nextHeaders.get("host") ?? undefined;
  if (host === undefined) {
    throw new NoHostError();
  } else {
    const proto =
      nextHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host.startsWith("localhost") ? "http" : "https");

    return `${proto}://${host}`;
  }
};

class NoHostError extends Error {
  constructor() {
    super(
      "Request had neither an `x-forwarded-host` header nor a `host` header",
    );
    this.name = "NoHostError";
  }
}
