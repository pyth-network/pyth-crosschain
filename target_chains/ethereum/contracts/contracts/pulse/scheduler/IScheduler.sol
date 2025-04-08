// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./SchedulerEvents.sol";
import "./SchedulerState.sol";

interface IScheduler is SchedulerEvents {
    // CORE FUNCTIONS

    /**
     * @notice Adds a new subscription
     * @param subscriptionParams The parameters for the subscription
     * @return subscriptionId The ID of the newly created subscription
     */
    function addSubscription(
        SchedulerState.SubscriptionParams calldata subscriptionParams
    ) external returns (uint256 subscriptionId);

    /**
     * @notice Gets a subscription's parameters and status
     * @param subscriptionId The ID of the subscription
     * @return params The subscription parameters
     * @return status The subscription status
     */
    function getSubscription(
        uint256 subscriptionId
    ) external view returns (SchedulerState.SubscriptionParams memory params, SchedulerState.SubscriptionStatus memory status);

    /**
     * @notice Updates an existing subscription
     * @param subscriptionId The ID of the subscription to update
     * @param newSubscriptionParams The new parameters for the subscription
     */
    function updateSubscription(
        uint256 subscriptionId,
        SchedulerState.SubscriptionParams calldata newSubscriptionParams
    ) external;

    /**
     * @notice Deactivates a subscription
     * @param subscriptionId The ID of the subscription to deactivate
     */
    function deactivateSubscription(
        uint256 subscriptionId
    ) external;

    /**
     * @notice Updates price feeds for a subscription
     * @dev Verifies the updateData using the Pyth contract and validates that all feeds have the same timestamp
     * @param subscriptionId The ID of the subscription
     * @param updateData The price update data from Pyth
     * @param priceIds The IDs of the price feeds to update
     */
    function updatePriceFeeds(
        uint256 subscriptionId,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external;

    /**
     * @notice Gets the latest prices for a subscription
     * @param subscriptionId The ID of the subscription
     * @param priceIds Optional array of price IDs to retrieve. If empty, returns all price feeds for the subscription.
     * @return The latest price feeds for the requested price IDs
     */
    function getLatestPrices(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view returns (PythStructs.PriceFeed[] memory);

    /**
     * @notice Adds funds to a subscription's balance
     * @param subscriptionId The ID of the subscription
     */
    function addFunds(
        uint256 subscriptionId
    ) external payable;

    /**
     * @notice Withdraws funds from a subscription's balance
     * @param subscriptionId The ID of the subscription
     * @param amount The amount to withdraw
     */
    function withdrawFunds(
        uint256 subscriptionId,
        uint256 amount
    ) external;
    
    /**
     * @notice Gets all active subscriptions with their parameters
     * @return subscriptionIds Array of active subscription IDs
     * @return subscriptionParams Array of subscription parameters for each active subscription
     */
    function getActiveSubscriptions() external view returns (
        uint256[] memory subscriptionIds,
        SchedulerState.SubscriptionParams[] memory subscriptionParams
    );
}
