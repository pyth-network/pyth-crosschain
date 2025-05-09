// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library SchedulerErrors {
    // Authorization errors
    error Unauthorized();

    // Subscription state errors
    error InactiveSubscription();
    error InsufficientBalance();
    error CannotUpdatePermanentSubscription();

    // Price feed errors
    error InvalidPriceId(bytes32 providedPriceId, bytes32 expectedPriceId);
    error InvalidPriceIdsLength(uint256 providedLength, uint256 expectedLength);
    error EmptyPriceIds();
    error TooManyPriceIds(uint256 provided, uint256 maximum);
    error DuplicatePriceId(bytes32 priceId);
    error PriceSlotMismatch();

    // Update criteria errors
    error InvalidUpdateCriteria();
    error UpdateConditionsNotMet();
    error TimestampTooOld(
        uint256 providedUpdateTimestamp,
        uint256 currentTimestamp
    );
    error TimestampOlderThanLastUpdate(
        uint256 providedUpdateTimestamp,
        uint256 lastUpdatedAt
    );

    // Whitelist errors
    error TooManyWhitelistedReaders(uint256 provided, uint256 maximum);
    error DuplicateWhitelistAddress(address addr);

    // Payment errors
    error KeeperPaymentFailed();
}
