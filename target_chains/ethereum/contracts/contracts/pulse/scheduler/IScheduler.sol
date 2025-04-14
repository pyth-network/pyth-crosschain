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
     * @dev Requires msg.value to be at least the minimum balance for the subscription
     */
    function addSubscription(
        SchedulerState.SubscriptionParams calldata subscriptionParams
    ) external payable returns (uint256 subscriptionId);

    /**
     * @notice Gets a subscription's parameters and status
     * @param subscriptionId The ID of the subscription
     * @return params The subscription parameters
     * @return status The subscription status
     */
    function getSubscription(
        uint256 subscriptionId
    )
        external
        view
        returns (
            SchedulerState.SubscriptionParams memory params,
            SchedulerState.SubscriptionStatus memory status
        );

    /**
     * @notice Updates an existing subscription
     * @param subscriptionId The ID of the subscription to update
     * @param newSubscriptionParams The new parameters for the subscription
     */
    function updateSubscription(
        uint256 subscriptionId,
        SchedulerState.SubscriptionParams calldata newSubscriptionParams
    ) external payable;

    // Deactivation is now handled through updateSubscription by setting isActive to false

    /**
     * @notice Updates price feeds for a subscription.
     * Verifies the updateData using the Pyth contract and validates that all feeds have the same timestamp.
     * @param subscriptionId The ID of the subscription
     * @param updateData The price update data from Pyth
     * @param priceIds The IDs of the price feeds to update
     */
    function updatePriceFeeds(
        uint256 subscriptionId,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external;

    /** @notice Returns the price of a price feed without any sanity checks.
     * @dev This function returns the most recent price update in this contract without any recency checks.
     * This function is unsafe as the returned price update may be arbitrarily far in the past.
     *
     * Users of this function should check the `publishTime` in the price to ensure that the returned price is
     * sufficiently recent for their application. If you are considering using this function, it may be
     * safer / easier to use `getPriceNoOlderThan`.
     * @return prices - please read the documentation of PythStructs.Price to understand how to use this safely.
     */
    function getPricesUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view returns (PythStructs.Price[] memory prices);

    /** @notice Returns the exponentially-weighted moving average price of a price feed without any sanity checks.
     * @dev This function returns the same price as `getEmaPrice` in the case where the price is available.
     * However, if the price is not recent this function returns the latest available price.
     *
     * The returned price can be from arbitrarily far in the past; this function makes no guarantees that
     * the returned price is recent or useful for any particular application.
     *
     * Users of this function should check the `publishTime` in the price to ensure that the returned price is
     * sufficiently recent for their application. If you are considering using this function, it may be
     * safer / easier to use either `getEmaPrice` or `getEmaPriceNoOlderThan`.
     * @return price - please read the documentation of PythStructs.Price to understand how to use this safely.
     */
    function getEmaPriceUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view returns (PythStructs.Price[] memory price);

    /**
     * @notice Adds funds to a subscription's balance
     * @param subscriptionId The ID of the subscription
     */
    function addFunds(uint256 subscriptionId) external payable;

    /**
     * @notice Withdraws funds from a subscription's balance.
     * @dev A minimum balance must be maintained for active subscriptions. To withdraw past
     * the minimum balance limit, deactivate the subscription first.
     * @param subscriptionId The ID of the subscription
     * @param amount The amount to withdraw
     */
    function withdrawFunds(uint256 subscriptionId, uint256 amount) external;

    /**
     * @notice Returns the minimum balance an active subscription of a given size needs to hold.
     * @param numPriceFeeds The number of price feeds in the subscription.
     */
    function getMinimumBalance(
        uint8 numPriceFeeds
    ) external view returns (uint256 minimumBalance);

    /**
     * @notice Gets all active subscriptions with their parameters
     * @dev This function has no access control to allow keepers to discover active subscriptions
     * @param startIndex The starting index for pagination
     * @param maxResults The maximum number of results to return
     * @return subscriptionIds Array of active subscription IDs
     * @return subscriptionParams Array of subscription parameters for each active subscription
     * @return totalCount Total returned number of active subscriptions
     */
    function getActiveSubscriptions(
        uint256 startIndex,
        uint256 maxResults
    )
        external
        view
        returns (
            uint256[] memory subscriptionIds,
            SchedulerState.SubscriptionParams[] memory subscriptionParams,
            uint256 totalCount
        );
}
