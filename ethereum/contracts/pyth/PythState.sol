// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythStructs.sol";

contract PythStorage {
    struct State {
        address payable wormhole;
        uint16 pyth2WormholeChainId;
        bytes32 pyth2WormholeEmitter;

        // Mapping of cached price information
        // priceId => PriceInfo
        mapping(bytes32 => PythStructs.PriceInfo) latestPriceInfo;
    }
}

contract PythState {
    PythStorage.State _state;
}
