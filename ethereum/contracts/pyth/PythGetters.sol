// contracts/Getters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../wormhole/interfaces/IWormhole.sol";

import "./PythInternalStructs.sol";
import "./PythState.sol";

contract PythGetters is PythState {
    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    /// Deprecated, use `validDataSources` instead
    function pyth2WormholeChainId() public view returns (uint16){
        return _state._deprecatedPyth2WormholeChainId;
    }

    /// Deprecated, use `validDataSources` instead
    function pyth2WormholeEmitter() public view returns (bytes32){
        return _state._deprecatedPyth2WormholeEmitter;
    }

    function latestPriceInfo(bytes32 priceId) internal view returns (PythInternalStructs.PriceInfo memory info){
        return _state.latestPriceInfo[priceId];
    }

    function isValidDataSource(uint16 chainId, bytes32 emitterAddress) public view returns (bool) {
        return _state.isValidDataSource[keccak256(abi.encodePacked(chainId, emitterAddress))];
    }

    function validDataSources() public view returns (PythInternalStructs.DataSource[] memory) {
        return _state.validDataSources;
    }


    function singleUpdateFeeInWei() public view returns (uint) {
        return _state.singleUpdateFeeInWei;
    }
}
