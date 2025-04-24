// contracts/Governance.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythGovernanceInstructions.sol";
import "./PythInternalStructs.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Pyth contract.
 */
abstract contract PythGovernance is
    PythGetters,
    PythSetters,
    PythGovernanceInstructions
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );
    event GovernanceDataSourceSet(
        PythInternalStructs.DataSource oldDataSource,
        PythInternalStructs.DataSource newDataSource,
        uint64 initialSequence
    );
    event DataSourcesSet(
        PythInternalStructs.DataSource[] oldDataSources,
        PythInternalStructs.DataSource[] newDataSources
    );
    event FeeSet(uint oldFee, uint newFee);
    event ValidPeriodSet(uint oldValidPeriod, uint newValidPeriod);
    event WormholeAddressSet(
        address oldWormholeAddress,
        address newWormholeAddress
    );
    event TransactionFeeSet(uint oldFee, uint newFee);
    event FeeWithdrawn(address targetAddress, uint fee);

    function verifyGovernanceVM(
        bytes memory encodedVM
    ) internal returns (IWormhole.VM memory parsedVM) {
        (IWormhole.VM memory vm, bool valid, ) = wormhole().parseAndVerifyVM(
            encodedVM
        );

        if (!valid) revert PythErrors.InvalidWormholeVaa();

        if (!isValidGovernanceDataSource(vm.emitterChainId, vm.emitterAddress))
            revert PythErrors.InvalidGovernanceDataSource();

        if (vm.sequence <= lastExecutedGovernanceSequence())
            revert PythErrors.OldGovernanceMessage();

        setLastExecutedGovernanceSequence(vm.sequence);

        return vm;
    }

    function executeGovernanceInstruction(bytes calldata encodedVM) public {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVM);

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.targetChainId != chainId() && gi.targetChainId != 0)
            revert PythErrors.InvalidGovernanceTarget();

        if (gi.action == GovernanceAction.UpgradeContract) {
            if (gi.targetChainId == 0)
                revert PythErrors.InvalidGovernanceTarget();
            upgradeContract(parseUpgradeContractPayload(gi.payload));
        } else if (
            gi.action == GovernanceAction.AuthorizeGovernanceDataSourceTransfer
        ) {
            AuthorizeGovernanceDataSourceTransfer(
                parseAuthorizeGovernanceDataSourceTransferPayload(gi.payload)
            );
        } else if (gi.action == GovernanceAction.SetDataSources) {
            setDataSources(parseSetDataSourcesPayload(gi.payload));
        } else if (gi.action == GovernanceAction.SetFee) {
            setFee(parseSetFeePayload(gi.payload));
        } else if (gi.action == GovernanceAction.SetValidPeriod) {
            setValidPeriod(parseSetValidPeriodPayload(gi.payload));
        } else if (
            gi.action == GovernanceAction.RequestGovernanceDataSourceTransfer
        ) {
            // RequestGovernanceDataSourceTransfer can be only part of AuthorizeGovernanceDataSourceTransfer message
            revert PythErrors.InvalidGovernanceMessage();
        } else if (gi.action == GovernanceAction.SetWormholeAddress) {
            if (gi.targetChainId == 0)
                revert PythErrors.InvalidGovernanceTarget();
            setWormholeAddress(
                parseSetWormholeAddressPayload(gi.payload),
                encodedVM
            );
        } else if (gi.action == GovernanceAction.SetFeeInToken) {
            // No-op for EVM chains
        } else if (gi.action == GovernanceAction.SetTransactionFee) {
            setTransactionFee(parseSetTransactionFeePayload(gi.payload));
        } else if (gi.action == GovernanceAction.WithdrawFee) {
            withdrawFee(parseWithdrawFeePayload(gi.payload));
        } else {
            revert PythErrors.InvalidGovernanceMessage();
        }
    }

    function upgradeContract(UpgradeContractPayload memory payload) internal {
        // This method on this contract does not have enough access to execute this, it should be executed on the
        // upgradable contract.
        upgradeUpgradableContract(payload);
    }

    function upgradeUpgradableContract(
        UpgradeContractPayload memory payload
    ) internal virtual;

    // Transfer the governance data source to a new value with sanity checks
    // to ensure the new governance data source can manage the contract.
    function AuthorizeGovernanceDataSourceTransfer(
        AuthorizeGovernanceDataSourceTransferPayload memory payload
    ) internal {
        PythInternalStructs.DataSource
            memory oldGovernanceDatSource = governanceDataSource();

        // Make sure the claimVaa is a valid VAA with RequestGovernanceDataSourceTransfer governance message
        // If it's valid then its emitter can take over the governance from the current emitter.
        // The VAA is checked here to ensure that the new governance data source is valid and can send message
        // through wormhole.
        (IWormhole.VM memory vm, bool valid, ) = wormhole().parseAndVerifyVM(
            payload.claimVaa
        );
        if (!valid) revert PythErrors.InvalidWormholeVaa();

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );
        if (gi.targetChainId != chainId() && gi.targetChainId != 0)
            revert PythErrors.InvalidGovernanceTarget();

        if (gi.action != GovernanceAction.RequestGovernanceDataSourceTransfer)
            revert PythErrors.InvalidGovernanceMessage();

        RequestGovernanceDataSourceTransferPayload
            memory claimPayload = parseRequestGovernanceDataSourceTransferPayload(
                gi.payload
            );

        // Governance data source index is used to prevent replay attacks, so a claimVaa cannot be used twice.
        if (
            governanceDataSourceIndex() >=
            claimPayload.governanceDataSourceIndex
        ) revert PythErrors.OldGovernanceMessage();

        setGovernanceDataSourceIndex(claimPayload.governanceDataSourceIndex);

        PythInternalStructs.DataSource
            memory newGovernanceDS = PythInternalStructs.DataSource(
                vm.emitterChainId,
                vm.emitterAddress
            );

        setGovernanceDataSource(newGovernanceDS);

        // Setting the last executed governance to the claimVaa sequence to avoid using older sequences.
        setLastExecutedGovernanceSequence(vm.sequence);

        emit GovernanceDataSourceSet(
            oldGovernanceDatSource,
            governanceDataSource(),
            lastExecutedGovernanceSequence()
        );
    }

    function setDataSources(SetDataSourcesPayload memory payload) internal {
        PythInternalStructs.DataSource[]
            memory oldDataSources = validDataSources();

        for (uint i = 0; i < oldDataSources.length; i += 1) {
            _state.isValidDataSource[hashDataSource(oldDataSources[i])] = false;
        }

        delete _state.validDataSources;
        for (uint i = 0; i < payload.dataSources.length; i++) {
            _state.validDataSources.push(payload.dataSources[i]);
            _state.isValidDataSource[
                hashDataSource(payload.dataSources[i])
            ] = true;
        }

        emit DataSourcesSet(oldDataSources, validDataSources());
    }

    function setFee(SetFeePayload memory payload) internal {
        uint oldFee = singleUpdateFeeInWei();
        setSingleUpdateFeeInWei(payload.newFee);

        emit FeeSet(oldFee, singleUpdateFeeInWei());
    }

    function setValidPeriod(SetValidPeriodPayload memory payload) internal {
        uint oldValidPeriod = validTimePeriodSeconds();
        setValidTimePeriodSeconds(payload.newValidPeriod);

        emit ValidPeriodSet(oldValidPeriod, validTimePeriodSeconds());
    }

    function setWormholeAddress(
        SetWormholeAddressPayload memory payload,
        bytes memory encodedVM
    ) internal {
        address oldWormholeAddress = address(wormhole());
        setWormhole(payload.newWormholeAddress);

        // We want to verify that the new wormhole address is valid, so we make sure that it can
        // parse and verify the same governance VAA that is used to set it.
        (IWormhole.VM memory vm, bool valid, ) = wormhole().parseAndVerifyVM(
            encodedVM
        );

        if (!valid) revert PythErrors.InvalidGovernanceMessage();

        if (!isValidGovernanceDataSource(vm.emitterChainId, vm.emitterAddress))
            revert PythErrors.InvalidGovernanceMessage();

        if (vm.sequence != lastExecutedGovernanceSequence())
            revert PythErrors.InvalidWormholeAddressToSet();

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.action != GovernanceAction.SetWormholeAddress)
            revert PythErrors.InvalidWormholeAddressToSet();

        // Purposefully, we don't check whether the chainId is the same as the current chainId because
        // we might want to change the chain id of the wormhole contract.

        // The following check is not necessary for security, but is a sanity check that the new wormhole
        // contract parses the payload correctly.
        SetWormholeAddressPayload
            memory newPayload = parseSetWormholeAddressPayload(gi.payload);

        if (newPayload.newWormholeAddress != payload.newWormholeAddress)
            revert PythErrors.InvalidWormholeAddressToSet();

        emit WormholeAddressSet(oldWormholeAddress, address(wormhole()));
    }

    function setTransactionFee(
        SetTransactionFeePayload memory payload
    ) internal {
        uint oldFee = transactionFeeInWei();
        setTransactionFeeInWei(payload.newFee);

        emit TransactionFeeSet(oldFee, transactionFeeInWei());
    }

    function withdrawFee(WithdrawFeePayload memory payload) internal {
        if (payload.fee > address(this).balance)
            revert PythErrors.InsufficientFee();

        (bool success, ) = payload.targetAddress.call{value: payload.fee}("");
        require(success, "Failed to withdraw fees");

        emit FeeWithdrawn(payload.targetAddress, payload.fee);
    }
}
