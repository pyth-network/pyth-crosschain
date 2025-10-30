import { Buffer } from "node:buffer";

import type { HexString, PriceUpdate } from "@pythnetwork/hermes-client";
import { HermesClient } from "@pythnetwork/hermes-client";

export class SuiPriceServiceConnection extends HermesClient {
  /**
   * Gets price update data (either batch price attestation VAAs or accumulator messages, depending on the chosen endpoint), which then
   * can be submitted to the Pyth contract to update the prices. This will throw an axios error if there is a network problem or
   * the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds - Array of hex-encoded price ids.
   * @returns Array of buffers containing the price update data.
   */
  async getPriceFeedsUpdateData(priceIds: HexString[]): Promise<Buffer[]> {
    // Fetch the latest price feed update VAAs from the price service
    const updateData: PriceUpdate = await this.getLatestPriceUpdates(priceIds, {
      encoding: "base64",
      parsed: false,
    });
    return updateData.binary.data.map((update) =>
      Buffer.from(update, "base64"),
    );
  }
}
