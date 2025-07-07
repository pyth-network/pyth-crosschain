// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

// This contract holds the Scheduler structs
contract SchedulerConstants {
    /// Maximum number of price feeds per subscription
    uint8 public constant MAX_PRICE_IDS_PER_SUBSCRIPTION = 255;
    /// Maximum number of addresses in the reader whitelist
    uint8 public constant MAX_READER_WHITELIST_SIZE = 255;
    /// Maximum deposit limit for permanent subscriptions in wei
    uint256 public constant MAX_DEPOSIT_LIMIT = 100 ether;

    /// Maximum time in the past (relative to current block timestamp)
    /// for which a price update timestamp is considered valid
    /// when validating the update conditions.
    /// @dev Note: We don't use this when parsing update data from the Pyth contract
    /// because don't want to reject update data if it contains a price from a market
    /// that closed a few days ago, since it will contain a timestamp from the last
    /// trading period. We enforce this value ourselves against the maximum
    /// timestamp in the provided update data.
    uint64 public constant PAST_TIMESTAMP_MAX_VALIDITY_PERIOD = 1 hours;

    /// Maximum time in the future (relative to current block timestamp)
    /// for which a price update timestamp is considered valid
    uint64 public constant FUTURE_TIMESTAMP_MAX_VALIDITY_PERIOD = 10 seconds;
    /// Fixed gas overhead component used in keeper fee calculation.
    /// This is a rough estimate of the tx overhead for a keeper to call updatePriceFeeds.
    uint256 public constant GAS_OVERHEAD = 30000;
}
