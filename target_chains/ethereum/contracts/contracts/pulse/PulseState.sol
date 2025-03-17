// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;

    struct Request {
        // Storage word 1
        address requester;
        uint64 sequenceNumber;
        // 4 bytes unused
        // Storage word 2
        address provider;
        uint64 publishTime;
        // 4 bytes unused
        // Storage word 3
        bytes32 priceIdsHash;
        // Storage word 4
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
        // Storage word 1
        uint128 pythFeeInWei;
        uint128 accruedFeesInWei;
        // Storage word 2
        address pyth;
        uint64 currentSequenceNumber;
        // 4 bytes unused
        // Storage word 3
        address defaultProvider;
        // 12 bytes unused
        // Storage word 4
        uint256 exclusivityPeriodSeconds;
        // Storage word 5
        address admin;
        // 12 bytes unused
        Request[NUM_REQUESTS] requests;
        mapping(bytes32 => Request) requestsOverflow;
        mapping(address => ProviderInfo) providers;
    }

    State internal _state;
}
