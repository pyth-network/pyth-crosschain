// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./SchedulerStructs.sol";

interface SchedulerEvents {
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed manager
    );
    event SubscriptionUpdated(uint256 indexed subscriptionId);
    event SubscriptionDeactivated(uint256 indexed subscriptionId);
    event SubscriptionActivated(uint256 indexed subscriptionId);
    event PricesUpdated(uint256 indexed subscriptionId, uint256 timestamp);
}
