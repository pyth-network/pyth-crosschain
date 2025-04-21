// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

error InactiveSubscription();
error InsufficientBalance();
error Unauthorized();
error InvalidPriceId(bytes32 providedPriceId, bytes32 expectedPriceId);
error InvalidPriceIdsLength(bytes32 providedLength, bytes32 expectedLength);
error InvalidUpdateCriteria();
error InvalidGasConfig();
error PriceSlotMismatch();
error TooManyPriceIds(uint256 provided, uint256 maximum);
error UpdateConditionsNotMet();
error IllegalPermanentSubscriptionModification();
error TimestampOlderThanLastUpdate(
    uint256 providedUpdateTimestamp,
    uint256 lastUpdatedAt
);
