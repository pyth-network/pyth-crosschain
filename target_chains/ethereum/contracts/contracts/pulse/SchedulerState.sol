// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract SchedulerState {
    /// Maximum number of price feeds per subscription
    uint8 public constant MAX_PRICE_IDS_PER_SUBSCRIPTION = 255;
    /// Maximum number of addresses in the reader whitelist
    uint8 public constant MAX_READER_WHITELIST_SIZE = 255;

    // TODO: make these updateable via governance
    /// Maximum time in the past (relative to current block timestamp)
    /// for which a price update timestamp is considered valid
    uint64 public constant PAST_TIMESTAMP_MAX_VALIDITY_PERIOD = 1 hours;
    /// Maximum time in the future (relative to current block timestamp)
    /// for which a price update timestamp is considered valid
    uint64 public constant FUTURE_TIMESTAMP_MAX_VALIDITY_PERIOD = 10 seconds;

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
        mapping(uint256 => SubscriptionParams) subscriptionParams;
        /// Sub ID -> subscription status (metadata about their sub)
        mapping(uint256 => SubscriptionStatus) subscriptionStatuses;
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

    struct SubscriptionParams {
        bytes32[] priceIds;
        address[] readerWhitelist;
        bool whitelistEnabled;
        bool isActive;
        bool isPermanent;
        UpdateCriteria updateCriteria;
    }

    struct SubscriptionStatus {
        uint256 priceLastUpdatedAt;
        uint256 balanceInWei;
        uint256 totalUpdates;
        uint256 totalSpent;
    }

    struct UpdateCriteria {
        bool updateOnHeartbeat;
        uint32 heartbeatSeconds;
        bool updateOnDeviation;
        uint32 deviationThresholdBps;
    }

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
