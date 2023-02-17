import { PriceServiceConnection, HexString } from "@pythnetwork/pyth-common-js";
export declare class EvmPriceServiceConnection extends PriceServiceConnection {
  /**
   * Gets price update data which then can be submitted to Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  getPriceFeedsUpdateData(priceIds: HexString[]): Promise<string[]>;
}
