// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/// @title IPythEvents contains the events that Pyth contract emits.
/// @dev This interface can be used for listening to the updates for off-chain and testing purposes.
interface IPythEvents {
    /// @dev Emitted when the price feed with `id` has received a fresh update.
    /// @param id The Pyth Price Feed ID.
    /// @param publishTime Publish time of the given price update.
    /// @param price Price of the given price update.
    /// @param conf Confidence interval of the given price update.
    event PriceFeedUpdate(
        bytes32 indexed id,
        uint64 publishTime,
        int64 price,
        uint64 conf
    );

    /// @dev Emitted when the TWAP price feed with `id` has received a fresh update.
    /// @param id The Pyth Price Feed ID.
    /// @param startTime Start time of the TWAP.
    /// @param endTime End time of the TWAP.
    /// @param twapPrice Price of the TWAP.
    /// @param twapConf Confidence interval of the TWAP.
    /// @param downSlotsRatio Down slot ratio of the TWAP.
    event TwapPriceFeedUpdate(
        bytes32 indexed id,
        uint64 startTime,
        uint64 endTime,
        int64 twapPrice,
        uint64 twapConf,
        uint32 downSlotsRatio
    );
}
