// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

library PythLazerStructs {
    enum Channel {
        Invalid,
        RealTime,
        FixedRate50,
        FixedRate200
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
        // Slot 1: 4 + 4 + 8 + 8 + 8 = 32 bytes (fully packed)
        uint32 feedId;
        uint32 existsFlags; // Bitmap: bit 0-31 for up to 32 properties
        int64 _price;
        int64 _bestBidPrice;
        int64 _bestAskPrice;
        // Slot 2: 8 + 8 + 8 + 8 = 32 bytes (fully packed)
        uint64 _confidence;
        int64 _fundingRate;
        uint64 _fundingTimestamp;
        uint64 _fundingRateInterval;
        // Slot 3: 2 + 2 = 4 bytes (28 bytes wasted, but unavoidable)
        uint16 _publisherCount;
        int16 _exponent;
    }

    struct Update {
        uint64 timestamp;
        Channel channel;
        Feed[] feeds;
    }

    // Bitmap constants for Feed.existsFlags
    uint32 constant PRICE_EXISTS = 1 << 0;
    uint32 constant BEST_BID_EXISTS = 1 << 1;
    uint32 constant BEST_ASK_EXISTS = 1 << 2;
    uint32 constant PUBLISHER_COUNT_EXISTS = 1 << 3;
    uint32 constant EXPONENT_EXISTS = 1 << 4;
    uint32 constant CONFIDENCE_EXISTS = 1 << 5;
    uint32 constant FUNDING_RATE_EXISTS = 1 << 6;
    uint32 constant FUNDING_TIMESTAMP_EXISTS = 1 << 7;
    uint32 constant FUNDING_RATE_INTERVAL_EXISTS = 1 << 8;
}
