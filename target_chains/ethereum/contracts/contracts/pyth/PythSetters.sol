// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythState.sol";
import "@pythnetwork/pyth-sdk-solidity/IPythEvents.sol";

contract PythSetters is PythState, IPythEvents {
    function setWormhole(address wh) internal {
        _state.wormhole = payable(wh);
    }

    function updateLatestPriceIfNecessary(
        bytes32 priceId,
        PythInternalStructs.PriceInfo memory info
    ) internal {
        uint64 latestPublishTime = _state.latestPriceInfo[priceId].publishTime;
        if (info.publishTime > latestPublishTime) {
            _state.latestPriceInfo[priceId] = info;
            emit PriceFeedUpdate(
                priceId,
                info.publishTime,
                info.price,
                info.conf
            );
        }
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

    function setTransactionFeeInWei(uint fee) internal {
        _state.transactionFeeInWei = fee;
    }
}
