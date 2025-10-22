import BN from "bn.js";
export type AccumulatorUpdateData = {
    vaa: Buffer;
    updates: {
        message: Buffer;
        proof: number[][];
    }[];
};
export type PriceFeedMessage = {
    feedId: Buffer;
    price: BN;
    confidence: BN;
    exponent: number;
    publishTime: BN;
    prevPublishTime: BN;
    emaPrice: BN;
    emaConf: BN;
};
export type TwapMessage = {
    feedId: Buffer;
    cumulativePrice: BN;
    cumulativeConf: BN;
    numDownSlots: BN;
    exponent: number;
    publishTime: BN;
    prevPublishTime: BN;
    publishSlot: BN;
};
export declare function isAccumulatorUpdateData(updateBytes: Buffer): boolean;
export declare function parsePriceFeedMessage(message: Buffer): PriceFeedMessage;
export declare function parseTwapMessage(message: Buffer): TwapMessage;
/**
 * An AccumulatorUpdateData contains a VAA and a list of updates. This function returns a new serialized AccumulatorUpdateData with only the updates in the range [start, end).
 */
export declare function sliceAccumulatorUpdateData(data: Buffer, start?: number, end?: number): Buffer;
export declare function parseAccumulatorUpdateData(data: Buffer): AccumulatorUpdateData;
