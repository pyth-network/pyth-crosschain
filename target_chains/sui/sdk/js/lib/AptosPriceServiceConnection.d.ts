import { PriceServiceConnection, HexString } from "@pythnetwork/price-service-client";
export declare class AptosPriceServiceConnection extends PriceServiceConnection {
    /**
     * Gets price update data which then can be submitted to the Pyth contract to update the prices.
     * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
     *
     * @param priceIds Array of hex-encoded price ids.
     * @returns Array of price update data.
     */
    getPriceFeedsUpdateData(priceIds: HexString[]): Promise<number[][]>;
    /**
     * Serializes the given updateData using BCS. Browser wallets typically automatically
     * serialize the data, but this function can be used to manually serialize the update data
     * if necessary.
     */
    static serializeUpdateData(updateData: number[][]): Uint8Array;
}
//# sourceMappingURL=AptosPriceServiceConnection.d.ts.map