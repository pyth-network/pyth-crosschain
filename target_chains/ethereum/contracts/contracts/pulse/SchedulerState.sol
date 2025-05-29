// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerStructs.sol";

contract SchedulerState {
    struct State {
        /// Monotonically increasing counter for subscription IDs
        uint256 subscriptionNumber;
        /// Pyth contract for parsing updates and verifying sigs & timestamps
        address pyth;
        /// Admin address for governance actions
        address admin;
        // proposedAdmin is the new admin's account address proposed by either the owner or the current admin.
        // If there is no pending transfer request, this value will hold `address(0)`.
        address proposedAdmin;
        /// Fee in wei charged to subscribers per single update triggered by a keeper
        uint128 singleUpdateKeeperFeeInWei;
        /// Minimum balance required per price feed in a subscription
        uint128 minimumBalancePerFeed;
        /// Sub ID -> subscription parameters (which price feeds, when to update, etc)
        mapping(uint256 => SchedulerStructs.SubscriptionParams) subscriptionParams;
        /// Sub ID -> subscription status (metadata about their sub)
        mapping(uint256 => SchedulerStructs.SubscriptionStatus) subscriptionStatuses;
        /// Sub ID -> price ID -> latest parsed price update for the subscribed feed
        mapping(uint256 => mapping(bytes32 => PythStructs.PriceFeed)) priceUpdates;
        /// Sub ID -> manager address
        mapping(uint256 => address) subscriptionManager;
        /// Array of active subscription IDs.
        /// Gas optimization to avoid scanning through all subscriptions when querying for all active ones.
        uint256[] activeSubscriptionIds;
        /// Sub ID -> index in activeSubscriptionIds array + 1 (0 means not in array).
        /// This lets us avoid a linear scan of `activeSubscriptionIds` when deactivating a subscription.
        mapping(uint256 => uint256) activeSubscriptionIndex;
    }
    State internal _state;

    /**
     * @dev Returns the minimum balance required per feed in a subscription.
     */
    function getMinimumBalancePerFeed() external view returns (uint128) {
        return _state.minimumBalancePerFeed;
    }

    /**
     * @dev Returns the fee in wei charged to subscribers per single update triggered by a keeper.
     */
    function getSingleUpdateKeeperFeeInWei() external view returns (uint128) {
        return _state.singleUpdateKeeperFeeInWei;
    }
}
