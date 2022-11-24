// contracts/GovernanceStructs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "./PythInternalStructs.sol";

/**
 * @dev `PythGovernanceInstructions` defines a set of structs and parsing functions
 * for Pyth governance instructions.
 */
contract PythGovernanceInstructions {
    using BytesLib for bytes;

    // Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
    uint32 constant MAGIC = 0x5054474d;

    enum GovernanceModule {
        Executor, // 0
        Target // 1
    }

    GovernanceModule constant MODULE = GovernanceModule.Target;

    enum GovernanceAction {
        UpgradeContract, // 0
        AuthorizeGovernanceDataSourceTransfer, // 1
        SetDataSources, // 2
        SetFee, // 3
        SetValidPeriod, // 4
        RequestGovernanceDataSourceTransfer // 5
    }

    struct GovernanceInstruction {
        GovernanceModule module;
        GovernanceAction action;
        uint16 targetChainId;
        bytes payload;
    }

    struct UpgradeContractPayload {
        address newImplementation;
    }

    struct AuthorizeGovernanceDataSourceTransferPayload {
        // Transfer governance control over this contract to another data source.
        // The claimVaa field is a VAA created by the new data source; using a VAA prevents mistakes
        // in the handoff by ensuring that the new data source can send VAAs (i.e., is not an invalid address).
        bytes claimVaa;
    }

    struct RequestGovernanceDataSourceTransferPayload {
        // Governance data source index is used to prevent replay attacks
        // So a claimVaa cannot be used twice.
        uint32 governanceDataSourceIndex;
    }

    struct SetDataSourcesPayload {
        PythInternalStructs.DataSource[] dataSources;
    }

    struct SetFeePayload {
        uint newFee;
    }

    struct SetValidPeriodPayload {
        uint newValidPeriod;
    }

    /// @dev Parse a GovernanceInstruction
    function parseGovernanceInstruction(
        bytes memory encodedInstruction
    ) public pure returns (GovernanceInstruction memory gi) {
        uint index = 0;

        uint32 magic = encodedInstruction.toUint32(index);
        require(magic == MAGIC, "invalid magic for GovernanceInstruction");
        index += 4;

        uint8 modNumber = encodedInstruction.toUint8(index);
        gi.module = GovernanceModule(modNumber);
        index += 1;

        require(
            gi.module == MODULE,
            "invalid module for GovernanceInstruction"
        );

        uint8 actionNumber = encodedInstruction.toUint8(index);
        gi.action = GovernanceAction(actionNumber);
        index += 1;

        gi.targetChainId = encodedInstruction.toUint16(index);
        index += 2;

        // As solidity performs math operations in a checked mode
        // if the length of the encoded instruction be smaller than index
        // it will revert. So we don't need any extra check.
        gi.payload = encodedInstruction.slice(
            index,
            encodedInstruction.length - index
        );
    }

    /// @dev Parse a UpgradeContractPayload (action 1) with minimal validation
    function parseUpgradeContractPayload(
        bytes memory encodedPayload
    ) public pure returns (UpgradeContractPayload memory uc) {
        uint index = 0;

        uc.newImplementation = address(encodedPayload.toAddress(index));
        index += 20;

        require(
            encodedPayload.length == index,
            "invalid length for UpgradeContractPayload"
        );
    }

    /// @dev Parse a AuthorizeGovernanceDataSourceTransferPayload (action 2) with minimal validation
    function parseAuthorizeGovernanceDataSourceTransferPayload(
        bytes memory encodedPayload
    )
        public
        pure
        returns (AuthorizeGovernanceDataSourceTransferPayload memory sgds)
    {
        sgds.claimVaa = encodedPayload;
    }

    /// @dev Parse a AuthorizeGovernanceDataSourceTransferPayload (action 2) with minimal validation
    function parseRequestGovernanceDataSourceTransferPayload(
        bytes memory encodedPayload
    )
        public
        pure
        returns (RequestGovernanceDataSourceTransferPayload memory sgdsClaim)
    {
        uint index = 0;

        sgdsClaim.governanceDataSourceIndex = encodedPayload.toUint32(index);
        index += 4;

        require(
            encodedPayload.length == index,
            "invalid length for RequestGovernanceDataSourceTransferPayload"
        );
    }

    /// @dev Parse a SetDataSourcesPayload (action 3) with minimal validation
    function parseSetDataSourcesPayload(
        bytes memory encodedPayload
    ) public pure returns (SetDataSourcesPayload memory sds) {
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

        require(
            encodedPayload.length == index,
            "invalid length for SetDataSourcesPayload"
        );
    }

    /// @dev Parse a SetFeePayload (action 4) with minimal validation
    function parseSetFeePayload(
        bytes memory encodedPayload
    ) public pure returns (SetFeePayload memory sf) {
        uint index = 0;

        uint64 val = encodedPayload.toUint64(index);
        index += 8;

        uint64 expo = encodedPayload.toUint64(index);
        index += 8;

        sf.newFee = uint256(val) * uint256(10) ** uint256(expo);

        require(
            encodedPayload.length == index,
            "invalid length for SetFeePayload"
        );
    }

    /// @dev Parse a SetValidPeriodPayload (action 5) with minimal validation
    function parseSetValidPeriodPayload(
        bytes memory encodedPayload
    ) public pure returns (SetValidPeriodPayload memory svp) {
        uint index = 0;

        svp.newValidPeriod = uint256(encodedPayload.toUint64(index));
        index += 8;

        require(
            encodedPayload.length == index,
            "invalid length for SetValidPeriodPayload"
        );
    }
}
