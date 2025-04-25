// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

/**
 * @title EntropyEventsV2
 * @notice Interface defining events for the Entropy V2 system, which handles random number generation
 * and provider management on Ethereum.
 * @dev This interface is used to emit events that track the lifecycle of random number requests,
 * provider registrations, and system configurations.
 */
interface EntropyEventsV2 {
    /**
     * @notice Emitted when a new provider registers with the Entropy system
     * @param provider The address of the registered provider
     * @param dummy Additional data field (unused)
     */
    event Registered(address indexed provider, bytes dummy);

    /**
     * @notice Emitted when a user requests a random number from a provider
     * @param provider The address of the provider handling the request
     * @param caller The address of the user requesting the random number
     * @param sequenceNumber A unique identifier for this request
     * @param userRandomNumber A random number provided by the user for additional entropy
     * @param dummy Additional data field (unused)
     */
    event Requested(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 userRandomNumber,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider reveals the generated random number
     * @param provider The address of the provider that generated the random number
     * @param caller The address of the user who requested the random number (and who receives a callback)
     * @param sequenceNumber The unique identifier of the request
     * @param randomNumber The generated random number
     * @param callbackFailed Whether the callback to the caller failed
     * @param callbackErrorCode If the callback failed, the error code from the callback. Note
     * that "" often indicates an out-of-gas error.
     * @param dummy Additional data field (unused)
     */
    event Revealed(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 randomNumber,
        bool callbackFailed,
        bytes callbackErrorCode,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider updates their fee
     * @param provider The address of the provider updating their fee
     * @param oldFee The previous fee amount
     * @param newFee The new fee amount
     * @param dummy Additional data field (unused)
     */
    event ProviderFeeUpdated(
        address indexed provider,
        uint128 oldFee,
        uint128 newFee,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider updates their default gas limit
     * @param provider The address of the provider updating their gas limit
     * @param oldDefaultGasLimit The previous default gas limit
     * @param newDefaultGasLimit The new default gas limit
     * @param dummy Additional data field (unused)
     */
    event ProviderDefaultGasLimitUpdated(
        address indexed provider,
        uint32 oldDefaultGasLimit,
        uint32 newDefaultGasLimit,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider updates their URI
     * @param provider The address of the provider updating their URI
     * @param oldUri The previous URI
     * @param newUri The new URI
     * @param dummy Additional data field (unused)
     */
    event ProviderUriUpdated(
        address indexed provider,
        bytes oldUri,
        bytes newUri,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider updates their fee manager address
     * @param provider The address of the provider updating their fee manager
     * @param oldFeeManager The previous fee manager address
     * @param newFeeManager The new fee manager address
     * @param dummy Additional data field (unused)
     */
    event ProviderFeeManagerUpdated(
        address indexed provider,
        address oldFeeManager,
        address newFeeManager,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider updates their maximum number of hashes that can be advanced
     * @param provider The address of the provider updating their max hashes
     * @param oldMaxNumHashes The previous maximum number of hashes
     * @param newMaxNumHashes The new maximum number of hashes
     * @param dummy Additional data field (unused)
     */
    event ProviderMaxNumHashesAdvanced(
        address indexed provider,
        uint32 oldMaxNumHashes,
        uint32 newMaxNumHashes,
        bytes dummy
    );

    /**
     * @notice Emitted when a provider withdraws their accumulated fees
     * @param provider The address of the provider withdrawing fees
     * @param recipient The address receiving the withdrawn fees
     * @param withdrawnAmount The amount of fees withdrawn
     * @param dummy Additional data field (unused)
     */
    event Withdrawal(
        address indexed provider,
        address indexed recipient,
        uint128 withdrawnAmount,
        bytes dummy
    );
}
