// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract SchedulerState {
    // Maximum number of price feeds per subscription
    uint8 public constant MAX_PRICE_IDS = 10;

    struct State {
        // Monotonically increasing counter for subscription IDs
        uint256 subscriptionNumber;
        // Pyth contract for parsing updates and verifying sigs & timestamps
        address pyth;
        // Sub ID -> subscription parameters (which price feeds, when to update, etc)
        mapping(uint256 => SubscriptionParams) subscriptionParams;
        // Sub ID -> subscription status (metadata about their sub)
        mapping(uint256 => SubscriptionStatus) subscriptionStatuses;
        // Sub ID -> price ID -> latest parsed price update for the subscribed feed
        mapping(uint256 => mapping(bytes32 => PythStructs.PriceFeed)) priceUpdates;
        // Sub ID -> manager address
        mapping(uint256 => address) subscriptionManager;
    }
    State internal _state;

    struct SubscriptionParams {
        bytes32[] priceIds;
        address[] readerWhitelist;
        bool useWhitelist;
        UpdateCriteria updateCriteria;
        GasConfig gasConfig;
    }

    struct SubscriptionStatus {
        uint64 priceLastUpdatedAt;
        uint256 balanceInWei;
        uint256 totalUpdates;
        uint256 totalSpent;
        bool isActive;
    }

    struct GasConfig {
        // Gas price limit to prevent runaway costs in high-gas environments
        uint256 maxGasPrice;
        // Gas limit for update operations
        uint256 maxGasLimit;
    }

    struct UpdateCriteria {
        bool updateOnHeartbeat;
        uint32 heartbeatSeconds;
        bool updateOnDeviation;
        uint32 deviationThresholdBps;
    }
}
