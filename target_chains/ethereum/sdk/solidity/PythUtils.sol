// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PythStructs.sol";

library PythUtils {
    /// @notice Converts a Pyth price to a uint256 with a target number of decimals
    /// @param price The Pyth price
    /// @param expo The Pyth price exponent
    /// @param targetDecimals The target number of decimals
    /// @return The price as a uint256
    /// @dev Function will lose precision if targetDecimals is less than the Pyth price decimals.
    /// This method will truncate any digits that cannot be represented by the targetDecimals.
    /// e.g. If the price is 0.000123 and the targetDecimals is 2, the result will be 0
    function convertToUint(
        int64 price,
        int32 expo,
        uint8 targetDecimals
    ) public pure returns (uint256) {
        if (price < 0 || expo > 0 || expo < -255) {
            revert();
        }

        uint8 priceDecimals = uint8(uint32(-1 * expo));

        if (targetDecimals >= priceDecimals) {
            return
                uint(uint64(price)) *
                10 ** uint32(targetDecimals - priceDecimals);
        } else {
            return
                uint(uint64(price)) /
                10 ** uint32(priceDecimals - targetDecimals);
        }
    }

    /// @notice Calculates TWAP from two price points
    /// @dev The calculation is done by taking the difference of cumulative values and dividing by the time difference
    /// @param priceId The price feed ID
    /// @param twapPriceInfoStart The starting price point
    /// @param twapPriceInfoEnd The ending price point
    /// @return twapPriceFeed The calculated TWAP price feed
    function calculateTwap(
        bytes32 priceId,
        PythStructs.TwapPriceInfo memory twapPriceInfoStart,
        PythStructs.TwapPriceInfo memory twapPriceInfoEnd
    ) public pure returns (PythStructs.TwapPriceFeed memory twapPriceFeed) {
        twapPriceFeed.id = priceId;
        twapPriceFeed.startTime = twapPriceInfoStart.publishTime;
        twapPriceFeed.endTime = twapPriceInfoEnd.publishTime;

        // Calculate differences between start and end points for slots and cumulative values
        uint64 slotDiff = twapPriceInfoEnd.publishSlot -
            twapPriceInfoStart.publishSlot;
        int128 priceDiff = twapPriceInfoEnd.cumulativePrice -
            twapPriceInfoStart.cumulativePrice;
        uint128 confDiff = twapPriceInfoEnd.cumulativeConf -
            twapPriceInfoStart.cumulativeConf;

        // Calculate time-weighted average price (TWAP) and confidence by dividing
        // the difference in cumulative values by the number of slots between data points
        int128 twapPrice = priceDiff / int128(uint128(slotDiff));
        uint128 twapConf = confDiff / uint128(slotDiff);

        // The conversion from int128 to int64 is safe because:
        // 1. Individual prices fit within int64 by protocol design
        // 2. TWAP is essentially an average price over time (cumulativePrice₂-cumulativePrice₁)/slotDiff
        // 3. This average must be within the range of individual prices that went into the calculation
        // We use int128 only as an intermediate type to safely handle cumulative sums
        twapPriceFeed.twap.price = int64(twapPrice);
        twapPriceFeed.twap.conf = uint64(twapConf);
        twapPriceFeed.twap.expo = twapPriceInfoStart.expo;
        twapPriceFeed.twap.publishTime = twapPriceInfoEnd.publishTime;

        // Calculate downSlotsRatio as a value between 0 and 1,000,000
        // 0 means no slots were missed, 1,000,000 means all slots were missed
        uint64 totalDownSlots = twapPriceInfoEnd.numDownSlots -
            twapPriceInfoStart.numDownSlots;
        uint64 downSlotsRatio = (totalDownSlots * 1_000_000) / slotDiff;

        // Safely downcast to uint32 (sufficient for value range 0-1,000,000)
        twapPriceFeed.downSlotsRatio = uint32(downSlotsRatio);

        return twapPriceFeed;
    }
}
