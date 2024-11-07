// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PulseState {
    uint8 public constant NUM_REQUESTS = 32;
    bytes1 public constant NUM_REQUESTS_MASK = 0x1f;

    struct Request {
        address provider;
        uint64 sequenceNumber;
        uint256 publishTime;
        bytes32[] priceIds;
        uint256 callbackGasLimit;
        address requester;
    }

    struct ProviderInfo {
        uint64 sequenceNumber;
        uint128 feeInWei;
        uint128 accruedFeesInWei;
        bytes uri;
        address feeManager;
        uint32 maxNumPrices;
        uint128 feePerGas;
    }

    struct State {
        address admin;
        uint128 pythFeeInWei;
        uint128 accruedPythFeesInWei;
        address defaultProvider;
        address pyth;
        Request[32] requests;
        mapping(bytes32 => Request) requestsOverflow;
        mapping(address => ProviderInfo) providers;
    }

    State internal _state;
}
