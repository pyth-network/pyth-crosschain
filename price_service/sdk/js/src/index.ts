import {
  Convert,
  Price as JsonPrice,
  PriceFeed as JsonPriceFeed,
  PriceFeedMetadata as JsonPriceFeedMetadata,
} from "./schemas/PriceFeed";

export type UnixTimestamp = number;
export type DurationInSeconds = number;
export type HexString = string;

export {
  isAccumulatorUpdateData,
  sliceAccumulatorUpdateData,
  parseAccumulatorUpdateData,
  AccumulatorUpdateData,
  parsePriceFeedMessage,
  parseTwapMessage,
} from "./AccumulatorUpdateData";

/**
 * A Pyth Price represented as `${price} ± ${conf} * 10^${expo}` published at `publishTime`.
 */
export class Price {
  conf: string;
  expo: number;
  price: string;
  publishTime: UnixTimestamp;

  constructor(rawPrice: {
    conf: string;
    expo: number;
    price: string;
    publishTime: UnixTimestamp;
  }) {
    this.conf = rawPrice.conf;
    this.expo = rawPrice.expo;
    this.price = rawPrice.price;
    this.publishTime = rawPrice.publishTime;
  }

  /**
   * Get price as number. Warning: this conversion might result in an inaccurate number.
   * We store price and confidence values in our Oracle at 64-bit precision, but the JavaScript
   * number type can only represent numbers with 52-bit precision. So if a price or confidence
   * is larger than 52-bits, the conversion will lose the most insignificant bits.
   *
   * @returns a floating point number representing the price
   */
  getPriceAsNumberUnchecked(): number {
    return Number(this.price) * 10 ** this.expo;
  }

  /**
   * Get price as number. Warning: this conversion might result in an inaccurate number.
   * Explanation is the same as `priceAsNumberUnchecked()` documentation.
   *
   * @returns a floating point number representing the price
   */
  getConfAsNumberUnchecked(): number {
    return Number(this.conf) * 10 ** this.expo;
  }

  static fromJson(json: any): Price {
    const jsonPrice: JsonPrice = Convert.toPrice(json);
    return new Price({
      conf: jsonPrice.conf,
      expo: jsonPrice.expo,
      price: jsonPrice.price,
      publishTime: jsonPrice.publish_time,
    });
  }

  toJson(): any {
    const jsonPrice: JsonPrice = {
      conf: this.conf,
      expo: this.expo,
      price: this.price,
      publish_time: this.publishTime,
    };
    // this is done to avoid sending undefined values to the server
    return Convert.priceToJson(jsonPrice);
  }
}

/**
 * Metadata about the price
 *
 * Represents metadata of a price feed.
 */
export class PriceFeedMetadata {
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
  }) {
    this.attestationTime = metadata.attestationTime;
    this.emitterChain = metadata.emitterChain;
    this.priceServiceReceiveTime = metadata.receiveTime;
    this.sequenceNumber = metadata.sequenceNumber;
    this.slot = metadata.slot;
    this.prevPublishTime = metadata.prevPublishTime;
  }

  static fromJson(json: any): PriceFeedMetadata | undefined {
    if (json === undefined) {
      return undefined;
    }
    const jsonFeed: JsonPriceFeedMetadata = Convert.toPriceFeedMetadata(json);
    return new PriceFeedMetadata({
      attestationTime: jsonFeed.attestation_time,
      emitterChain: jsonFeed.emitter_chain,
      receiveTime: jsonFeed.price_service_receive_time,
      sequenceNumber: jsonFeed.sequence_number,
      slot: jsonFeed.slot,
      prevPublishTime: jsonFeed.prev_publish_time,
    });
  }

  toJson(): any {
    const jsonFeed: JsonPriceFeedMetadata = {
      attestation_time: this.attestationTime,
      emitter_chain: this.emitterChain,
      price_service_receive_time: this.priceServiceReceiveTime,
      sequence_number: this.sequenceNumber,
      slot: this.slot,
      prev_publish_time: this.prevPublishTime,
    };
    // this is done to avoid sending undefined values to the server
    return Convert.priceFeedMetadataToJson(jsonFeed);
  }
}

/**
 * Pyth Price Feed
 *
 * Represents a current aggregation price from pyth publisher feeds.
 */

export class PriceFeed {
  /**
   * Exponentially-weighted moving average Price
   */
  private emaPrice: Price;
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
  private price: Price;

  constructor(rawFeed: {
    emaPrice: Price;
    id: HexString;
    metadata?: PriceFeedMetadata;
    vaa?: string;
    price: Price;
  }) {
    this.emaPrice = rawFeed.emaPrice;
    this.id = rawFeed.id;
    this.metadata = rawFeed.metadata;
    this.vaa = rawFeed.vaa;
    this.price = rawFeed.price;
  }

  static fromJson(json: any): PriceFeed {
    const jsonFeed: JsonPriceFeed = Convert.toPriceFeed(json);
    return new PriceFeed({
      emaPrice: Price.fromJson(jsonFeed.ema_price),
      id: jsonFeed.id,
      metadata: PriceFeedMetadata.fromJson(jsonFeed.metadata),
      vaa: jsonFeed.vaa,
      price: Price.fromJson(jsonFeed.price),
    });
  }

  toJson(): any {
    const jsonFeed: JsonPriceFeed = {
      ema_price: this.emaPrice.toJson(),
      id: this.id,
      metadata: this.metadata?.toJson(),
      price: this.price.toJson(),
    };
    return Convert.priceFeedToJson(jsonFeed);
  }

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
  getPriceUnchecked(): Price {
    return this.price;
  }

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
  getEmaPriceUnchecked(): Price {
    return this.emaPrice;
  }

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
  getPriceNoOlderThan(age: DurationInSeconds): Price | undefined {
    const price = this.getPriceUnchecked();

    const currentTime: UnixTimestamp = Math.floor(Date.now() / 1000);

    // This checks the absolute difference as a sanity check
    // for the cases that the system time is behind or price
    // feed timestamp happen to be in the future (a bug).
    if (Math.abs(currentTime - price.publishTime) > age) {
      return undefined;
    }

    return price;
  }

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
  getEmaPriceNoOlderThan(age: DurationInSeconds): Price | undefined {
    const emaPrice = this.getEmaPriceUnchecked();

    const currentTime: UnixTimestamp = Math.floor(Date.now() / 1000);

    // This checks the absolute difference as a sanity check
    // for the cases that the system time is behind or price
    // feed timestamp happen to be in the future (a bug).
    if (Math.abs(currentTime - emaPrice.publishTime) > age) {
      return undefined;
    }

    return emaPrice;
  }

  /**
   * Get the price feed metadata.
   *
   * @returns a struct containing the attestation time, emitter chain, and the sequence number.
   * Returns `undefined` if metadata is currently unavailable.
   */
  getMetadata(): PriceFeedMetadata | undefined {
    return this.metadata;
  }

  /**
   * Get the price feed vaa.
   *
   * @returns vaa in base64.
   * Returns `undefined` if vaa is unavailable.
   */
  getVAA(): string | undefined {
    return this.vaa;
  }
}
