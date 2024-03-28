// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./EntropyEvents.sol";

interface IEntropy is EntropyEvents {
    // Register msg.sender as a randomness provider. The arguments are the provider's configuration parameters
    // and initial commitment. Re-registering the same provider rotates the provider's commitment (and updates
    // the feeInWei).
    //
    // chainLength is the number of values in the hash chain *including* the commitment, that is, chainLength >= 1.
    function register(
        uint128 feeInWei,
        bytes32 commitment,
        bytes calldata commitmentMetadata,
        uint64 chainLength,
        bytes calldata uri
    ) external;

    // Withdraw a portion of the accumulated fees for the provider msg.sender.
    // Calling this function will transfer `amount` wei to the caller (provided that they have accrued a sufficient
    // balance of fees in the contract).
    function withdraw(uint128 amount) external;

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
    ) external payable returns (uint64 assignedSequenceNumber);

    // Request a random number. The method expects the provider address and a secret random number
    // in the arguments. It returns a sequence number.
    //
    // The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    // The `entropyCallback` method on that interface will receive a callback with the generated random number.
    //
    // This method will revert unless the caller provides a sufficient fee (at least getFee(provider)) as msg.value.
    // Note that excess value is *not* refunded to the caller.
    function requestWithCallback(
        address provider,
        bytes32 userRandomNumber
    ) external payable returns (uint64 assignedSequenceNumber);

    // Fulfill a request for a random number and call back the requester. This method validates the provided userRandomness
    // and provider's revelation against the corresponding commitment in the in-flight request. If both values are validated
    // and the requestor address is a contract address, this function calls the requester's entropyCallback method with the
    // sequence number and the random number as arguments. Else if the requestor is an EOA, it won't call it.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    function reveal(
        address provider,
        uint64 sequenceNumber,
        bytes32 userRevelation,
        bytes32 providerRevelation
    ) external returns (bytes32 randomNumber);

    // Fulfill a request for a random number and call back the requester. This method validates the provided userRandomness
    // and provider's revelation against the corresponding commitment in the in-flight request. If both values are validated,
    // this function calls the requester's entropyCallback method with the sequence number and the random number as arguments.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    //
    // Anyone can call this method to fulfill a request, but the callback will only be made to the original requester.
    function revealWithCallback(
        address provider,
        uint64 sequenceNumber,
        bytes32 userRandomNumber,
        bytes32 providerRevelation
    ) external;

    function getProviderInfo(
        address provider
    ) external view returns (EntropyStructs.ProviderInfo memory info);

    function getDefaultProvider() external view returns (address provider);

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) external view returns (EntropyStructs.Request memory req);

    function getFee(address provider) external view returns (uint128 feeAmount);

    function getAccruedPythFees()
        external
        view
        returns (uint128 accruedPythFeesInWei);

    function setProviderFee(uint128 newFeeInWei) external;

    function setProviderUri(bytes calldata newUri) external;

    function constructUserCommitment(
        bytes32 userRandomness
    ) external pure returns (bytes32 userCommitment);

    function combineRandomValues(
        bytes32 userRandomness,
        bytes32 providerRandomness,
        bytes32 blockHash
    ) external pure returns (bytes32 combinedRandomness);
}
