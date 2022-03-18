// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythStructs.sol";

contract PythStorage {
    struct Provider {
        uint16 chainId;

        uint16 governanceChainId;
        bytes32 governanceContract;

        uint16 pyth2WormholeChainId;
        bytes32 pyth2WormholeEmitter;
    }

    struct State {
        address payable wormhole;

        Provider provider;

        // Mapping of consumed governance actions
        mapping(bytes32 => bool) consumedGovernanceActions;

        // Mapping of initialized implementations
        mapping(address => bool) initializedImplementations;

        // Mapping of cached price information
        // priceId => PriceInfo
        mapping(bytes32 => PythStructs.PriceInfo) latestPriceInfo;
    }
}

contract PythState {
    PythStorage.State _state;
}
