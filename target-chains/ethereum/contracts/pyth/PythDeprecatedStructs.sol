// contracts/PythDeprecatedStructs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

// This contract contains self contained structs of all our deprecated structs.
// When deprecating the structs, make sure that there be no dependency to
// the sdk as the sdk might change.
//
// By storing these structs, we keep deprecated fields definitions correctly. Then,
// in the future, we can use them to cleanup their storage and redeem some gas back.
contract PythDeprecatedStructs {
    // Structs related to the _deprecatedLatestPriceInfoV1
    enum DeprecatedPriceStatusV1 {
        UNKNOWN,
        TRADING,
        HALTED,
        AUCTION
    }

    struct DeprecatedPriceFeedV1 {
        // The price ID.
        bytes32 id;
        // Product account key.
        bytes32 productId;
        // The current price.
        int64 price;
        // Confidence interval around the price.
        uint64 conf;
        // Price exponent.
        int32 expo;
        // Status of price.
        DeprecatedPriceStatusV1 status;
        // Maximum number of allowed publishers that can contribute to a price.
        uint32 maxNumPublishers;
        // Number of publishers that made up current aggregate.
        uint32 numPublishers;
        // Exponentially moving average price.
        int64 emaPrice;
        // Exponentially moving average confidence interval.
        uint64 emaConf;
        // Unix timestamp describing when the price was published
        uint64 publishTime;
        // Price of previous price with TRADING status
        int64 prevPrice;
        // Confidence interval of previous price with TRADING status
        uint64 prevConf;
        // Unix timestamp describing when the previous price with TRADING status was published
        uint64 prevPublishTime;
    }

    struct DeprecatedPriceInfoV1 {
        uint256 attestationTime;
        uint256 arrivalTime;
        uint256 arrivalBlock;
        DeprecatedPriceFeedV1 priceFeed;
    }

    // Structs related to the _deprecatedLatestPriceInfoV2
    struct DeprecatedPriceV2 {
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
    struct DeprecatedPriceFeedV2 {
        // The price ID.
        bytes32 id;
        // Latest available price
        DeprecatedPriceV2 price;
        // Latest available exponentially-weighted moving average price
        DeprecatedPriceV2 emaPrice;
    }

    struct DeprecatedPriceInfoV2 {
        uint256 attestationTime;
        uint256 arrivalTime;
        uint256 arrivalBlock;
        DeprecatedPriceFeedV2 priceFeed;
    }
}
