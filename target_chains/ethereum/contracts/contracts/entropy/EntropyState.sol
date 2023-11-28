// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";

contract EntropyInternalStructs {
    uint8 public constant NUM_REQUESTS = 8;

    struct State {
        uint128 pythFeeInWei;
        uint128 accruedPythFeesInWei;
        // TODO: must be kept in sync with above
        EntropyStructs.Request[8] requests;
        mapping(bytes32 => EntropyStructs.Request) requestsOverflow;
        mapping(address => EntropyStructs.ProviderInfo) providers;
    }
}

contract EntropyState {
    EntropyInternalStructs.State _state;
}
