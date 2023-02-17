"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvmPriceServiceConnection = void 0;
const pyth_common_js_1 = require("@pythnetwork/pyth-common-js");
const buffer_1 = require("buffer");
class EvmPriceServiceConnection extends pyth_common_js_1.PriceServiceConnection {
  /**
   * Gets price update data which then can be submitted to Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  async getPriceFeedsUpdateData(priceIds) {
    const latestVaas = await this.getLatestVaas(priceIds);
    return latestVaas.map(
      (vaa) => "0x" + buffer_1.Buffer.from(vaa, "base64").toString("hex")
    );
  }
}
exports.EvmPriceServiceConnection = EvmPriceServiceConnection;
