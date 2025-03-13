import {
  PriceServiceConnection,
  HexString,
} from "@pythnetwork/price-service-client";
import { Buffer } from "buffer";

export class EvmPriceServiceConnection extends PriceServiceConnection {
  /**
   * Gets price update data which then can be submitted to Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  async getPriceFeedsUpdateData(priceIds: HexString[]): Promise<string[]> {
    const latestVaas = await this.getLatestVaas(priceIds);
    return latestVaas.map(
      (vaa) => "0x" + Buffer.from(vaa, "base64").toString("hex"),
    );
  }
}
