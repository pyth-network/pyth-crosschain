export type UnixTimestamp = number;
export type DurationInSeconds = number;
export type HexString = string;
export { isAccumulatorUpdateData, sliceAccumulatorUpdateData, parseAccumulatorUpdateData, AccumulatorUpdateData, parsePriceFeedMessage, parseTwapMessage, } from "./AccumulatorUpdateData";
/**
 * A Pyth Price represented as `${price} ± ${conf} * 10^${expo}` published at `publishTime`.
 */
export declare class Price {
    conf: string;
    expo: number;
    price: string;
    publishTime: UnixTimestamp;
    constructor(rawPrice: {
        conf: string;
        expo: number;
        price: string;
        publishTime: UnixTimestamp;
    });
    /**
     * Get price as number. Warning: this conversion might result in an inaccurate number.
     * We store price and confidence values in our Oracle at 64-bit precision, but the JavaScript
     * number type can only represent numbers with 52-bit precision. So if a price or confidence
     * is larger than 52-bits, the conversion will lose the most insignificant bits.
     *
     * @returns a floating point number representing the price
     */
    getPriceAsNumberUnchecked(): number;
    /**
     * Get price as number. Warning: this conversion might result in an inaccurate number.
     * Explanation is the same as `priceAsNumberUnchecked()` documentation.
     *
     * @returns a floating point number representing the price
     */
    getConfAsNumberUnchecked(): number;
    static fromJson(json: any): Price;
    toJson(): any;
}
/**
 * Metadata about the price
 *
 * Represents metadata of a price feed.
 */
export declare class PriceFeedMetadata {
    /**
     * Attestation time of the price
     */
    attestationTime?: number;
    /**
     * Chain of the emitter
     */
    emitterChain: number;
    /**
     * The time that the price service received the price
     */
    priceServiceReceiveTime?: number;
    /**
     * Sequence number of the price
     */
    sequenceNumber?: number;
    /**
     * Pythnet slot number of the price
     */
    slot?: number;
    /**
     * The time that the previous price was published
     */
    prevPublishTime?: number;
    constructor(metadata: {
        attestationTime?: number;
        emitterChain: number;
        receiveTime?: number;
        sequenceNumber?: number;
        slot?: number;
        prevPublishTime?: number;
    });
    static fromJson(json: any): PriceFeedMetadata | undefined;
    toJson(): any;
}
/**
 * Pyth Price Feed
 *
 * Represents a current aggregation price from pyth publisher feeds.
 */
export declare class PriceFeed {
    /**
     * Exponentially-weighted moving average Price
     */
    private emaPrice;
    /**
     * Unique identifier for this price.
     */
    id: HexString;
    /**
     * Metadata of the price
     */
    metadata?: PriceFeedMetadata;
    /**
     * VAA of the price
     */
    vaa?: string;
    /**
     * Price
     */
    private price;
    constructor(rawFeed: {
        emaPrice: Price;
        id: HexString;
        metadata?: PriceFeedMetadata;
        vaa?: string;
        price: Price;
    });
    static fromJson(json: any): PriceFeed;
    toJson(): any;
    /**
     * Get the price and confidence interval as fixed-point numbers of the form a * 10^e.
     * This function returns the current best estimate of the price at the time that this `PriceFeed` was
     * published (`publishTime`). The returned price can be from arbitrarily far in the past; this function
     * makes no guarantees that the returned price is recent or useful for any particular application.
     *
     * Users of this function should check the returned `publishTime` to ensure that the returned price is
     * sufficiently recent for their application. If you are considering using this function, it may be
     * safer / easier to use `getPriceNoOlderThan` method.
     *
     * @returns a Price that contains the price and confidence interval along with
     * the exponent for them, and publish time of the price.
     */
    getPriceUnchecked(): Price;
    /**
     * Get the exponentially-weighted moving average (EMA) price and confidence interval.
     *
     * This function returns the current best estimate of the price at the time that this `PriceFeed` was
     * published (`publishTime`). The returned price can be from arbitrarily far in the past; this function
     * makes no guarantees that the returned price is recent or useful for any particular application.
     *
     * Users of this function should check the returned `publishTime` to ensure that the returned price is
     * sufficiently recent for their application. If you are considering using this function, it may be
     * safer / easier to use `getEmaPriceNoOlderThan` method.
     *
     * At the moment, the confidence interval returned by this method is computed in
     * a somewhat questionable way, so we do not recommend using it for high-value applications.
     *
     * @returns a Price that contains the EMA price and confidence interval along with
     * the exponent for them, and publish time of the price.
     */
    getEmaPriceUnchecked(): Price;
    /**
     * Get the price if it was updated no older than `age` seconds of the current time.
     *
     * This function is a sanity-checked version of `getPriceUnchecked` which is useful in
     * applications that require a sufficiently-recent price. Returns `undefined` if the price
     * is not recent enough.
     *
     * @param age return a price as long as it has been updated within this number of seconds
     * @returns a Price struct containing the price, confidence interval along with the exponent for
     * both numbers, and its publish time, or `undefined` if no price update occurred within `age` seconds of the current time.
     */
    getPriceNoOlderThan(age: DurationInSeconds): Price | undefined;
    /**
     * Get the exponentially-weighted moving average (EMA) price if it was updated no older than
     * `age` seconds of the current time.
     *
     * This function is a sanity-checked version of `getEmaPriceUnchecked` which is useful in
     * applications that require a sufficiently-recent price. Returns `undefined` if the price
     * is not recent enough.
     *
     * At the moment, the confidence interval returned by this method is computed in
     * a somewhat questionable way, so we do not recommend using it for high-value applications.
     *
     * @param age return a price as long as it has been updated within this number of seconds
     * @returns a Price struct containing the EMA price, confidence interval along with the exponent for
     * both numbers, and its publish time, or `undefined` if no price update occurred within `age` seconds of the current time.
     */
    getEmaPriceNoOlderThan(age: DurationInSeconds): Price | undefined;
    /**
     * Get the price feed metadata.
     *
     * @returns a struct containing the attestation time, emitter chain, and the sequence number.
     * Returns `undefined` if metadata is currently unavailable.
     */
    getMetadata(): PriceFeedMetadata | undefined;
    /**
     * Get the price feed vaa.
     *
     * @returns vaa in base64.
     * Returns `undefined` if vaa is unavailable.
     */
    getVAA(): string | undefined;
}
