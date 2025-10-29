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

    // Tri-state for a property's availability within a feed at a given timestamp
    //  - NotApplicable: property not included for this feed in this update
    //  - ApplicableButMissing: included but no value available for this timestamp
    //  - Present: value exists for this timestamp
    enum PropertyState {
        NotApplicable,
        ApplicableButMissing,
        Present
    }

    struct Feed {
        // Slot 1: tri-state map (2 bits per property; encoded in this uint256)
        // Encoding per property p (0..N):
        //   bits [2*p, 2*p+1]: 00 NotApplicable, 01 ApplicableButMissing, 10 Present, 11 Reserved
        // Capacity with uint256: 256 / 2 = 128 properties supported
        uint256 triStateMap;
        // Slot 2 (fully packed = 32 bytes): 4 + 8 + 2 + 2 + 8 + 8
        uint32 feedId;           // 4
        int64 _price;            // 8
        uint16 _publisherCount;  // 2
        int16 _exponent;         // 2
        int64 _bestBidPrice;     // 8
        int64 _bestAskPrice;     // 8
        // Slot 3 (fully packed = 32 bytes): 8 + 8 + 8 + 8
        uint64 _confidence;          // 8
        int64 _fundingRate;          // 8
        uint64 _fundingTimestamp;    // 8
        uint64 _fundingRateInterval; // 8
    }

    struct Update {
        uint64 timestamp;
        Channel channel;
        Feed[] feeds;
    }

    // Deprecated exists flags removed in favor of triStateMap
}
