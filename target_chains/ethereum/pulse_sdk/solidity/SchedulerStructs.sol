// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

contract SchedulerStructs {
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
}
