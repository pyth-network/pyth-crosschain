// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythInternalStructs.sol";

contract PythStorage {
    struct State {
        address payable wormhole;
        uint16 pyth2WormholeChainId; // Deprecated, replaced by validDataSources/isValidDataSource
        bytes32 pyth2WormholeEmitter; // Ditto

        // Mapping of cached price information
        // priceId => PriceInfo
        mapping(bytes32 => PythInternalStructs.PriceInfo) latestPriceInfo;

        // guards if the migration to multiple sources was already performed
        bool switchedToMultiSources;

        // For tracking all active emitter/chain ID pairs
        PythInternalStructs.DataSource[] validDataSources;

        // (chainId, emitterAddress) => isValid; takes advantage of
        // constant-time mapping lookup for VM verification
        mapping(bytes32 => bool) isValidDataSource;
    }
}

contract PythState {
    PythStorage.State _state;
}
