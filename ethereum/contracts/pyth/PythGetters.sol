// contracts/Getters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../interfaces/IWormhole.sol";

import "./PythState.sol";

contract PythGetters is PythState {
    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function pyth2WormholeChainId() public view returns (uint16){
        return _state.pyth2WormholeChainId;
    }

    function pyth2WormholeEmitter() public view returns (bytes32){
        return _state.pyth2WormholeEmitter;
    }

    function latestPriceInfo(bytes32 priceId) internal view returns (PythInternalStructs.PriceInfo memory info){
        return _state.latestPriceInfo[priceId];
    }
}
