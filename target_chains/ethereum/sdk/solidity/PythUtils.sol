// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PythStructs.sol";
import "forge-std/console.sol";
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
        PythStructs.Price memory price1,
        PythStructs.Price memory price2
    ) public pure returns (int64 combinedPrice, int32 expo) {
        if (price1.price < 0 || price2.price < 0 || price1.expo > 0 || price2.expo > 0 || price1.expo < -255 || price2.expo < -255) {
            revert();
        }

        uint8 p1Decimals = uint8(uint32(-1 * price1.expo));
        uint8 p2Decimals = uint8(uint32(-1 * price2.expo));

        uint256 p1;
        uint256 p2;

        if (p1Decimals >= p2Decimals) {
            p2 = convertToUint(price2.price, price2.expo, p1Decimals);
            p1 = uint256(uint64(price1.price));
        } else {
            p1 = convertToUint(price1.price, price1.expo, p2Decimals);
            p2 = uint256(uint64(price2.price));
        }


        console.log("p1", p1);
        console.log("p2", p2);

        // Calculate the combined price
        uint256 combined = (p1 * 10**18) / p2;  // Multiply by 10^18 to maintain precision
        console.log("combined", combined);
        // Calculate the new exponent
        combined = combined / 10 ** (18 - p1Decimals);
        console.log("newExpo", p1Decimals);
        // Check if the combined price fits in int64
        if (combined > uint256(uint64(type(int64).max))) {
            revert();
        }

        return (int64(uint64(combined)), price1.expo);
    }
}
