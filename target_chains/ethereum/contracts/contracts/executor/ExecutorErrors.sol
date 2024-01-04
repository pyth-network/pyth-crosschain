// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library ExecutorErrors {
    // The provided message is not a valid Wormhole VAA.
    error InvalidWormholeVaa();
    // The message is coming from an emitter that is not authorized to use this contract.
    error UnauthorizedEmitter();
    // The sequence number of the provided message is before the last executed message.
    error MessageOutOfOrder();
    // The call to the provided contract executed without providing its own error.
    error ExecutionReverted();
    // The message could not be deserialized into an instruction
    error DeserializationError();
    // The message is not intended for this contract.
    error InvalidGovernanceTarget();
    // The target address for the contract call is not a contract
    error InvalidContractTarget();
    // The governance message is not valid
    error InvalidMagicValue();
}
