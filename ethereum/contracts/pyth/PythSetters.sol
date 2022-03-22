// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythState.sol";

contract PythSetters is PythState {
    function setInitialized(address implementatiom) internal {
        _state.initializedImplementations[implementatiom] = true;
    }

    function setChainId(uint16 chainId) internal {
        _state.provider.chainId = chainId;
    }

    function setPyth2WormholeChainId(uint16 chainId) internal {
        _state.provider.pyth2WormholeChainId = chainId;
    }

    function setPyth2WormholeEmitter(bytes32 emitterAddr) internal {
        _state.provider.pyth2WormholeEmitter = emitterAddr;
    }

    function setWormhole(address wh) internal {
        _state.wormhole = payable(wh);
    }

    function setLatestPriceInfo(bytes32 priceId, PythStructs.PriceInfo memory info) internal {
        _state.latestPriceInfo[priceId] = info;
    }
}
