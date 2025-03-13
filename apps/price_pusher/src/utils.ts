import { HermesClient, HexString } from "@pythnetwork/hermes-client";
import { PriceItem } from "./interface";

export type PctNumber = number;
export type DurationInSeconds = number;
export const txSpeeds = ["slow", "standard", "fast"] as const;
export type TxSpeed = (typeof txSpeeds)[number];
export const customGasChainIds = [137] as const;
export type CustomGasChainId = (typeof customGasChainIds)[number];

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function removeLeading0x(id: HexString): HexString {
  if (id.startsWith("0x")) {
    return id.substring(2);
  }
  return id;
}

export const addLeading0x = (id: HexString): `0x${string}` =>
  hasLeading0x(id) ? id : `0x${id}`;

const hasLeading0x = (input: string): input is `0x${string}` =>
  input.startsWith("0x");

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
  validOption extends options[number],
>(option: any, validOptions: options) {
  if (validOptions.includes(option)) {
    return option as validOption;
  }
  const errorString =
    option + " is not a valid option. Please choose between " + validOptions;
  throw new Error(errorString);
}

export const assertDefined = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("Assertion failed: value was undefined");
  } else {
    return value;
  }
};

export async function filterInvalidPriceItems(
  hermesClient: HermesClient,
  priceItems: PriceItem[],
): Promise<{
  existingPriceItems: PriceItem[];
  invalidPriceItems: PriceItem[];
}> {
  const priceMetadata = await hermesClient.getPriceFeeds();
  const allPriceIds = priceMetadata.map((priceMetadata) => priceMetadata.id);

  // Filter out invalid price ids
  const { existingPriceItems, invalidPriceItems } = priceItems.reduce<{
    existingPriceItems: PriceItem[];
    invalidPriceItems: PriceItem[];
  }>(
    (acc, item) => {
      if (allPriceIds.includes(item.id)) {
        acc.existingPriceItems.push(item);
      } else {
        acc.invalidPriceItems.push(item);
      }
      return acc;
    },
    { existingPriceItems: [], invalidPriceItems: [] },
  );

  return { existingPriceItems, invalidPriceItems };
}
