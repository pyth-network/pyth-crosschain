// contracts/Getters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../interfaces/IWormhole.sol";

import "./PythState.sol";

contract PythGetters is PythState {
    function governanceActionIsConsumed(bytes32 hash) public view returns (bool) {
        return _state.consumedGovernanceActions[hash];
    }

    function isInitialized(address impl) public view returns (bool) {
        return _state.initializedImplementations[impl];
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function chainId() public view returns (uint16){
        return _state.provider.chainId;
    }

    function governanceChainId() public view returns (uint16){
        return _state.provider.governanceChainId;
    }

    function governanceContract() public view returns (bytes32){
        return _state.provider.governanceContract;
    }

    function pyth2WormholeChainId() public view returns (uint16){
        return _state.provider.pyth2WormholeChainId;
    }

    function pyth2WormholeEmitter() public view returns (bytes32){
        return _state.provider.pyth2WormholeEmitter;
    }

    function latestPriceInfo(bytes32 priceId) public view returns (PythStructs.PriceInfo memory info){
        return _state.latestPriceInfo[priceId];
    }
}
