// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../pyth/PythGovernanceInstructions.sol";
import "../wormhole/interfaces/IWormhole.sol";
import "./ExecutorErrors.sol";
import "./ExecutorState.sol";

abstract contract Executor is ExecutorState {
    using BytesLib for bytes;

    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    // We have different actions here for potential future extensibility
    enum ExecutorAction {
        // TODO: add an instruction to change the governance data source.
        Execute, // 0
        UpgradeContract // 1
    }

    struct GovernanceInstruction {
        PythGovernanceInstructions.GovernanceModule module;
        ExecutorAction action;
        uint16 targetChainId;
        bytes payload;
    }

    struct UpgradeContractPayload {
        address newImplementation;
    }

    /// @dev Parse a UpgradeContractPayload (action 1) with minimal validation
    function parseUpgradeContractPayload(
        bytes memory encodedPayload
    ) public pure returns (UpgradeContractPayload memory uc) {
        uint index = 0;

        uc.newImplementation = address(encodedPayload.toAddress(index));
        index += 20;

        if (encodedPayload.length != index)
            revert PythErrors.InvalidGovernanceMessage();
    }

    struct ExecutePayload {
        // The address of the specific executor that should perform the call.
        // This argument is included to support multiple Executors on the same blockchain.
        address executorAddress;
        address callAddress;
        bytes callData;
    }

    function parseExecutePayload(
        bytes memory encodedPayload
    ) public pure returns (ExecutePayload memory e) {
        uint index = 0;
        e.executorAddress = encodedPayload.toAddress(index);
        index += 20;

        e.callAddress = encodedPayload.toAddress(index);
        index += 20;

        // As solidity performs math operations in a checked mode
        // if the length of the encoded instruction be smaller than index
        // it will revert. So we don't need any extra check.
        e.callData = encodedPayload.slice(index, encodedPayload.length - index);
    }

    function _initialize(
        address _wormhole,
        uint64 _lastExecutedSequence,
        uint16 _chainId,
        uint16 _ownerEmitterChainId,
        bytes32 _ownerEmitterAddress
    ) internal {
        require(_wormhole != address(0), "_wormhole is zero address");

        _state.wormhole = IWormhole(_wormhole);
        _state.lastExecutedSequence = _lastExecutedSequence;
        _state.chainId = _chainId;
        _state.ownerEmitterChainId = _ownerEmitterChainId;
        _state.ownerEmitterAddress = _ownerEmitterAddress;
    }

    // Execute the contract call in the provided wormhole message.
    // The argument should be the bytes of a valid wormhole message
    // whose payload is a serialized GovernanceInstruction.
    function executeGovernanceInstruction(
        bytes memory encodedVm
    ) public returns (bytes memory response) {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVm);

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.targetChainId != _state.chainId && gi.targetChainId != 0)
            revert ExecutorErrors.InvalidGovernanceTarget();

        if (gi.action == ExecutorAction.Execute) {
            return execute(parseExecutePayload(gi.payload));
        } else if (gi.action == ExecutorAction.UpgradeContract) {
            if (gi.targetChainId == 0)
                revert ExecutorErrors.InvalidGovernanceTarget();
            upgradeContract(parseUpgradeContractPayload(gi.payload));
        } else {
            revert ExecutorErrors.DeserializationError();
        }
    }

    /// @dev Called when `msg.value` is not zero and the call data is empty.
    receive() external payable {}

    // Check that the encoded VM is a valid wormhole VAA from the correct emitter
    // and with a sufficiently recent sequence number.
    function verifyGovernanceVM(
        bytes memory encodedVM
    ) internal returns (IWormhole.VM memory parsedVM) {
        (IWormhole.VM memory vm, bool valid, ) = (_state.wormhole)
            .parseAndVerifyVM(encodedVM);

        if (!valid) revert ExecutorErrors.InvalidWormholeVaa();

        if (
            vm.emitterChainId != _state.ownerEmitterChainId ||
            vm.emitterAddress != _state.ownerEmitterAddress
        ) revert ExecutorErrors.UnauthorizedEmitter();

        if (vm.sequence <= _state.lastExecutedSequence)
            revert ExecutorErrors.MessageOutOfOrder();

        _state.lastExecutedSequence = vm.sequence;

        return vm;
    }

    /// @dev Parse a GovernanceInstruction
    function parseGovernanceInstruction(
        bytes memory encodedInstruction
    ) public pure returns (GovernanceInstruction memory gi) {
        uint index = 0;

        uint32 magic = encodedInstruction.toUint32(index);

        if (magic != MAGIC) revert ExecutorErrors.DeserializationError();

        index += 4;

        uint8 modNumber = encodedInstruction.toUint8(index);
        gi.module = PythGovernanceInstructions.GovernanceModule(modNumber);
        index += 1;

        if (gi.module != MODULE) revert PythErrors.InvalidGovernanceTarget();

        uint8 actionNumber = encodedInstruction.toUint8(index);
        gi.action = ExecutorAction(actionNumber);
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

    function execute(
        ExecutePayload memory payload
    ) internal returns (bytes memory response) {
        if (payload.executorAddress != address(this))
            revert ExecutorErrors.DeserializationError();

        // Check if the payload.callAddress is a contract account.
        uint len;
        address callAddress = address(payload.callAddress);
        assembly {
            len := extcodesize(callAddress)
        }
        if (len == 0) revert ExecutorErrors.InvalidContractTarget();

        bool success;
        (success, response) = address(callAddress).call(payload.callData);
        // Check if the call was successful or not.
        if (!success) {
            // If there is return data, the delegate call reverted with a reason or a custom error, which we bubble up.
            if (response.length > 0) {
                // The first word of response is the length, so when we call revert we add 1 word (32 bytes)
                // to give the pointer to the beginning of the revert data and pass the size as the second argument.
                assembly {
                    let returndata_size := mload(response)
                    revert(add(32, response), returndata_size)
                }
            } else {
                revert ExecutorErrors.ExecutionReverted();
            }
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
}
