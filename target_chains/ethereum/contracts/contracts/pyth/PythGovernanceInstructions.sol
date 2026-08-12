// contracts/GovernanceStructs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";
import "./PythInternalStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

using BytesLib for bytes;

// The governance instruction types below are declared at file level (rather than
// inside `PythGovernanceInstructions`) so that both the Pyth implementation
// contract and the `PythGovernanceModule` library can reference them. A library
// cannot inherit from a contract, so contract-scoped declarations would not be
// visible to it.

// Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
uint32 constant MAGIC = 0x5054474d;

enum GovernanceModule {
    Executor, // 0
    Target, // 1
    EvmExecutor, // 2
    // The stacks target chain contract has custom governance instructions and needs its own module.
    StacksTarget, // 3
    // The Stellar wormhole executor (in pyth-network/pyth-lazer) has its own
    // module so its generic-dispatch actions do not collide with another
    // module's fixed actions. Reserved here so the id is not reused.
    StellarExecutor // 4
}

GovernanceModule constant MODULE = GovernanceModule.Target;

enum GovernanceAction {
    UpgradeContract, // 0
    AuthorizeGovernanceDataSourceTransfer, // 1
    SetDataSources, // 2
    SetFee, // 3
    SetValidPeriod, // 4
    RequestGovernanceDataSourceTransfer, // 5
    SetWormholeAddress, // 6
    SetFeeInToken, // 7 - No-op for EVM chains
    SetTransactionFee, // 8
    WithdrawFee // 9
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

struct SetWormholeAddressPayload {
    address newWormholeAddress;
}

struct SetTransactionFeePayload {
    uint newFee;
}

struct WithdrawFeePayload {
    address targetAddress;
    // Fee in wei, matching the native uint256 type used for address.balance in EVM
    uint256 fee;
}

/// @dev Parse a GovernanceInstruction
/// Declared as a free function so that both `PythGovernanceInstructions` and the
/// `PythGovernanceModule` library can use it without duplicating the logic.
function decodeGovernanceInstruction(
    bytes memory encodedInstruction
) pure returns (GovernanceInstruction memory gi) {
    uint index = 0;

    uint32 magic = encodedInstruction.toUint32(index);

    if (magic != MAGIC) revert PythErrors.InvalidGovernanceMessage();

    index += 4;

    uint8 modNumber = encodedInstruction.toUint8(index);
    gi.module = GovernanceModule(modNumber);
    index += 1;

    if (gi.module != MODULE) revert PythErrors.InvalidGovernanceTarget();

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

/// @dev Parse a UpgradeContractPayload (action 0) with minimal validation
function decodeUpgradeContractPayload(
    bytes memory encodedPayload
) pure returns (UpgradeContractPayload memory uc) {
    uint index = 0;

    uc.newImplementation = address(encodedPayload.toAddress(index));
    index += 20;

    if (encodedPayload.length != index)
        revert PythErrors.InvalidGovernanceMessage();
}

/**
 * @dev `PythGovernanceInstructions` exposes the parsing functions that the Pyth
 * implementation contract needs on its own hot/upgrade path. The parsers for the
 * remaining governance actions live in the `PythGovernanceModule` library, which
 * is deployed separately and linked into the implementation.
 */
contract PythGovernanceInstructions {
    /// @dev Parse a GovernanceInstruction
    function parseGovernanceInstruction(
        bytes memory encodedInstruction
    ) public pure returns (GovernanceInstruction memory gi) {
        return decodeGovernanceInstruction(encodedInstruction);
    }

    /// @dev Parse a UpgradeContractPayload (action 0) with minimal validation
    function parseUpgradeContractPayload(
        bytes memory encodedPayload
    ) public pure returns (UpgradeContractPayload memory uc) {
        return decodeUpgradeContractPayload(encodedPayload);
    }
}
