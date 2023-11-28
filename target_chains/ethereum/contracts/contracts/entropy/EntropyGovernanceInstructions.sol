// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyState.sol";
import "../libraries/external/BytesLib.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Entropy contract.
 */
abstract contract EntropyGovernanceInstructions {
    using BytesLib for bytes;

    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );
    event FeeSet(uint oldFee, uint newFee);
    event AdminSet(address oldAdmin, address newAdmin);

    enum GovernanceAction {
        UpgradeContract, // 0
        SetAdmin, // 1
        SetFee // 2
    }

    struct GovernanceInstruction {
        GovernanceAction action;
        bytes payload;
    }

    struct UpgradeContractPayload {
        address newImplementation;
    }

    struct SetAdminPayload {
        address newAdmin;
    }

    struct SetFeePayload {
        uint newFee;
    }

    /// @dev Parse a GovernanceInstruction
    function parseGovernanceInstruction(
        bytes memory encodedInstruction
    ) public pure returns (GovernanceInstruction memory gi) {
        uint index = 0;

        uint8 actionNumber = encodedInstruction.toUint8(index);
        gi.action = GovernanceAction(actionNumber);
        index += 1;

        // As solidity performs math operations in a checked mode
        // if the length of the encoded instruction be smaller than index
        // it will revert. So we don't need any extra check.
        gi.payload = encodedInstruction.slice(
            index,
            encodedInstruction.length - index
        );
    }

    /// @dev Parse a UpgradeContractPayload (action 0) with minimal validation
    function parseUpgradeContractPayload(
        bytes memory encodedPayload
    ) public pure returns (UpgradeContractPayload memory uc) {
        uint index = 0;

        uc.newImplementation = address(encodedPayload.toAddress(index));
        index += 20;

        if (encodedPayload.length != index)
            revert EntropyErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetAdminPayload (action 1) with minimal validation
    function parseSetAdminPayload(
        bytes memory encodedPayload
    ) public pure returns (SetAdminPayload memory sa) {
        uint index = 0;

        sa.newAdmin = address(encodedPayload.toAddress(index));
        index += 20;

        if (encodedPayload.length != index)
            revert EntropyErrors.InvalidGovernanceMessage();
    }

    /// @dev Parse a SetFeePayload (action 2) with minimal validation
    function parseSetFeePayload(
        bytes memory encodedPayload
    ) public pure returns (SetFeePayload memory sf) {
        uint index = 0;

        uint64 val = encodedPayload.toUint64(index);
        index += 8;

        uint64 expo = encodedPayload.toUint64(index);
        index += 8;

        sf.newFee = uint256(val) * uint256(10) ** uint256(expo);

        if (encodedPayload.length != index)
            revert EntropyErrors.InvalidGovernanceMessage();
    }
}
