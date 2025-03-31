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

    function latestPriceInfo(
        bytes32 priceId
    ) internal view returns (PythInternalStructs.PriceInfo memory info) {
        return _state.latestPriceInfo[priceId];
    }

    function latestPriceInfoPublishTime(
        bytes32 priceId
    ) public view returns (uint64) {
        return _state.latestPriceInfo[priceId].publishTime;
    }

    function hashDataSource(
        PythInternalStructs.DataSource memory ds
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(ds.chainId, ds.emitterAddress));
    }

    function isValidDataSource(
        uint16 dataSourceChainId,
        bytes32 dataSourceEmitterAddress
    ) public view returns (bool) {
        return
            _state.isValidDataSource[
                keccak256(
                    abi.encodePacked(
                        dataSourceChainId,
                        dataSourceEmitterAddress
                    )
                )
            ];
    }

    function isValidGovernanceDataSource(
        uint16 governanceChainId,
        bytes32 governanceEmitterAddress
    ) public view returns (bool) {
        return
            _state.governanceDataSource.chainId == governanceChainId &&
            _state.governanceDataSource.emitterAddress ==
            governanceEmitterAddress;
    }

    function chainId() public view returns (uint16) {
        return wormhole().chainId();
    }

    function lastExecutedGovernanceSequence() public view returns (uint64) {
        return _state.lastExecutedGovernanceSequence;
    }

    function validDataSources()
        public
        view
        returns (PythInternalStructs.DataSource[] memory)
    {
        return _state.validDataSources;
    }

    function governanceDataSource()
        public
        view
        returns (PythInternalStructs.DataSource memory)
    {
        return _state.governanceDataSource;
    }

    function singleUpdateFeeInWei() public view returns (uint) {
        return _state.singleUpdateFeeInWei;
    }

    function validTimePeriodSeconds() public view returns (uint) {
        return _state.validTimePeriodSeconds;
    }

    function governanceDataSourceIndex() public view returns (uint32) {
        return _state.governanceDataSourceIndex;
    }

    function transactionFeeInWei() public view returns (uint) {
        return _state.transactionFeeInWei;
    }
}
