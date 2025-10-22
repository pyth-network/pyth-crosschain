/**
 * Represents an aggregate price from Pyth publisher feeds.
 */
export interface PriceFeed {
    /**
     * Exponentially-weighted moving average Price
     */
    ema_price: Price;
    /**
     * Unique identifier for this price.
     */
    id: string;
    /**
     * Metadata of the price
     */
    metadata?: PriceFeedMetadata;
    /**
     * Price
     */
    price: Price;
    /**
     * VAA of the price
     */
    vaa?: string;
}
/**
 * Exponentially-weighted moving average Price
 *
 * Represents a Pyth price
 *
 * Price
 */
export interface Price {
    /**
     * Confidence interval around the price.
     */
    conf: string;
    /**
     * Price exponent.
     */
    expo: number;
    /**
     * Price.
     */
    price: string;
    /**
     * Publish Time of the price
     */
    publish_time: number;
}
/**
 * Metadata of the price
 *
 * Represents metadata of a price feed.
 */
export interface PriceFeedMetadata {
    /**
     * Attestation time of the price
     */
    attestation_time?: number;
    /**
     * Chain of the emitter
     */
    emitter_chain: number;
    /**
     * The time that the previous price was published
     */
    prev_publish_time?: number;
    /**
     * The time that the price service received the price
     */
    price_service_receive_time?: number;
    /**
     * Sequence number of the price
     */
    sequence_number?: number;
    /**
     * Pythnet slot number of the price
     */
    slot?: number;
}
export declare class Convert {
    static toPriceFeed(json: any): PriceFeed;
    static priceFeedToJson(value: PriceFeed): any;
    static toPrice(json: any): Price;
    static priceToJson(value: Price): any;
    static toPriceFeedMetadata(json: any): PriceFeedMetadata;
    static priceFeedMetadataToJson(value: PriceFeedMetadata): any;
}
