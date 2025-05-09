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

    /// @notice Combines two prices to get a cross-rate
    /// @param price1 The first price (a/b)
    /// @param price2 The second price (c/b)
    /// @return combinedPrice The combined price (a/c)
    /// @return expo The exponent of the combined price
    /// @dev This function will revert if either price is negative or if the exponents are invalid
    function combinePrices(
        int64 price1,
        int32 expo1,
        int64 price2,
        int32 expo2
    ) public pure returns (int64 combinedPrice, int32 expo) {
        if (price1 < 0 || price2 < 0 || expo1 > 0 || expo2 > 0 || expo1 < -255 || expo2 < -255) {
            revert();
        }

        // Convert both prices to the same decimal places (using the larger of the two)
        uint8 maxDecimals = uint8(uint32(-1 * (expo1 < expo2 ? expo1 : expo2)));
        uint256 p1 = convertToUint(price1, expo1, maxDecimals);
        uint256 p2 = convertToUint(price2, expo2, maxDecimals);

        // Calculate the combined price with precision
        uint256 combined = (p1 * 10**18) / p2;
        combined = combined / 10 ** (18 - maxDecimals);

        // Check if the combined price fits in int64
        if (combined > uint256(uint64(type(int64).max))) {
            revert();
        }

        return (int64(uint64(combined)), expo1 < expo2 ? expo1 : expo2);
    }
}
