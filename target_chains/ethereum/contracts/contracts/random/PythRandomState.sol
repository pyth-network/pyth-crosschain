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
        bytes32 commitmentMetadata; // use to encode identifying information for which tree this is.
        uint64 commitmentEnd;

        bytes32 lastRevelation;
        uint64 lastRevelationSequenceNumber;
    }

    // TODO: add block number?
    struct Request {
        address provider;
        uint64 sequenceNumber;
        bytes32 userCommitment;

        bytes32 lastProviderRevelation;
        uint64 lastProviderRevelationSequenceNumber;
    }
}

contract PythRandomState {
    PythRandomStructs.State _state;
}
