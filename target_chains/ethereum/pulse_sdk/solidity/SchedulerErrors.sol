// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library SchedulerErrors {
    // Authorization errors
    /// 0x82b42900
    error Unauthorized();

    // Subscription state errors
    /// 0xe7262b66
    error InactiveSubscription();
    /// 0xf4d678b8
    error InsufficientBalance();
    /// 0xf6181305
    error CannotUpdatePermanentSubscription();

    // Price feed errors
    /// 0xae2eaaa9
    error InvalidPriceId(bytes32 providedPriceId, bytes32 expectedPriceId);
    /// 0xf14f93d1
    error InvalidPriceIdsLength(uint256 providedLength, uint256 expectedLength);
    /// 0x94ec8d9a
    error EmptyPriceIds();
    /// 0xb3d1acf6
    error TooManyPriceIds(uint256 provided, uint256 maximum);
    /// 0xe3509591
    error DuplicatePriceId(bytes32 priceId);
    /// 0xe56ccfaa
    error PriceSlotMismatch();

    // Update criteria errors
    /// 0xa7bcd3ae
    error InvalidUpdateCriteria();
    /// 0x7e8b0263
    error UpdateConditionsNotMet();
    /// 0x38fdebae
    error TimestampTooOld(
        uint256 providedUpdateTimestamp,
        uint256 currentTimestamp
    );
    /// 0x06daa54d
    error TimestampOlderThanLastUpdate(
        uint256 providedUpdateTimestamp,
        uint256 lastUpdatedAt
    );

    // Whitelist errors
    /// 0xbe4b60f7
    error TooManyWhitelistedReaders(uint256 provided, uint256 maximum);
    /// 0x9941ad5f
    error DuplicateWhitelistAddress(address addr);

    // Payment errors
    /// 0xec58cd53
    error KeeperPaymentFailed();
    /// 0x82fcf1e2
    error MaxDepositLimitExceeded();
}
