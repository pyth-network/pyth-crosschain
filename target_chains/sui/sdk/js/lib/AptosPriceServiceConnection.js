"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AptosPriceServiceConnection = void 0;
const price_service_client_1 = require("@pythnetwork/price-service-client");
const aptos_1 = require("aptos");
const buffer_1 = require("buffer");
class AptosPriceServiceConnection extends price_service_client_1.PriceServiceConnection {
    /**
     * Gets price update data which then can be submitted to the Pyth contract to update the prices.
     * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
     *
     * @param priceIds Array of hex-encoded price ids.
     * @returns Array of price update data.
     */
    async getPriceFeedsUpdateData(priceIds) {
        // Fetch the latest price feed update VAAs from the price service
        const latestVaas = await this.getLatestVaas(priceIds);
        return latestVaas.map((vaa) => Array.from(buffer_1.Buffer.from(vaa, "base64")));
    }
    /**
     * Serializes the given updateData using BCS. Browser wallets typically automatically
     * serialize the data, but this function can be used to manually serialize the update data
     * if necessary.
     */
    static serializeUpdateData(updateData) {
        const serializer = new aptos_1.BCS.Serializer();
        serializer.serializeU32AsUleb128(updateData.length);
        updateData.forEach((vaa) => serializer.serializeBytes(buffer_1.Buffer.from(vaa)));
        return serializer.getBytes();
    }
}
exports.AptosPriceServiceConnection = AptosPriceServiceConnection;
