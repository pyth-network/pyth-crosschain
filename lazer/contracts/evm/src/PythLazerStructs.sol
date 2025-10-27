// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

library PythLazerStructs {
    enum Channel {
        Invalid,
        RealTime,
        FixedRate50,
        FixedRate200,
        FixedRate1000
    }

    enum PriceFeedProperty {
        Price,
        BestBidPrice,
        BestAskPrice,
        PublisherCount,
        Exponent,
        Confidence,
        FundingRate,
        FundingTimestamp,
        FundingRateInterval
    }

    struct Feed {
        // Slot 1: 16 + 4 + 8 + 2 + 2 = 32 bytes (fully packed!)
        uint128 existsFlags;      // Bitmap: bit 0-127 for up to 128 properties
        uint32 feedId;
        int64 _price;
        uint16 _publisherCount;
        int16 _exponent;
        // Slot 2: 8 + 8 + 8 + 8 = 32 bytes (fully packed)
        int64 _bestBidPrice;
        int64 _bestAskPrice;
        uint64 _confidence;
        int64 _fundingRate;
        // Slot 3: 8 + 8 = 16 bytes (16 bytes wasted)
        uint64 _fundingTimestamp;
        uint64 _fundingRateInterval;
    }

    struct Update {
        uint64 timestamp;
        Channel channel;
        Feed[] feeds;
    }

    // Bitmap constants for Feed.existsFlags (supports up to 128 properties)
    uint128 constant PRICE_EXISTS = 1 << 0;
    uint128 constant BEST_BID_EXISTS = 1 << 1;
    uint128 constant BEST_ASK_EXISTS = 1 << 2;
    uint128 constant PUBLISHER_COUNT_EXISTS = 1 << 3;
    uint128 constant EXPONENT_EXISTS = 1 << 4;
    uint128 constant CONFIDENCE_EXISTS = 1 << 5;
    uint128 constant FUNDING_RATE_EXISTS = 1 << 6;
    uint128 constant FUNDING_TIMESTAMP_EXISTS = 1 << 7;
    uint128 constant FUNDING_RATE_INTERVAL_EXISTS = 1 << 8;
}
