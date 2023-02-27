import {
  PriceServiceConnection,
  HexString,
} from "@pythnetwork/price-service-client";
import { BCS } from "aptos";
import { Buffer } from "buffer";

export class AptosPriceServiceConnection extends PriceServiceConnection {
  /**
   * Gets price update data which then can be submitted to the Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  async getPriceFeedsUpdateData(priceIds: HexString[]): Promise<number[][]> {
    // Fetch the latest price feed update VAAs from the price service
    const latestVaas = await this.getLatestVaas(priceIds);
    return latestVaas.map((vaa) => Array.from(Buffer.from(vaa, "base64")));
  }

  /**
   * Serializes the given updateData using BCS. Browser wallets typically automatically
   * serialize the data, but this function can be used to manually serialize the update data
   * if necessary.
   */
  static serializeUpdateData(updateData: number[][]): Uint8Array {
    const serializer = new BCS.Serializer();
    serializer.serializeU32AsUleb128(updateData.length);
    updateData.forEach((vaa) => serializer.serializeBytes(Buffer.from(vaa)));
    return serializer.getBytes();
  }
}
