// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./EntropyEvents.sol";
import "./EntropyEventsV2.sol";
import "./EntropyStructsV2.sol";

interface IEntropyV2 is EntropyEventsV2 {
    /// @notice Request a random number using the default provider with default gas limit
    /// @return assignedSequenceNumber A unique identifier for this request
    /// @dev The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    /// The `entropyCallback` method on that interface will receive a callback with the returned sequence number and
    /// the generated random number.
    ///
    /// `entropyCallback` will be run with the `gasLimit` provided to this function.
    /// The `gasLimit` will be rounded up to a multiple of 10k (e.g., 19000 -> 20000), and furthermore is lower bounded
    /// by the provider's configured default limit.
    ///
    /// This method will revert unless the caller provides a sufficient fee (at least `getFeeV2()`) as msg.value.
    /// Note that the fee can change over time. Callers of this method should explicitly compute `getFeeV2()`
    /// prior to each invocation (as opposed to hardcoding a value). Further note that excess value is *not* refunded to the caller.
    ///
    /// Note that this method uses an in-contract PRNG to generate the user's contribution to the random number.
    /// This approach modifies the security guarantees such that a dishonest validator and provider can
    /// collude to manipulate the result (as opposed to a malicious user and provider). That is, the user
    /// now trusts the validator honestly draw a random number. If you wish to avoid this trust assumption,
    /// call a variant of `requestV2` that accepts a `userRandomNumber` parameter.
    function requestV2()
        external
        payable
        returns (uint64 assignedSequenceNumber);

    /// @notice Request a random number using the default provider with specified gas limit
    /// @param gasLimit The gas limit for the callback function.
    /// @return assignedSequenceNumber A unique identifier for this request
    /// @dev The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    /// The `entropyCallback` method on that interface will receive a callback with the returned sequence number and
    /// the generated random number.
    ///
    /// `entropyCallback` will be run with the `gasLimit` provided to this function.
    /// The `gasLimit` will be rounded up to a multiple of 10k (e.g., 19000 -> 20000), and furthermore is lower bounded
    /// by the provider's configured default limit.
    ///
    /// This method will revert unless the caller provides a sufficient fee (at least `getFeeV2(gasLimit)`) as msg.value.
    /// Note that the fee can change over time. Callers of this method should explicitly compute `getFeeV2(gasLimit)`
    /// prior to each invocation (as opposed to hardcoding a value). Further note that excess value is *not* refunded to the caller.
    ///
    /// Note that this method uses an in-contract PRNG to generate the user's contribution to the random number.
    /// This approach modifies the security guarantees such that a dishonest validator and provider can
    /// collude to manipulate the result (as opposed to a malicious user and provider). That is, the user
    /// now trusts the validator honestly draw a random number. If you wish to avoid this trust assumption,
    /// call a variant of `requestV2` that accepts a `userRandomNumber` parameter.
    function requestV2(
        uint32 gasLimit
    ) external payable returns (uint64 assignedSequenceNumber);

    /// @notice Request a random number from a specific provider with specified gas limit
    /// @param provider The address of the provider to request from
    /// @param gasLimit The gas limit for the callback function
    /// @return assignedSequenceNumber A unique identifier for this request
    /// @dev The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    /// The `entropyCallback` method on that interface will receive a callback with the returned sequence number and
    /// the generated random number.
    ///
    /// `entropyCallback` will be run with the `gasLimit` provided to this function.
    /// The `gasLimit` will be rounded up to a multiple of 10k (e.g., 19000 -> 20000), and furthermore is lower bounded
    /// by the provider's configured default limit.
    ///
    /// This method will revert unless the caller provides a sufficient fee (at least `getFeeV2(provider, gasLimit)`) as msg.value.
    /// Note that provider fees can change over time. Callers of this method should explicitly compute `getFeeV2(provider, gasLimit)`
    /// prior to each invocation (as opposed to hardcoding a value). Further note that excess value is *not* refunded to the caller.
    ///
    /// Note that this method uses an in-contract PRNG to generate the user's contribution to the random number.
    /// This approach modifies the security guarantees such that a dishonest validator and provider can
    /// collude to manipulate the result (as opposed to a malicious user and provider). That is, the user
    /// now trusts the validator honestly draw a random number. If you wish to avoid this trust assumption,
    /// call a variant of `requestV2` that accepts a `userRandomNumber` parameter.
    function requestV2(
        address provider,
        uint32 gasLimit
    ) external payable returns (uint64 assignedSequenceNumber);

