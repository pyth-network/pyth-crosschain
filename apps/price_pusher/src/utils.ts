import { HexString } from "@pythnetwork/price-service-client";

export type PctNumber = number;
export type DurationInSeconds = number;
export const txSpeeds = ["slow", "standard", "fast"] as const;
export type TxSpeed = typeof txSpeeds[number];
export const customGasChainIds = [137] as const;
export type CustomGasChainId = typeof customGasChainIds[number];

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function removeLeading0x(id: HexString): HexString {
  if (id.startsWith("0x")) {
    return id.substring(2);
  }
  return id;
}

export function addLeading0x(id: HexString): `0x${string}` {
  if (id.startsWith("0x")) {
    return id as `0x${string}`;
  }
  return ("0x" + id) as `0x${string}`;
}

export function isWsEndpoint(endpoint: string): boolean {
  const url = new URL(endpoint);
  const protocol = url.protocol;

  if (protocol === "ws:" || protocol == "wss:") {
    return true;
  }

  return false;
}

export function verifyValidOption<
  options extends Readonly<Array<any>>,
  validOption extends options[number]
>(option: any, validOptions: options) {
  if (validOptions.includes(option)) {
    return option as validOption;
  }
  const errorString =
    option + " is not a valid option. Please choose between " + validOptions;
  throw new Error(errorString);
}
