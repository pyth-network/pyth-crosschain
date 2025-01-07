// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "./PulseEvents.sol";
import "./PulseState.sol";

interface IPulseConsumer {
    function pulseCallback(
        uint64 sequenceNumber,
        address updater,
        PythStructs.PriceFeed[] memory priceFeeds
    ) external;
}

interface IPulse is PulseEvents {
    // Core functions
    /**
     * @notice Requests price updates with a callback
     * @dev The msg.value must cover both the Pyth fee and gas costs
     * Note: The actual gas required for execution will be 1.5x the callbackGasLimit
     * to account for cross-contract call overhead + some gas for some other operations in the function before the callback
     * @param publishTime The minimum publish time for price updates
     * @param priceIds The price feed IDs to update
     * @param callbackGasLimit Gas limit for the callback execution
     * @return sequenceNumber The sequence number assigned to this request
     */
    function requestPriceUpdatesWithCallback(
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable returns (uint64 sequenceNumber);

    /**
     * @notice Executes the callback for a price update request
     * @dev Requires 1.5x the callback gas limit to account for cross-contract call overhead
     * For example, if callbackGasLimit is 1M, the transaction needs at least 1.5M gas + some gas for some other operations in the function before the callback
     * @param sequenceNumber The sequence number of the request
     * @param updateData The raw price update data from Pyth
     * @param priceIds The price feed IDs to update, must match the request
     */
    function executeCallback(
        uint64 sequenceNumber,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external payable;

    // Getters
    function getFee(
        uint256 callbackGasLimit
    ) external view returns (uint128 feeAmount);

    function getPythFeeInWei() external view returns (uint128 pythFeeInWei);

    function getAccruedFees() external view returns (uint128 accruedFeesInWei);

    function getRequest(
        uint64 sequenceNumber
    ) external view returns (PulseState.Request memory req);

    // Add these functions to the IPulse interface
    function setFeeManager(address manager) external;

    function withdrawAsFeeManager(uint128 amount) external;
}
