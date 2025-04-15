// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract SchedulerState {
    /// Maximum number of price feeds per subscription
    uint8 public constant MAX_PRICE_IDS = 255;
    /// Default max gas multiplier
    uint32 public constant DEFAULT_MAX_GAS_MULTIPLIER_CAP_PCT = 10_000;
    /// Default max fee multiplier
    uint32 public constant DEFAULT_MAX_FEE_MULTIPLIER_CAP_PCT = 10_000;

    struct State {
        /// Monotonically increasing counter for subscription IDs
        uint256 subscriptionNumber;
        /// Pyth contract for parsing updates and verifying sigs & timestamps
        address pyth;
        /// Sub ID -> subscription parameters (which price feeds, when to update, etc)
        mapping(uint256 => SubscriptionParams) subscriptionParams;
        /// Sub ID -> subscription status (metadata about their sub)
        mapping(uint256 => SubscriptionStatus) subscriptionStatuses;
        /// Sub ID -> price ID -> latest parsed price update for the subscribed feed
        mapping(uint256 => mapping(bytes32 => PythStructs.PriceFeed)) priceUpdates;
        /// Sub ID -> manager address
        mapping(uint256 => address) subscriptionManager;
    }
    State internal _state;

    struct SubscriptionParams {
        bytes32[] priceIds;
        address[] readerWhitelist;
        bool whitelistEnabled;
        bool isActive;
        UpdateCriteria updateCriteria;
        GasConfig gasConfig;
    }

    struct SubscriptionStatus {
        uint256 priceLastUpdatedAt;
        uint256 balanceInWei;
        uint256 totalUpdates;
        uint256 totalSpent;
    }

    /// @dev When pushing prices, providers will use a "fast gas" estimation as default.
    /// If the gas is insufficient to land the transaction, the provider will linearly scale
    /// gas and fee multipliers until the transaction lands. These parameters allow the subscriber
    /// to impose limits on these multipliers.
    /// For example, with maxGasMultiplierCapPct = 10_000 (default), the provider can
    /// use a max of 100x (10000%) of the estimated gas as reported by the RPC.
    struct GasConfig {
        /// Gas price multiplier limit percent for update operations
        uint32 maxGasMultiplierCapPct;
        // Priority fee multiplier limit for update operations (EIP-1559)
        uint32 maxFeeMultiplierCapPct;
    }

    struct UpdateCriteria {
        bool updateOnHeartbeat;
        uint32 heartbeatSeconds;
        bool updateOnDeviation;
        uint32 deviationThresholdBps;
    }
}
