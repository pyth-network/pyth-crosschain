// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "../wormhole/interfaces/IWormhole.sol";
import "./PythGovernanceEvents.sol";
import "./PythGovernanceInstructions.sol";
import "./PythInternalStructs.sol";
import "./PythState.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

/**
 * @dev `PythGovernanceModule` holds the cold-path governance handlers that used to
 * live in the Pyth implementation contract. It is deployed once per chain and
 * linked into the implementation, which keeps the implementation under the
 * EIP-170 24,576 byte limit.
 *
 * The library is called with `delegatecall`, so `address(this)`, the emitted log
 * origin and the balance are all those of the Pyth proxy. Storage is reached
 * through the `PythStorage.State storage` pointer handed in by the caller rather
 * than through an inherited state variable, so the library never needs to know
 * where `_state` sits in the implementation's storage layout.
 *
 * `UpgradeContract` is deliberately NOT handled here: `executeGovernanceInstruction`
 * is the only working upgrade path (the owner is renounced, so `_authorizeUpgrade`
 * always reverts), and routing it through a linked library would make a
 * mis-linked deployment unrecoverable.
 */
library PythGovernanceModule {
    using BytesLib for bytes;

    /// @dev Execute every governance action other than `UpgradeContract`.
    ///
    /// `gi` is the already-parsed instruction and `encodedVM` the raw VAA it came
    /// from. The VAA is intentionally not re-verified here: the caller has
    /// already advanced `lastExecutedGovernanceSequence` to `vm.sequence`, so a
    /// second `verifyGovernanceVM` would revert with `OldGovernanceMessage`.
    /// `encodedVM` is only needed by `SetWormholeAddress`, which re-parses it
    /// with the newly set wormhole contract.
    function executeGovernanceAction(
        PythStorage.State storage state,
        GovernanceInstruction memory gi,
        bytes memory encodedVM
    ) external {
        if (
            gi.action == GovernanceAction.AuthorizeGovernanceDataSourceTransfer
        ) {
            authorizeGovernanceDataSourceTransfer(
                state,
                parseAuthorizeGovernanceDataSourceTransferPayload(gi.payload)
            );
        } else if (gi.action == GovernanceAction.SetDataSources) {
            setDataSources(state, parseSetDataSourcesPayload(gi.payload));
        } else if (gi.action == GovernanceAction.SetFee) {
            setFee(state, parseSetFeePayload(gi.payload));
        } else if (gi.action == GovernanceAction.SetValidPeriod) {
            setValidPeriod(state, parseSetValidPeriodPayload(gi.payload));
        } else if (
            gi.action == GovernanceAction.RequestGovernanceDataSourceTransfer
        ) {
            // RequestGovernanceDataSourceTransfer can be only part of AuthorizeGovernanceDataSourceTransfer message
            revert PythErrors.InvalidGovernanceMessage();
        } else if (gi.action == GovernanceAction.SetWormholeAddress) {
            if (gi.targetChainId == 0)
                revert PythErrors.InvalidGovernanceTarget();
            setWormholeAddress(
                state,
                parseSetWormholeAddressPayload(gi.payload),
                encodedVM
            );
        } else if (gi.action == GovernanceAction.SetFeeInToken) {
            // No-op for EVM chains
        } else if (gi.action == GovernanceAction.SetTransactionFee) {
            setTransactionFee(state, parseSetTransactionFeePayload(gi.payload));
        } else if (gi.action == GovernanceAction.WithdrawFee) {
            withdrawFee(parseWithdrawFeePayload(gi.payload));
        } else {
            revert PythErrors.InvalidGovernanceMessage();
        }
    }

    // Transfer the governance data source to a new value with sanity checks
    // to ensure the new governance data source can manage the contract.
    function authorizeGovernanceDataSourceTransfer(
        PythStorage.State storage state,
        AuthorizeGovernanceDataSourceTransferPayload memory payload
    ) private {
        PythInternalStructs.DataSource memory oldGovernanceDatSource = state
            .governanceDataSource;

        // Make sure the claimVaa is a valid VAA with RequestGovernanceDataSourceTransfer governance message
        // If it's valid then its emitter can take over the governance from the current emitter.
        // The VAA is checked here to ensure that the new governance data source is valid and can send message
        // through wormhole.
        (IWormhole.VM memory vm, bool valid, ) = IWormhole(state.wormhole)
            .parseAndVerifyVM(payload.claimVaa);
        if (!valid) revert PythErrors.InvalidWormholeVaa();

        GovernanceInstruction memory gi = decodeGovernanceInstruction(
            vm.payload
        );
        if (
            gi.targetChainId != IWormhole(state.wormhole).chainId() &&
            gi.targetChainId != 0
        ) revert PythErrors.InvalidGovernanceTarget();

        if (gi.action != GovernanceAction.RequestGovernanceDataSourceTransfer)
            revert PythErrors.InvalidGovernanceMessage();

        RequestGovernanceDataSourceTransferPayload
            memory claimPayload = parseRequestGovernanceDataSourceTransferPayload(
                gi.payload
            );

        // Governance data source index is used to prevent replay attacks, so a claimVaa cannot be used twice.
        if (
            state.governanceDataSourceIndex >=
            claimPayload.governanceDataSourceIndex
        ) revert PythErrors.OldGovernanceMessage();

        state.governanceDataSourceIndex = claimPayload
            .governanceDataSourceIndex;

        state.governanceDataSource = PythInternalStructs.DataSource(
            vm.emitterChainId,
            vm.emitterAddress
        );

        // Setting the last executed governance to the claimVaa sequence to avoid using older sequences.
        state.lastExecutedGovernanceSequence = vm.sequence;

        emit IPythGovernanceEvents.GovernanceDataSourceSet(
            oldGovernanceDatSource,
            state.governanceDataSource,
            state.lastExecutedGovernanceSequence
        );
    }

    function setDataSources(
        PythStorage.State storage state,
        SetDataSourcesPayload memory payload
    ) private {
        PythInternalStructs.DataSource[] memory oldDataSources = state
            .validDataSources;

        for (uint i = 0; i < oldDataSources.length; i += 1) {
            state.isValidDataSource[hashDataSource(oldDataSources[i])] = false;
        }

        delete state.validDataSources;
        for (uint i = 0; i < payload.dataSources.length; i++) {
            state.validDataSources.push(payload.dataSources[i]);
            state.isValidDataSource[
                hashDataSource(payload.dataSources[i])
            ] = true;
        }

        emit IPythGovernanceEvents.DataSourcesSet(
            oldDataSources,
            state.validDataSources
        );
    }

    function setFee(
        PythStorage.State storage state,
        SetFeePayload memory payload
    ) private {
        uint oldFee = state.singleUpdateFeeInWei;
        state.singleUpdateFeeInWei = payload.newFee;

        emit IPythGovernanceEvents.FeeSet(oldFee, state.singleUpdateFeeInWei);
    }

    function setValidPeriod(
        PythStorage.State storage state,
        SetValidPeriodPayload memory payload
    ) private {
        uint oldValidPeriod = state.validTimePeriodSeconds;
        state.validTimePeriodSeconds = payload.newValidPeriod;

        emit IPythGovernanceEvents.ValidPeriodSet(
            oldValidPeriod,
            state.validTimePeriodSeconds
        );
    }

    function setWormholeAddress(
        PythStorage.State storage state,
        SetWormholeAddressPayload memory payload,
        bytes memory encodedVM
    ) private {
        address oldWormholeAddress = state.wormhole;
        state.wormhole = payable(payload.newWormholeAddress);

        // We want to verify that the new wormhole address is valid, so we make sure that it can
        // parse and verify the same governance VAA that is used to set it.
        (IWormhole.VM memory vm, bool valid, ) = IWormhole(state.wormhole)
            .parseAndVerifyVM(encodedVM);

        if (!valid) revert PythErrors.InvalidGovernanceMessage();

        if (
            state.governanceDataSource.chainId != vm.emitterChainId ||
            state.governanceDataSource.emitterAddress != vm.emitterAddress
        ) revert PythErrors.InvalidGovernanceMessage();

        if (vm.sequence != state.lastExecutedGovernanceSequence)
            revert PythErrors.InvalidWormholeAddressToSet();

        GovernanceInstruction memory gi = decodeGovernanceInstruction(
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

        emit IPythGovernanceEvents.WormholeAddressSet(
            oldWormholeAddress,
            state.wormhole
        );
    }

    function setTransactionFee(
        PythStorage.State storage state,
        SetTransactionFeePayload memory payload
    ) private {
        uint oldFee = state.transactionFeeInWei;
        state.transactionFeeInWei = payload.newFee;

        emit IPythGovernanceEvents.TransactionFeeSet(
            oldFee,
            state.transactionFeeInWei
        );
    }

    function withdrawFee(WithdrawFeePayload memory payload) private {
        if (payload.fee > address(this).balance)
            revert PythErrors.InsufficientFee();

        (bool success, ) = payload.targetAddress.call{value: payload.fee}("");
        require(success, "Failed to withdraw fees");

        emit IPythGovernanceEvents.FeeWithdrawn(
            payload.targetAddress,
            payload.fee
        );
    }

    function hashDataSource(
        PythInternalStructs.DataSource memory ds
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(ds.chainId, ds.emitterAddress));
    }

    /// @dev Parse a AuthorizeGovernanceDataSourceTransferPayload (action 1) with minimal validation
    function parseAuthorizeGovernanceDataSourceTransferPayload(
        bytes memory encodedPayload
    )
        private
        pure
        returns (AuthorizeGovernanceDataSourceTransferPayload memory sgds)
    {
        sgds.claimVaa = encodedPayload;
    }

    /// @dev Parse a RequestGovernanceDataSourceTransferPayload (action 5) with minimal validation
    function parseRequestGovernanceDataSourceTransferPayload(
        bytes memory encodedPayload
    )
        private
        pure
        returns (RequestGovernanceDataSourceTransferPayload memory sgdsClaim)
    {
        uint index = 0;

        sgdsClaim.governanceDataSourceIndex = encodedPayload.toUint32(index);
        index += 4;

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetDataSourcesPayload (action 2) with minimal validation
    function parseSetDataSourcesPayload(
        bytes memory encodedPayload
    ) private pure returns (SetDataSourcesPayload memory sds) {
        uint index = 0;

        uint8 dataSourcesLength = encodedPayload.toUint8(index);
        index += 1;

        sds.dataSources = new PythInternalStructs.DataSource[](
            dataSourcesLength
        );

        for (uint i = 0; i < dataSourcesLength; i++) {
            sds.dataSources[i].chainId = encodedPayload.toUint16(index);
            index += 2;

            sds.dataSources[i].emitterAddress = encodedPayload.toBytes32(index);
            index += 32;
        }

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetFeePayload (action 3) with minimal validation
    function parseSetFeePayload(
        bytes memory encodedPayload
    ) private pure returns (SetFeePayload memory sf) {
        uint index = 0;

        uint64 val = encodedPayload.toUint64(index);
        index += 8;

        uint64 expo = encodedPayload.toUint64(index);
        index += 8;

        sf.newFee = uint256(val) * uint256(10) ** uint256(expo);

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetValidPeriodPayload (action 4) with minimal validation
    function parseSetValidPeriodPayload(
        bytes memory encodedPayload
    ) private pure returns (SetValidPeriodPayload memory svp) {
        uint index = 0;

        svp.newValidPeriod = uint256(encodedPayload.toUint64(index));
        index += 8;

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetWormholeAddressPayload (action 6) with minimal validation
    function parseSetWormholeAddressPayload(
        bytes memory encodedPayload
    ) private pure returns (SetWormholeAddressPayload memory sw) {
        uint index = 0;

        sw.newWormholeAddress = address(encodedPayload.toAddress(index));
        index += 20;

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetTransactionFeePayload (action 8) with minimal validation
    function parseSetTransactionFeePayload(
        bytes memory encodedPayload
    ) private pure returns (SetTransactionFeePayload memory stf) {
        uint index = 0;

        uint64 val = encodedPayload.toUint64(index);
        index += 8;

        uint64 expo = encodedPayload.toUint64(index);
        index += 8;

        stf.newFee = uint256(val) * uint256(10) ** uint256(expo);

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a WithdrawFeePayload (action 9) with minimal validation
    function parseWithdrawFeePayload(
        bytes memory encodedPayload
    ) private pure returns (WithdrawFeePayload memory wf) {
        uint index = 0;

        wf.targetAddress = address(encodedPayload.toAddress(index));
        index += 20;

        uint64 val = encodedPayload.toUint64(index);
        index += 8;

        uint64 expo = encodedPayload.toUint64(index);
        index += 8;

        wf.fee = uint256(val) * uint256(10) ** uint256(expo);

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }
}
