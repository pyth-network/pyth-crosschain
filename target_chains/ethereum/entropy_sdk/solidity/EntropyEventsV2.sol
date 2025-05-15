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
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event Registered(address indexed provider, bytes extraArgs);

    /**
     * @notice Emitted when a user requests a random number from a provider
     * @param provider The address of the provider handling the request
     * @param caller The address of the user requesting the random number
     * @param sequenceNumber A unique identifier for this request
     * @param userContribution The user's contribution to the random number
     * @param gasLimit The gas limit for the callback.
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event Requested(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 userContribution,
        uint32 gasLimit,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider reveals the generated random number
     * @param provider The address of the provider that generated the random number
     * @param caller The address of the user who requested the random number (and who receives a callback)
     * @param sequenceNumber The unique identifier of the request
     * @param randomNumber The generated random number
     * @param userContribution The user's contribution to the random number
     * @param providerContribution The provider's contribution to the random number
     * @param callbackFailed Whether the callback to the caller failed
     * @param callbackReturnValue Return value from the callback. If the callback failed, this field contains
     * the error code and any additional returned data. Note that "" often indicates an out-of-gas error.
     * If the callback returns more than 256 bytes, only the first 256 bytes of the callback return value are included.
     * @param callbackGasUsed How much gas the callback used.
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event Revealed(
        address indexed provider,
        address indexed caller,
        uint64 indexed sequenceNumber,
        bytes32 randomNumber,
        bytes32 userContribution,
        bytes32 providerContribution,
        bool callbackFailed,
        bytes callbackReturnValue,
        uint32 callbackGasUsed,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider updates their fee
     * @param provider The address of the provider updating their fee
     * @param oldFee The previous fee amount
     * @param newFee The new fee amount
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event ProviderFeeUpdated(
        address indexed provider,
        uint128 oldFee,
        uint128 newFee,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider updates their default gas limit
     * @param provider The address of the provider updating their gas limit
     * @param oldDefaultGasLimit The previous default gas limit
     * @param newDefaultGasLimit The new default gas limit
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event ProviderDefaultGasLimitUpdated(
        address indexed provider,
        uint32 oldDefaultGasLimit,
        uint32 newDefaultGasLimit,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider updates their URI
     * @param provider The address of the provider updating their URI
     * @param oldUri The previous URI
     * @param newUri The new URI
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event ProviderUriUpdated(
        address indexed provider,
        bytes oldUri,
        bytes newUri,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider updates their fee manager address
     * @param provider The address of the provider updating their fee manager
     * @param oldFeeManager The previous fee manager address
     * @param newFeeManager The new fee manager address
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event ProviderFeeManagerUpdated(
        address indexed provider,
        address oldFeeManager,
        address newFeeManager,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider updates their maximum number of hashes that can be advanced
     * @param provider The address of the provider updating their max hashes
     * @param oldMaxNumHashes The previous maximum number of hashes
     * @param newMaxNumHashes The new maximum number of hashes
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event ProviderMaxNumHashesAdvanced(
        address indexed provider,
        uint32 oldMaxNumHashes,
        uint32 newMaxNumHashes,
        bytes extraArgs
    );

    /**
     * @notice Emitted when a provider withdraws their accumulated fees
     * @param provider The address of the provider withdrawing fees
     * @param recipient The address receiving the withdrawn fees
     * @param withdrawnAmount The amount of fees withdrawn
     * @param extraArgs A field for extra data for forward compatibility.
     */
    event Withdrawal(
        address indexed provider,
        address indexed recipient,
        uint128 withdrawnAmount,
        bytes extraArgs
    );
}
