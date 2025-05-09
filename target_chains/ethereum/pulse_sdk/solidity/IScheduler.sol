// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./SchedulerEvents.sol";
import "./SchedulerStructs.sol";

interface IScheduler is SchedulerEvents {
    /// @notice Creates a new subscription
    /// @dev Requires msg.value to be at least the minimum balance for the subscription (calculated by getMinimumBalance()).
    /// @param subscriptionParams The parameters for the subscription
    /// @return subscriptionId The ID of the newly created subscription
    function createSubscription(
        SchedulerStructs.SubscriptionParams calldata subscriptionParams
    ) external payable returns (uint256 subscriptionId);

    /// @notice Gets a subscription's parameters and status
    /// @param subscriptionId The ID of the subscription
    /// @return params The subscription parameters
    /// @return status The subscription status
    function getSubscription(
        uint256 subscriptionId
    )
        external
        view
        returns (
            SchedulerStructs.SubscriptionParams memory params,
            SchedulerStructs.SubscriptionStatus memory status
        );

    /// @notice Updates an existing subscription
    /// @dev You can activate or deactivate a subscription by setting isActive to true or false. Reactivating a subscription
    ///      requires the subscription to hold at least the minimum balance (calculated by getMinimumBalance()).
    /// @dev Any Ether sent with this call (`msg.value`) will be added to the subscription's balance before processing the update.
    /// @param subscriptionId The ID of the subscription to update
    /// @param newSubscriptionParams The new parameters for the subscription
    function updateSubscription(
        uint256 subscriptionId,
        SchedulerStructs.SubscriptionParams calldata newSubscriptionParams
    ) external payable;

    /// @notice Updates price feeds for a subscription.
    /// @dev The updateData must contain all price feeds for the subscription, not a subset or superset.
    /// @dev Internally, the updateData is verified using the Pyth contract and validates update conditions.
    ///      The call will only succeed if the update conditions for the subscription are met.
    /// @param subscriptionId The ID of the subscription
    /// @param updateData The price update data from Pyth
    function updatePriceFeeds(
        uint256 subscriptionId,
        bytes[] calldata updateData
    ) external;

    /// @notice Returns the price of a price feed without any sanity checks.
    /// @dev This function returns the most recent price update in this contract without any recency checks.
    /// This function is unsafe as the returned price update may be arbitrarily far in the past.
    ///
    /// Users of this function should check the `publishTime` in the price to ensure that the returned price is
    /// sufficiently recent for their application. If you are considering using this function, it may be
    /// safer / easier to use `getPricesNoOlderThan`.
    /// @return prices - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getPricesUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view returns (PythStructs.Price[] memory prices);

    /// @notice Returns the price that is no older than `age` seconds of the current time.
    /// @dev This function is a sanity-checked version of `getPriceUnsafe` which is useful in
    /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
    /// recently.
    /// @return prices - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getPricesNoOlderThan(
        uint256 subscriptionId,
        bytes32[] calldata priceIds,
        uint256 age
    ) external view returns (PythStructs.Price[] memory prices);

    /// @notice Returns the exponentially-weighted moving average price of a price feed without any sanity checks.
    /// @dev This function returns the same price as `getEmaPrice` in the case where the price is available.
    /// However, if the price is not recent this function returns the latest available price.
    ///
    /// The returned price can be from arbitrarily far in the past; this function makes no guarantees that
    /// the returned price is recent or useful for any particular application.
    ///
    /// Users of this function should check the `publishTime` in the price to ensure that the returned price is
    /// sufficiently recent for their application. If you are considering using this function, it may be
    /// safer / easier to use either `getEmaPrice` or `getEmaPriceNoOlderThan`.
    /// @return prices - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getEmaPricesUnsafe(
        uint256 subscriptionId,
        bytes32[] calldata priceIds
    ) external view returns (PythStructs.Price[] memory prices);

    /// @notice Returns the exponentially-weighted moving average price that is no older than `age_seconds` seconds
    /// of the current time.
    /// @dev This function is a sanity-checked version of `getEmaPricesUnsafe` which is useful in
    /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
    /// recently.
    /// @return prices - please read the documentation of PythStructs.Price to understand how to use this safely.
    function getEmaPricesNoOlderThan(
        uint256 subscriptionId,
        bytes32[] calldata priceIds,
        uint256 age_seconds
    ) external view returns (PythStructs.Price[] memory prices);

    /// @notice Adds funds to a subscription's balance
    /// @param subscriptionId The ID of the subscription
    function addFunds(uint256 subscriptionId) external payable;

    /// @notice Withdraws funds from a subscription's balance.
    /// @dev A minimum balance must be maintained for active subscriptions. To withdraw past
    /// the minimum balance limit, deactivate the subscription first.
    /// @param subscriptionId The ID of the subscription
    /// @param amount The amount to withdraw
    function withdrawFunds(uint256 subscriptionId, uint256 amount) external;

    /// @notice Returns the minimum balance an active subscription of a given size needs to hold.
    /// @param numPriceFeeds The number of price feeds in the subscription.
    function getMinimumBalance(
        uint8 numPriceFeeds
    ) external view returns (uint256 minimumBalanceInWei);

    /// @notice Gets all active subscriptions with their parameters, paginated.
    /// @dev This function has no access control to allow keepers to discover active subscriptions.
    /// @dev Note that the order of subscription IDs returned may not be sequential and can change
    ///      when subscriptions are deactivated or reactivated.
    /// @param startIndex The starting index within the list of active subscriptions (NOT the subscription ID).
    /// @param maxResults The maximum number of results to return starting from startIndex.
    /// @return subscriptionIds Array of active subscription IDs
    /// @return subscriptionParams Array of subscription parameters for each active subscription
    /// @return totalCount Total number of active subscriptions
    function getActiveSubscriptions(
        uint256 startIndex,
        uint256 maxResults
    )
        external
        view
        returns (
            uint256[] memory subscriptionIds,
            SchedulerStructs.SubscriptionParams[] memory subscriptionParams,
            uint256 totalCount
        );
}
