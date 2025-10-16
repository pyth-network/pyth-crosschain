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
        uint32 existsFlags;  // Bitmap: bit 0-31 for up to 32 properties
        int64 price;
        int64 bestBidPrice;
        int64 bestAskPrice;
        
        // Slot 2: 8 + 8 + 8 + 8 = 32 bytes (fully packed)
        int64 confidence;
        int64 fundingRate;
        uint64 fundingTimestamp;
        uint64 fundingRateInterval;
        
        // Slot 3: 2 + 2 = 4 bytes (28 bytes wasted, but unavoidable)
        uint16 publisherCount;
        int16 exponent;
    }

    struct Update {
        uint64 timestamp;
        Channel channel;
        Feed[] feeds;
    }

    // Bitmap constants for Feed.existsFlags
    uint32 constant PRICE_EXISTS = 0x01;              // bit 0
    uint32 constant BEST_BID_EXISTS = 0x02;           // bit 1
    uint32 constant BEST_ASK_EXISTS = 0x04;           // bit 2
    uint32 constant PUBLISHER_COUNT_EXISTS = 0x08;    // bit 3
    uint32 constant EXPONENT_EXISTS = 0x10;           // bit 4
    uint32 constant CONFIDENCE_EXISTS = 0x20;         // bit 5
    uint32 constant FUNDING_RATE_EXISTS = 0x40;       // bit 6
    uint32 constant FUNDING_TS_EXISTS = 0x80;         // bit 7
    uint32 constant FUNDING_INTERVAL_EXISTS = 0x100;  // bit 8
}

