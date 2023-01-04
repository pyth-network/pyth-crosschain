// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythState.sol";

contract PythSetters is PythState {
    function setWormhole(address wh) internal {
        _state.wormhole = payable(wh);
    }

    function setLatestPriceInfo(
        bytes32 priceId,
        PythInternalStructs.PriceInfo memory info
    ) internal {
        _state.latestPriceInfo[priceId] = info;
    }

    function setSingleUpdateFeeInWei(uint fee) internal {
        _state.singleUpdateFeeInWei = fee;
    }

    function setValidTimePeriodSeconds(uint validTimePeriodSeconds) internal {
        _state.validTimePeriodSeconds = validTimePeriodSeconds;
    }

    function setGovernanceDataSource(
        PythInternalStructs.DataSource memory newDataSource
    ) internal {
        _state.governanceDataSource = newDataSource;
    }

    function setLastExecutedGovernanceSequence(uint64 sequence) internal {
        _state.lastExecutedGovernanceSequence = sequence;
    }

    function setGovernanceDataSourceIndex(uint32 newIndex) internal {
        _state.governanceDataSourceIndex = newIndex;
    }
}
