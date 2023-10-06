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
        bytes20 commitment;
        bytes32 commitmentMetadata; // use to encode identifying information for which tree this is.
        uint64 commitmentEnd;
    }

    // TODO: add block number?
    struct Request {
        address provider;
        bytes20 providerCommitment;
        bytes32 userCommitment;
        uint64 sequenceNumber;
    }
}

contract PythRandomState {
    PythRandomStructs.State _state;
}
