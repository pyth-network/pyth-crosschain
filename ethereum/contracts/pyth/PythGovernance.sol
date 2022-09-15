// contracts/Governance.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythGovernanceInstructions.sol";
import "./PythInternalStructs.sol";
import "./Pyth.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Pyth contract.
 */
abstract contract PythGovernance is Pyth, PythGovernanceInstructions {
    event ContractUpgraded(address oldContract, address newContract);
    event GovernanceDataSourceSet(PythInternalStructs.DataSource oldDataSource, PythInternalStructs.DataSource newDataSource);
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

        require(gi.targetChainId == chainId() || gi.targetChainId == 0, "Invalid target chain for this governance instruction");

        // We are explicitly checking with number as with enum there might be confusions
        // about the numbers.
        if (gi.action == 1) { // UpgradeContract
            require(gi.targetChainId != 0, "Upgrade for all the chains does not exists");
            upgradeContract(gi.payload);
        } else if (gi.action == 2) {
            setGovernanceDataSource(gi.payload);
        } else if (gi.action == 3) {
            setDataSources(gi.payload);
        } else if (gi.action == 4) {
            setFee(gi.payload);
        } else if (gi.action == 5) {
            setValidPeriod(gi.payload);
        } else {
            revert("Invalid governance action");
        }
    }

    // Execute a UpgradeContract governance message
    function upgradeContract(bytes memory encodedPayload) internal {
        UpgradeContractPayload memory payload = parseUpgradeContractPayload(encodedPayload); 
        upgradeUpgradableContract(payload);
    }

    function upgradeUpgradableContract(UpgradeContractPayload memory payload) virtual internal;


    function setGovernanceDataSource(bytes memory encodedPayload) internal {
        SetGovernanceDataSourcePayload memory payload = parseSetGovernanceDataSourcePayload(encodedPayload);

        PythInternalStructs.DataSource memory oldGovernanceDatSource = governanceDataSource();

        setGovernanceDataSource(payload.newGovernanceDataSource);
        setLastExecutedGovernanceSequence(0);

        emit GovernanceDataSourceSet(oldGovernanceDatSource, governanceDataSource());
    }

    function setDataSources(bytes memory encodedPayload) internal {
        SetDataSourcesPayload memory payload = parseSetDataSourcesPayload(encodedPayload);

        PythInternalStructs.DataSource[] memory oldDataSources = validDataSources();

        for (uint i = 0; i < oldDataSources.length; i += 1) {
            _state.isValidDataSource[keccak256(abi.encodePacked(oldDataSources[i].chainId, oldDataSources[i].emitterAddress))] = false;
        }

        _state.validDataSources = payload.dataSources;
        for (uint i = 0; i < payload.dataSources.length; i++) {
            _state.isValidDataSource[keccak256(abi.encodePacked(payload.dataSources[i].chainId, payload.dataSources[i].emitterAddress))] = true;
        }

        emit DataSourcesSet(oldDataSources, payload.dataSources);
    }

    function setFee(bytes memory encodedPayload) internal {
        SetFeePayload memory payload = parseSetFeePayload(encodedPayload);

        uint oldFee = singleUpdateFeeInWei();
        setSingleUpdateFeeInWei(payload.newFee);

        emit FeeSet(oldFee, payload.newFee);
    }

    function setValidPeriod(bytes memory encodedPayload) internal {
        SetValidPeriodPayload memory payload = parseSetValidPeriodPayload(encodedPayload);

        uint oldValidPeriod = validTimePeriodSeconds();
        setValidTimePeriodSeconds(payload.newValidPeriod);

        emit ValidPeriodSet(oldValidPeriod, payload.newValidPeriod);
    }
}
