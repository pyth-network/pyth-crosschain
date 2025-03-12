// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;
    // Maximum number of price feeds per request. This limit keeps gas costs predictable and reasonable. 10 is a reasonable number for most use cases.
    // Requests with more than 10 price feeds should be split into multiple requests
    uint8 public constant MAX_PRICE_IDS = 10;

    struct Request {
        uint64 sequenceNumber;
        uint64 publishTime;
        // TODO: this is going to absolutely explode gas costs. Need to do something smarter here.
        // possible solution is to hash the price ids and store the hash instead.
        // The ids themselves can be retrieved from the event.
        bytes32[MAX_PRICE_IDS] priceIds;
        uint8 numPriceIds; // Actual number of price IDs used
        uint256 callbackGasLimit;
        address requester;
        address provider;
        uint128 fee;
    }

    struct ProviderInfo {
        uint128 baseFeeInWei;
        uint128 feePerFeedInWei;
        uint128 feePerGasInWei;
        uint128 accruedFeesInWei;
        address feeManager;
        bool isRegistered;
    }

    struct State {
        address admin;
        uint128 pythFeeInWei;
        uint128 accruedFeesInWei;
        address pyth;
        uint64 currentSequenceNumber;
        address defaultProvider;
        uint256 exclusivityPeriodSeconds;
        Request[NUM_REQUESTS] requests;
        mapping(bytes32 => Request) requestsOverflow;
        mapping(address => ProviderInfo) providers;
        uint64 firstUnfulfilledSeq; // All sequences before this are fulfilled
    }

    State internal _state;
}
