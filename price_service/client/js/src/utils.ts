import type { HexString } from "@pythnetwork/price-service-sdk";

/**
 * Convert http(s) endpoint to ws(s) endpoint.
 *
 * @param endpoint -  Http(s) protocol endpoint
 * @returns Ws(s) protocol endpoint of the same address
 */
export function makeWebsocketUrl(endpoint: string) {
  const url = new URL(endpoint);

  // Switch from http/https to ws/wss, if already ws/wss do nothing
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";

  // Ensure the pathname ends with a trailing slash and add ws
  url.pathname = url.pathname.replace(/\/?$/, "/");
  url.pathname = url.pathname + "ws";

  return url.toString();
}

export function removeLeading0xIfExists(id: HexString): HexString {
  return id.startsWith("0x") ? id.slice(2) : id;
}
