// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythState.sol";

contract PythSetters is PythState {
    function setPyth2WormholeChainId(uint16 chainId) internal {
        _state._deprecatedPyth2WormholeChainId = chainId;
    }

    function setPyth2WormholeEmitter(bytes32 emitterAddr) internal {
        _state._deprecatedPyth2WormholeEmitter = emitterAddr;
    }

    function setWormhole(address wh) internal {
        _state.wormhole = payable(wh);
    }

    function setLatestPriceInfo(bytes32 priceId, PythInternalStructs.PriceInfo memory info) internal {
        _state.latestPriceInfo[priceId] = info;
    }

    function setSingleUpdateFeeInWei(uint fee) internal {
        _state.singleUpdateFeeInWei = fee;
    }

    function setValidTimePeriodSeconds(uint validTimePeriodSeconds) internal {
        _state.validTimePeriodSeconds = validTimePeriodSeconds;
    }
}
