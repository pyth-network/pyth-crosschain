// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract PythRandomStructs {
    struct State {
        uint pythFeeInWei;
        uint accruedPythFeesInWei;
        mapping(address => ProviderInfo) providers;
        mapping(bytes32 => Request) requests;
    }

    struct ProviderInfo {
        uint feeInWei;
        uint accruedFeesInWei;
        uint64 sequenceNumber;
        // Current commitment and the last sequence number included in the commitment
        bytes20 currentCommitment;
        uint64 finalSequenceNumber;
        // TODO: must be nullable somehow. could be all zero i guess
        bytes20 nextCommitment;
        uint64 nextFinalSequenceNumber;
    }

    // TODO: add block number?
    struct Request {
        address provider;
        bytes32 commitment;
        uint64 sequenceNumber;
    }
}

contract PythRandomState {
    PythRandomStructs.State _state;
}
