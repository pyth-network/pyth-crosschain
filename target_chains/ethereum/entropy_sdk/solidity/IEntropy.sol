// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythRandomEvents.sol";

interface IEntropy is PythRandomEvents {
    // Register msg.sender as a randomness provider. The arguments are the provider's configuration parameters
    // and initial commitment. Re-registering the same provider rotates the provider's commitment (and updates
    // the feeInWei).
    //
    // chainLength is the number of values in the hash chain *including* the commitment, that is, chainLength >= 1.
    function register(
        uint feeInWei,
        bytes32 commitment,
        bytes32 commitmentMetadata,
        uint64 chainLength
    ) public;

    // Withdraw a portion of the accumulated fees for the provider msg.sender.
    // Calling this function will transfer `amount` wei to the caller (provided that they have accrued a sufficient
    // balance of fees in the contract).
    function withdraw(uint256 amount) public;

    // As a user, request a random number from `provider`. Prior to calling this method, the user should
    // generate a random number x and keep it secret. The user should then compute hash(x) and pass that
    // as the userCommitment argument. (You may call the constructUserCommitment method to compute the hash.)
    //
    // This method returns a sequence number. The user should pass this sequence number to
    // their chosen provider (the exact method for doing so will depend on the provider) to retrieve the provider's
    // number. The user should then call fulfillRequest to construct the final random number.
    //
    // This method will revert unless the caller provides a sufficient fee (at least getFee(provider)) as msg.value.
    // Note that excess value is *not* refunded to the caller.
    function request(
        address provider,
        bytes32 userCommitment,
        bool useBlockHash
    ) public payable returns (uint64 assignedSequenceNumber);

    // Fulfill a request for a random number. This method validates the provided userRandomness and provider's proof
    // against the corresponding commitments in the in-flight request. If both values are validated, this function returns
    // the corresponding random number.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    function reveal(
        address provider,
        uint64 sequenceNumber,
        bytes32 userRandomness,
        bytes32 providerRevelation
    ) public returns (bytes32 randomNumber);

    function getProviderInfo(
        address provider
    ) public view returns (PythRandomStructs.ProviderInfo memory info);

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) public view returns (PythRandomStructs.Request memory req);

    function getFee(address provider) public view returns (uint feeAmount);

    function getAccruedPythFees()
        public
        view
        returns (uint accruedPythFeesInWei);

    function constructUserCommitment(
        bytes32 userRandomness
    ) public pure returns (bytes32 userCommitment);

    function combineRandomValues(
        bytes32 userRandomness,
        bytes32 providerRandomness,
        bytes32 blockHash
    ) public pure returns (bytes32 combinedRandomness);

    // Create a unique key for an in-flight randomness request (to store it in the contract state)
    function requestKey(
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hash);

    // Validate that revelation at sequenceNumber is the correct value in the hash chain for a provider whose
    // last known revealed random number was lastRevelation at lastSequenceNumber.
    function isProofValid(
        uint64 lastSequenceNumber,
        bytes32 lastRevelation,
        uint64 sequenceNumber,
        bytes32 revelation
    ) internal pure returns (bool valid);
}
