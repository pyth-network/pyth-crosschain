// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";

contract EntropyInternalStructs {
    struct State {
        uint128 pythFeeInWei;
        uint128 accruedPythFeesInWei;
        mapping(address => EntropyStructs.ProviderInfo) providers;
        mapping(bytes32 => EntropyStructs.Request) requests;
    }
}

contract EntropyState {
    EntropyInternalStructs.State _state;
}
