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
    // module 2 corresponds to Target Chain contracts
    uint8 constant MODULE = 2;

    using BytesLib for bytes;

    struct GovernanceInstruction {
        uint8 module;
        uint8 action;
        uint16 targetChainId;
        bytes payload;
    }

    enum GovernanceAction {
        UpgradeContract, // 1
        SetGovernanceDataSource, // 2
        SetDataSources, // 3
        SetFee, // 4
        SetValidPeriod // 5
    }

    struct UpgradeContractPayload {
        address newImplementation;
    }

    struct SetGovernanceDataSourcePayload {
        PythInternalStructs.DataSource newGovernanceDataSource;
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
    function parseGovernanceInstruction(bytes memory encodedInstruction) public pure returns (GovernanceInstruction memory gi) {
        uint index = 0;

        gi.module = encodedInstruction.toUint8(index);
        index += 1;

        require(gi.module == MODULE, "invalid module for GovernanceInstruction");

        gi.action = encodedInstruction.toUint8(index);
        index += 1;

        gi.targetChainId = encodedInstruction.toUint16(index);
        index += 2;

        gi.payload = encodedInstruction.slice(index, encodedInstruction.length - index);
    }

    /// @dev Parse a UpgradeContractPayload (action 1) with minimal validation
    function parseUpgradeContractPayload(bytes memory encodedPayload) public pure returns (UpgradeContractPayload memory uc) {
        uint index = 0;

        uc.newImplementation = address(uint160(uint256(encodedPayload.toBytes32(index))));
        index += 32;

        require(encodedPayload.length == index, "invalid length for UpgradeContractPayload");
    }

    /// @dev Parse a SetGovernanceDataSourcePayload (action 2) with minimal validation
    function parseSetGovernanceDataSourcePayload(bytes memory encodedPayload) public pure returns (SetGovernanceDataSourcePayload memory sgds) {
        uint index = 0;

        sgds.newGovernanceDataSource.chainId = encodedPayload.toUint16(index);
        index += 2;

        sgds.newGovernanceDataSource.emitterAddress = encodedPayload.toBytes32(index);
        index += 32;

        require(encodedPayload.length == index, "invalid length for SetGovernanceDataSourcePayload");
    }

    /// @dev Parse a SetDataSourcesPayload (action 3) with minimal validation
    function parseSetDataSourcesPayload(bytes memory encodedPayload) public pure returns (SetDataSourcesPayload memory sds) {
        uint index = 0;

        uint8 dataSourcesLength = encodedPayload.toUint8(index);
        index += 1;

        sds.dataSources = new PythInternalStructs.DataSource[](dataSourcesLength);

        for(uint i = 0; i < dataSourcesLength; i++) {
            sds.dataSources[i].chainId = encodedPayload.toUint16(index);
            index += 2;

            sds.dataSources[i].emitterAddress = encodedPayload.toBytes32(index);
            index += 32;
        }

        require(encodedPayload.length == index, "invalid length for SetDataSourcesPayload");
    }

    /// @dev Parse a SetFeePayload (action 4) with minimal validation
    function parseSetFeePayload(bytes memory encodedPayload) public pure returns (SetFeePayload memory sf) {
        uint index = 0;

        sf.newFee = encodedPayload.toUint256(index);
        index += 32;

        require(encodedPayload.length == index, "invalid length for SetFeePayload");
    }

    /// @dev Parse a SetValidPeriodPayload (action 5) with minimal validation
    function parseSetValidPeriodPayload(bytes memory encodedPayload) public pure returns (SetValidPeriodPayload memory svp) {
        uint index = 0;

        svp.newValidPeriod = encodedPayload.toUint256(index);
        index += 32;

        require(encodedPayload.length == index, "invalid length for SetValidPeriodPayload");
    }
}
