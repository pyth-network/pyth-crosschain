import {
  PriceServiceConnection,
  HexString,
} from "@pythnetwork/price-service-client";
import { Buffer } from "buffer";

export class SuiPriceServiceConnection extends PriceServiceConnection {
  /**
   * Gets price update data (either batch price attestation VAAs or accumulator messages, depending on the chosen endpoint), which then
   * can be submitted to the Pyth contract to update the prices. This will throw an axios error if there is a network problem or
   * the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of buffers containing the price update data.
   */
  async getPriceFeedsUpdateData(priceIds: HexString[]): Promise<Buffer[]> {
    // Fetch the latest price feed update VAAs from the price service
    const latestVaas = await this.getLatestVaas(priceIds);
    return latestVaas.map((vaa) => Buffer.from(vaa, "base64"));
  }
}
