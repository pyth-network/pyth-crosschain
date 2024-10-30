// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProxyCallsExample {
    address private pythAddress;
    bytes32 private priceId;

    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime; // Using uint256 as Solidity does not have a native uint type
    }

    struct PriceFeed {
        bytes32 id;
        Price price;
        Price emaPrice;
    }

    // Storage variables for the Price and PriceFeed data
    Price private price;
    PriceFeed private priceFeed;

    constructor(address _pythAddress, bytes32 _priceId) {
        pythAddress = _pythAddress;
        priceId = _priceId;
    }
}