    /// @notice Request a random number from a specific provider with a user-provided random number and gas limit
    /// @param provider The address of the provider to request from
    /// @param userRandomNumber A random number provided by the user for additional entropy
    /// @param gasLimit The gas limit for the callback function. Pass 0 to get a sane default value -- see note below.
    /// @return assignedSequenceNumber A unique identifier for this request
    /// @dev The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    /// The `entropyCallback` method on that interface will receive a callback with the returned sequence number and
    /// the generated random number.
    ///
    /// `entropyCallback` will be run with the `gasLimit` provided to this function.
    /// The `gasLimit` will be rounded up to a multiple of 10k (e.g., 19000 -> 20000), and furthermore is lower bounded
    /// by the provider's configured default limit.
    ///
    /// This method will revert unless the caller provides a sufficient fee (at least `getFeeV2(provider, gasLimit)`) as msg.value.
    /// Note that provider fees can change over time. Callers of this method should explicitly compute `getFeeV2(provider, gasLimit)`
    /// prior to each invocation (as opposed to hardcoding a value). Further note that excess value is *not* refunded to the caller.
    function requestV2(
        address provider,
        bytes32 userRandomNumber,
        uint32 gasLimit
    ) external payable returns (uint64 assignedSequenceNumber);

    /// @notice Get information about a specific entropy provider
    /// @param provider The address of the provider to query
    /// @return info The provider information including configuration, fees, and operational status
    /// @dev This method returns detailed information about a provider's configuration and capabilities.
    /// The returned ProviderInfo struct contains information such as the provider's fee structure and gas limits.
    function getProviderInfoV2(
        address provider
    ) external view returns (EntropyStructsV2.ProviderInfo memory info);

    /// @notice Get the address of the default entropy provider
    /// @return provider The address of the default provider
    /// @dev This method returns the address of the provider that will be used when no specific provider is specified
    /// in the requestV2 calls. The default provider can be used to get the base fee and gas limit information.
    function getDefaultProvider() external view returns (address provider);

    /// @notice Get information about a specific request
    /// @param provider The address of the provider that handled the request
    /// @param sequenceNumber The unique identifier of the request
    /// @return req The request information including status, random number, and other metadata
    /// @dev This method allows querying the state of a previously made request. The returned Request struct
    /// contains information about whether the request was fulfilled, the generated random number (if available),
    /// and other metadata about the request.
    function getRequestV2(
        address provider,
        uint64 sequenceNumber
    ) external view returns (EntropyStructsV2.Request memory req);

    /// @notice Get the fee charged by the default provider for the default gas limit
    /// @return feeAmount The fee amount in wei
    /// @dev This method returns the base fee required to make a request using the default provider with
    /// the default gas limit. This fee should be passed as msg.value when calling requestV2().
    /// The fee can change over time, so this method should be called before each request.
    function getFeeV2() external view returns (uint128 feeAmount);

    /// @notice Get the fee charged by the default provider for a specific gas limit
    /// @param gasLimit The gas limit for the callback function
    /// @return feeAmount The fee amount in wei
    /// @dev This method returns the fee required to make a request using the default provider with
    /// the specified gas limit. This fee should be passed as msg.value when calling requestV2(gasLimit).
    /// The fee can change over time, so this method should be called before each request.
    function getFeeV2(
        uint32 gasLimit
    ) external view returns (uint128 feeAmount);

    /// @notice Get the fee charged by a specific provider for a request with a given gas limit
    /// @param provider The address of the provider to query
    /// @param gasLimit The gas limit for the callback function
    /// @return feeAmount The fee amount in wei
    /// @dev This method returns the fee required to make a request using the specified provider with
    /// the given gas limit. This fee should be passed as msg.value when calling requestV2(provider, gasLimit)
    /// or requestV2(provider, userRandomNumber, gasLimit). The fee can change over time, so this method
    /// should be called before each request.
    function getFeeV2(
        address provider,
        uint32 gasLimit
    ) external view returns (uint128 feeAmount);
}
