// contracts/Governance.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythGovernanceInstructions.sol";
import "./PythInternalStructs.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";


import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Pyth contract.
 */
abstract contract PythGovernance is PythGetters, PythSetters, PythGovernanceInstructions {
    event ContractUpgraded(address oldImplementation, address newImplementation);
    event GovernanceDataSourceSet(PythInternalStructs.DataSource oldDataSource, PythInternalStructs.DataSource newDataSource,
        uint64 initialSequence);
    event DataSourcesSet(PythInternalStructs.DataSource[] oldDataSources, PythInternalStructs.DataSource[] newDataSources);
    event FeeSet(uint oldFee, uint newFee);
    event ValidPeriodSet(uint oldValidPeriod, uint newValidPeriod);

    function verifyGovernanceVM(bytes memory encodedVM) internal returns (IWormhole.VM memory parsedVM){
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVM);

        require(valid, reason);
        require(isValidGovernanceDataSource(vm.emitterChainId, vm.emitterAddress), "VAA is not coming from the governance data source");

        require(vm.sequence > lastExecutedGovernanceSequence(), "VAA is older than the last executed governance VAA");

        setLastExecutedGovernanceSequence(vm.sequence);

        return vm;
    }

    function executeGovernanceInstruction(bytes calldata encodedVM) public {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVM);

        GovernanceInstruction memory gi = parseGovernanceInstruction(vm.payload);

        require(gi.targetChainId == chainId() || gi.targetChainId == 0, "invalid target chain for this governance instruction");

        if (gi.action == GovernanceAction.UpgradeContract) {
            require(gi.targetChainId != 0, "upgrade with chain id 0 is not possible");
            upgradeContract(gi.payload);
        } else if (gi.action == GovernanceAction.TransferGovernanceDataSource) {
            require(gi.targetChainId == 0, "governance data source change should be applied to all chains");
            transferGovernanceDataSource(gi.payload);
        } else if (gi.action == GovernanceAction.SetDataSources) {
            setDataSources(gi.payload);
        } else if (gi.action == GovernanceAction.SetFee) {
            setFee(gi.payload);
        } else if (gi.action == GovernanceAction.SetValidPeriod) {
            setValidPeriod(gi.payload);
        } else if (gi.action == GovernanceAction.TransferGovernanceDataSourceClaim) {
            revert("TransferGovernanceDataSourceClaim can be only part of TransferGovernanceDataSource message");
        } else {
            revert("invalid governance action");
        }
    }

    function upgradeContract(bytes memory encodedPayload) internal {
        UpgradeContractPayload memory payload = parseUpgradeContractPayload(encodedPayload); 
        // This contract does not have enough access to execute this, it should be executed on the
        // upgradable
        upgradeUpgradableContract(payload);
    }

    function upgradeUpgradableContract(UpgradeContractPayload memory payload) virtual internal;

    // Transfer the governance data source to a new value with sanity checks
    // to ensure the new governance data source can manage the contract.
    function transferGovernanceDataSource(bytes memory encodedPayload) internal {
        PythInternalStructs.DataSource memory oldGovernanceDatSource = governanceDataSource();

        TransferGovernanceDataSourcePayload memory payload = parseTransferGovernanceDataSourcePayload(encodedPayload);

        // Make sure the VAA is valid
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(payload.claimVaa);
        require(valid, reason);

        GovernanceInstruction memory gi = parseGovernanceInstruction(vm.payload);
        require(gi.targetChainId == 0, "governance data source change claim vaa should be applied to all chains");
        require(gi.action == GovernanceAction.TransferGovernanceDataSourceClaim,
            "governance data source change inner vaa is not of claim action type");

        TransferGovernanceDataSourceClaimPayload memory claimPayload = parseTransferGovernanceDataSourceClaimPayload(gi.payload);

        require(governanceDataSourceIndex() < claimPayload.governanceDataSourceIndex, 
            "cannot upgrade to an older governance data source");

        setGovernanceDataSourceIndex(claimPayload.governanceDataSourceIndex);

        PythInternalStructs.DataSource memory newGovernanceDS = PythInternalStructs.DataSource(vm.emitterChainId, vm.emitterAddress);

        setGovernanceDataSource(newGovernanceDS);
        setLastExecutedGovernanceSequence(vm.sequence);

        emit GovernanceDataSourceSet(oldGovernanceDatSource, governanceDataSource(), lastExecutedGovernanceSequence());
    }

    function setDataSources(bytes memory encodedPayload) internal {
        SetDataSourcesPayload memory payload = parseSetDataSourcesPayload(encodedPayload);

        PythInternalStructs.DataSource[] memory oldDataSources = validDataSources();

        for (uint i = 0; i < oldDataSources.length; i += 1) {
            _state.isValidDataSource[hashDataSource(oldDataSources[i])] = false;
        }

        delete _state.validDataSources;
        for (uint i = 0; i < payload.dataSources.length; i++) {
            _state.validDataSources.push(payload.dataSources[i]);
            _state.isValidDataSource[hashDataSource(payload.dataSources[i])] = true;
        }

        emit DataSourcesSet(oldDataSources, validDataSources());
    }

    function setFee(bytes memory encodedPayload) internal {
        SetFeePayload memory payload = parseSetFeePayload(encodedPayload);

        uint oldFee = singleUpdateFeeInWei();
        setSingleUpdateFeeInWei(payload.newFee);

        emit FeeSet(oldFee, singleUpdateFeeInWei());
    }

    function setValidPeriod(bytes memory encodedPayload) internal {
        SetValidPeriodPayload memory payload = parseSetValidPeriodPayload(encodedPayload);

        uint oldValidPeriod = validTimePeriodSeconds();
        setValidTimePeriodSeconds(payload.newValidPeriod);

        emit ValidPeriodSet(oldValidPeriod, validTimePeriodSeconds());
    }
}
