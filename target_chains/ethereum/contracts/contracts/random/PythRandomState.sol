// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythInternalStructs.sol";
import "./PythDeprecatedStructs.sol";

contract PythRandomStructs {
    struct State {
        uint pythFeeInWei;
        mapping(address => ProviderInfo) providers;
        mapping(bytes32 => Request) requests;
    }

    struct ProviderInfo {
        uint feeInWei;
        uint64 sequenceNumber;
        bytes20 currentCommitment;
        // The first sequence number that isn't in the merkle tree covered by currentCommitment
        uint64 finalSequenceNumber;
        // TODO: must be nullable somehow. could be all zero i guess
        bytes20 nextCommitment;
    }

    struct Request {
        address provider;
        uint256 commitment;
        uint64 sequenceNumber;
    }
}

contract PythRandomState {
    PythRandomStructs.State _state;
}
