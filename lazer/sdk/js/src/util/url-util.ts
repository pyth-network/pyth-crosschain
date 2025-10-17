const ACCESS_TOKEN_QUERY_PARAM_KEY = "ACCESS_TOKEN";

/**
 * Given a URL to a hosted lazer stream service and a possible auth token,
 * appends the auth token as a query parameter and returns the URL with the token
 * contained within.
 * If the URL provided is nullish, it is returned as-is (in the same nullish format).
 * If the token is nullish, the baseUrl given is returned, instead.
 */
export function addAuthTokenToWebSocketUrl(
  baseUrl: string | null | undefined,
  authToken: string | null | undefined,
) {
  if (!baseUrl || !authToken) return baseUrl;
  const parsedUrl = new URL(baseUrl);
  parsedUrl.searchParams.set(ACCESS_TOKEN_QUERY_PARAM_KEY, authToken);

  return parsedUrl.toString();
}
