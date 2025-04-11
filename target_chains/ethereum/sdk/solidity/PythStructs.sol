// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract PythStructs {
    // A price with a degree of uncertainty, represented as a price +- a confidence interval.
    //
    // The confidence interval roughly corresponds to the standard error of a normal distribution.
    // Both the price and confidence are stored in a fixed-point numeric representation,
    // `x * (10^expo)`, where `expo` is the exponent.
    //
    // Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for how
    // to how this price safely.
    struct Price {
        // Price
        int64 price;
        // Confidence interval around the price
        uint64 conf;
        // Price exponent
        int32 expo;
        // Unix timestamp describing when the price was published
        uint publishTime;
    }

    // PriceFeed represents a current aggregate price from pyth publisher feeds.
    struct PriceFeed {
        // The price ID.
        bytes32 id;
        // Latest available price
        Price price;
        // Latest available exponentially-weighted moving average price
        Price emaPrice;
    }

    struct TwapPriceFeed {
        // The price ID.
        bytes32 id;
        // Start time of the TWAP
        uint64 startTime;
        // End time of the TWAP
        uint64 endTime;
        // TWAP price
        Price twap;
        // Down slot ratio represents the ratio of price feed updates that were missed or unavailable
        // during the TWAP period, expressed as a fixed-point number between 0 and 1e6 (100%).
        // For example:
        //   - 0 means all price updates were available
        //   - 500_000 means 50% of updates were missed
        //   - 1_000_000 means all updates were missed
        // This can be used to assess the quality/reliability of the TWAP calculation.
        // Applications should define a maximum acceptable ratio (e.g. 100000 for 10%)
        // and revert if downSlotsRatio exceeds it.
        uint32 downSlotsRatio;
    }

    // Information used to calculate time-weighted average prices (TWAP)
    struct TwapPriceInfo {
        // slot 1
        int128 cumulativePrice;
        uint128 cumulativeConf;
        // slot 2
        uint64 numDownSlots;
        uint64 publishSlot;
        uint64 publishTime;
        uint64 prevPublishTime;
        // slot 3
        int32 expo;
    }
}
