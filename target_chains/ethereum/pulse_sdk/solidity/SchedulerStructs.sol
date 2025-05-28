// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

/// @title SchedulerStructs
/// @notice Contains data structures used by the Pyth Pulse protocol
contract SchedulerStructs {
    /// @notice Parameters defining a Pulse subscription
    struct SubscriptionParams {
        bytes32[] priceIds; // Array of Pyth price feed IDs to subscribe to
        address[] readerWhitelist; // Optional array of addresses allowed to read prices
        bool whitelistEnabled; // Whether to enforce whitelist or allow anyone to read
        bool isActive; // Whether the subscription is active
        bool isPermanent; // Whether the subscription can be updated
        UpdateCriteria updateCriteria; // When to update the price feeds
    }

    /// @notice Status information for a Pulse subscription
    struct SubscriptionStatus {
        uint256 priceLastUpdatedAt; // Timestamp of the last update. All feeds in the subscription are updated together.
        uint256 balanceInWei; // Balance that will be used to fund the subscription's upkeep.
        uint256 totalUpdates; // Tracks update count across all feeds in the subscription (increments by number of feeds per update)
        uint256 totalSpent; // Counter of total fees paid for subscription upkeep in wei.
    }

    /// @notice Criteria for when price feeds should be updated
    struct UpdateCriteria {
        bool updateOnHeartbeat; // Should update based on time elapsed
        uint32 heartbeatSeconds; // Time interval for heartbeat updates
        bool updateOnDeviation; // Should update based on price deviation
        uint32 deviationThresholdBps; // Price deviation threshold in basis points
    }
}
