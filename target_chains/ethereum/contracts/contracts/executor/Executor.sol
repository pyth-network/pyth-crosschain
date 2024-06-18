// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "../pyth/PythGovernanceInstructions.sol";
import "../wormhole/interfaces/IWormhole.sol";
import "./ExecutorErrors.sol";

contract Executor {
    using BytesLib for bytes;

    // Magic is `PTGM` encoded as a 4 byte data: Pyth Governance Message
    // TODO: it's annoying that we can't import this from PythGovernanceInstructions
    uint32 constant MAGIC = 0x5054474d;

    PythGovernanceInstructions.GovernanceModule constant MODULE =
        PythGovernanceInstructions.GovernanceModule.EvmExecutor;

    // Instruction indicating that the executor contract on
    // targetChainId at executorAddress should call the contract at callAddress
    // with the provided callData
    struct GovernanceInstruction {
        PythGovernanceInstructions.GovernanceModule module;
        ExecutorAction action;
        uint16 targetChainId;
        // The address of the specific executor that should perform the call.
        // This argument is included to support multiple Executors on the same blockchain.
        address executorAddress;
        address callAddress;
        // callAddress will be called with given value
        uint value;
        bytes callData;
    }

    // We have different actions here for potential future extensibility
    enum ExecutorAction {
        // TODO: add an instruction to change the governance data source.
        Execute // 0
    }

    IWormhole private wormhole;
    uint64 private lastExecutedSequence;
    uint16 private chainId;

    uint16 private ownerEmitterChainId;
    bytes32 private ownerEmitterAddress;

    function _initialize(
        address _wormhole,
        uint64 _lastExecutedSequence,
        uint16 _chainId,
        uint16 _ownerEmitterChainId,
        bytes32 _ownerEmitterAddress
    ) internal {
        require(_wormhole != address(0), "_wormhole is zero address");

        wormhole = IWormhole(_wormhole);
        lastExecutedSequence = _lastExecutedSequence;
        chainId = _chainId;
        ownerEmitterChainId = _ownerEmitterChainId;
        ownerEmitterAddress = _ownerEmitterAddress;
    }

    // Execute the contract call in the provided wormhole message.
    // The argument should be the bytes of a valid wormhole message
    // whose payload is a serialized GovernanceInstruction.
    function execute(
        bytes memory encodedVm
    ) public payable returns (bytes memory response) {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVm);

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.targetChainId != chainId && gi.targetChainId != 0)
            revert ExecutorErrors.InvalidGovernanceTarget();

        if (
            gi.action != ExecutorAction.Execute ||
            gi.executorAddress != address(this)
        ) revert ExecutorErrors.DeserializationError();

        // Check if the gi.callAddress is a contract account.
        uint len;
        address callAddress = address(gi.callAddress);
        assembly {
            len := extcodesize(callAddress)
        }
        if (len == 0) revert ExecutorErrors.InvalidContractTarget();

        bool success;
        (success, response) = address(callAddress).call{value: gi.value}(
            gi.callData
        );

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

    /// @dev Called when `msg.value` is not zero and the call data is empty.
    receive() external payable {}

    // Check that the encoded VM is a valid wormhole VAA from the correct emitter
    // and with a sufficiently recent sequence number.
    function verifyGovernanceVM(
        bytes memory encodedVM
    ) internal returns (IWormhole.VM memory parsedVM) {
        (IWormhole.VM memory vm, bool valid, ) = wormhole.parseAndVerifyVM(
            encodedVM
        );

        if (!valid) revert ExecutorErrors.InvalidWormholeVaa();

        if (
            vm.emitterChainId != ownerEmitterChainId ||
            vm.emitterAddress != ownerEmitterAddress
        ) revert ExecutorErrors.UnauthorizedEmitter();

        if (vm.sequence <= lastExecutedSequence)
            revert ExecutorErrors.MessageOutOfOrder();

        lastExecutedSequence = vm.sequence;

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

        if (gi.module != MODULE)
            revert ExecutorErrors.InvalidGovernanceTarget();

        uint8 actionNumber = encodedInstruction.toUint8(index);
        gi.action = ExecutorAction(actionNumber);
        index += 1;

        gi.targetChainId = encodedInstruction.toUint16(index);
        index += 2;

        gi.executorAddress = encodedInstruction.toAddress(index);
        index += 20;

        gi.callAddress = encodedInstruction.toAddress(index);
        index += 20;

        gi.value = encodedInstruction.toUint256(index);
        index += 32;

        // As solidity performs math operations in a checked mode
        // if the length of the encoded instruction be smaller than index
        // it will revert. So we don't need any extra check.
        gi.callData = encodedInstruction.slice(
            index,
            encodedInstruction.length - index
        );
    }

    function getOwnerChainId() public view returns (uint64) {
        return ownerEmitterChainId;
    }

    function getOwnerEmitterAddress() public view returns (bytes32) {
        return ownerEmitterAddress;
    }

    function getLastExecutedSequence() public view returns (uint64) {
        return lastExecutedSequence;
    }
}
