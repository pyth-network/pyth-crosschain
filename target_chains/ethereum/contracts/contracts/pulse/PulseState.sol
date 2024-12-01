// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;

    struct Request {
        uint64 sequenceNumber;
        uint256 publishTime;
        bytes32 priceIdsHash;
        uint256 callbackGasLimit;
        address requester;
    }

    struct State {
        address admin;
        uint128 pythFeeInWei;
        uint128 accruedFeesInWei;
        address pyth;
        uint64 currentSequenceNumber;
        address feeManager;
        Request[32] requests;
        mapping(bytes32 => Request) requestsOverflow;
    }

    State internal _state;
}
