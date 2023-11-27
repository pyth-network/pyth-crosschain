// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract EntropyStructs {
    struct State {
        uint128 pythFeeInWei;
        uint128 accruedPythFeesInWei;
        mapping(address => ProviderInfo) providers;
        mapping(bytes32 => Request) requests;
    }

    struct ProviderInfo {
        uint128 feeInWei;
        uint128 accruedFeesInWei;
        // The commitment that the provider posted to the blockchain, and the sequence number
        // where they committed to this. This value is not advanced after the provider commits,
        // and instead is stored to help providers track where they are in the hash chain.
        bytes32 originalCommitment;
        uint64 originalCommitmentSequenceNumber;
        // Metadata for the current commitment. Providers may optionally use this field to to help
        // manage rotations (i.e., to pick the sequence number from the correct hash chain).
        bytes commitmentMetadata;
        // The first sequence number that is *not* included in the current commitment (i.e., an exclusive end index).
        // The contract maintains the invariant that sequenceNumber <= endSequenceNumber.
        // If sequenceNumber == endSequenceNumber, the provider must rotate their commitment to add additional random values.
        uint64 endSequenceNumber;
        // The sequence number that will be assigned to the next inbound user request.
        uint64 sequenceNumber;
        // The current commitment represents an index/value in the provider's hash chain.
        // These values are used to verify requests for future sequence numbers. Note that
        // currentCommitmentSequenceNumber < sequenceNumber.
        //
        // The currentCommitment advances forward through the provider's hash chain as values
        // are revealed on-chain.
        bytes32 currentCommitment;
        uint64 currentCommitmentSequenceNumber;
    }

    struct Request {
        // The number of hashes
        uint64 numHashes;
        // If nonzero, the randomness requester wants the blockhash of this block to be incorporated into the random number.
        // Note that we're using a uint128 such that this field fits into the same storage slot as numHashes above.
        // Although block.number returns a uint256, 128 bits should be plenty to index all of the blocks ever generated.
        uint128 blockNumber;
        // The commitment is keccak256(userCommitment, providerCommitment). Storing the hash instead of both saves 20k gas by
        // eliminating 1 store.
        bytes32 commitment;
    }
}
