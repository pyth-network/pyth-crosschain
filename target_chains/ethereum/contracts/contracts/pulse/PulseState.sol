// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;
    // Maximum number of price feeds per request. This limit keeps gas costs predictable and reasonable. 10 is a reasonable number for most use cases.
    // Requests with more than 10 price feeds should be split into multiple requests
    uint8 public constant MAX_PRICE_IDS = 10;

    struct Request {
        // Slot 1: 8 + 8 + 4 + 12 = 32 bytes
        uint64 sequenceNumber;
        uint64 publishTime;
        uint32 callbackGasLimit;
        // 12 bytes padding

        // Slot 2: 20 + 12 = 32 bytes
        address requester; // 20 bytes
        //12 bytes padding

        // Slot 3: 20 + 12 = 32 bytes
        address provider; // 20 bytes
        //12 bytes padding
        // Slot 4: 16 + 16 = 32 bytes
        uint128 fee; // 16 bytes (we could make this a uint96 and fit it into slot 1)
        // 16 bytes padding

        // Dynamic array starts at its own slot
        bytes8[] priceIdPrefixes;
    }

    struct ProviderInfo {
        // Slot 1: 16 + 16 = 32 bytes
        uint128 baseFeeInWei;
        uint128 feePerFeedInWei;
        // Slot 2: 16 + 16 = 32 bytes
        uint128 feePerGasInWei;
        uint128 accruedFeesInWei;
        // Slot 3: 20 + 1 + 11 = 32 bytes
        address feeManager; // 20 bytes
        bool isRegistered; // 1 byte
        // 11 bytes padding
    }

    struct State {
        // Slot 1: 20 + 8 + 4 = 32 bytes
        address admin; // 20 bytes
        uint64 currentSequenceNumber; // 8 bytes
        uint32 exclusivityPeriodSeconds; // 4 bytes
        // Slot 2: 20 + 8 + 4 = 32 bytes
        address pyth; // 20 bytes
        uint64 firstUnfulfilledSeq; // 8 bytes
        // 4 bytes padding

        // Slot 3: 20 + 12 = 32 bytes
        address defaultProvider; // 20 bytes
        // 12 bytes padding

        // Slot 4: 16 + 16 = 32 bytes
        uint128 pythFeeInWei; // 16 bytes
        uint128 accruedFeesInWei; // 16 bytes
        // These take their own slots regardless of ordering
        Request[NUM_REQUESTS] requests;
        mapping(bytes32 => Request) requestsOverflow;
        mapping(address => ProviderInfo) providers;
    }
    State internal _state;
}
