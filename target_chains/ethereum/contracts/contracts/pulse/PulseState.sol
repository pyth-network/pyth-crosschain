// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;
    // Maximum number of price feeds per request. This limit keeps gas costs predictable and reasonable. 10 is a reasonable number for most use cases.
    // Requests with more than 10 price feeds should be split into multiple requests
    uint8 public constant MAX_PRICE_IDS = 2;

    struct Request {
        address requester;
        uint64 sequenceNumber;
        address provider;
        uint64 publishTime;
        bytes32 priceIdsHash;
        uint128 callbackGasLimit;
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
        uint128 pythFeeInWei;
        uint128 accruedFeesInWei;
        address pyth;
        uint64 currentSequenceNumber;
        address defaultProvider;
        uint256 exclusivityPeriodSeconds;
        address admin;
        Request[NUM_REQUESTS] requests;
        mapping(bytes32 => Request) requestsOverflow;
        mapping(address => ProviderInfo) providers;
    }

    State internal _state;
}
