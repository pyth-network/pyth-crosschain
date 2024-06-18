// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

library ExecutorErrors {
    // The provided message is not a valid Wormhole VAA.
    // Signature: 0x2acbe915
    error InvalidWormholeVaa();
    // The message is coming from an emitter that is not authorized to use this contract.
    // Signature: 0x4c79d142
    error UnauthorizedEmitter();
    // The sequence number of the provided message is before the last executed message.
    // Signature: 0xc75415f9
    error MessageOutOfOrder();
    // The call to the provided contract executed without providing its own error.
    // Signature: 0xf21e646b
    error ExecutionReverted();
    // The message could not be deserialized into an instruction
    // Signature: 0xfbab86cf
    error DeserializationError();
    // The message is not intended for this contract.
    // Signature: 0x63daeb77
    error InvalidGovernanceTarget();
    // The target address for the contract call is not a contract
    // Signature: 0xd30c1cb5
    error InvalidContractTarget();
    // The governance message is not valid
    // Signature: 0x4ed848c1
    error InvalidMagicValue();
}
