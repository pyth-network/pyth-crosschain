import { HexString } from "@pythnetwork/price-service-sdk";

/**
 * Convert http(s) endpoint to ws(s) endpoint.
 *
 * @param endpoint Http(s) protocol endpoint
 * @returns Ws(s) protocol endpoint of the same address
 */
export function makeWebsocketUrl(endpoint: string) {
  const url = new URL("ws", endpoint);
  const useHttps = url.protocol === "https:";

  url.protocol = useHttps ? "wss:" : "ws:";

  return url.toString();
}

export function removeLeading0xIfExists(id: HexString): HexString {
  if (id.startsWith("0x")) {
    return id.substring(2);
  } else {
    return id;
  }
}
