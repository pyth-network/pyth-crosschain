// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PythStructs.sol";
import "./PythErrors.sol";
import "./Math.sol";
import "forge-std/console.sol";

library PythUtils {

    uint32 internal constant PRECISION = 36;
    /// @notice Converts a Pyth price to a uint256 with a target number of decimals
    /// @param price The Pyth price
    /// @param expo The Pyth price exponent
    /// @param targetDecimals The target number of decimals
    /// @return The price as a uint256
    /// @dev Function will lose precision if targetDecimals is less than the Pyth price decimals.
    /// This method will truncate any digits that cannot be represented by the targetDecimals.
    /// e.g. If the price is 0.000123 and the targetDecimals is 2, the result will be 0
    /// This function will overflow if the combined exponent(targetDecimals + expo) is greater than 77 or less than -77.
    /// This function will also revert if prices combined with the targetDecimals are greater than 10 ** 77 or less than 10 ** -77.
    function convertToUint(
        int64 price,
        int32 expo,
        uint8 targetDecimals
    ) public pure returns (uint256) {
        if (price < 0) {
            revert PythErrors.NegativeInputPrice();
        }
        if (expo < -255) {
            revert PythErrors.InvalidInputExpo();
        }
        // Compute the combined exponent as an int256 for safety
        int256 combinedExpo = int256(uint256(targetDecimals)) + int256(expo);

        // Bounds check: prevent overflow/underflow with base 10 exponentiation
        // Calculation: 10 ** n <= (2 ** 256) - 1
        //              n <= log10((2 ** 256) - 1)
        //              n <= 77.2
        if (combinedExpo > 77 || combinedExpo < -77) revert PythErrors.ExponentOverflow();

        // price is int64, always >= 0 here
        uint256 unsignedPrice = uint256(uint64(price)); 

        if (combinedExpo > 0) {
            (bool success, uint256 result) = Math.tryMul(unsignedPrice, 10 ** uint(combinedExpo));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            return result;
        } else {
            (bool success, uint256 result) = Math.tryDiv(unsignedPrice, 10 ** uint(Math.abs(combinedExpo)));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            return result;
        }
    }

    // /// @notice Combines two prices to get a cross-rate
    // /// @param price1 The first price (a/b)
    // /// @param expo1 The exponent of the first price
    // /// @param price2 The second price (c/b)
    // /// @param expo2 The exponent of the second price
    // /// @param targetDecimals The target number of decimals for the cross-rate
    // /// @return crossRate The cross-rate (a/c)
    // /// @dev This function will revert if either price is negative or if the exponents are invalid.
    // /// @dev This function will also revert if the cross-rate is greater than int64.max
    // /// @notice This function doesn't return the combined confidence interval.
    // function deriveCrossRate(
    //     int64 price1,
    //     int32 expo1,
    //     int64 price2,
    //     int32 expo2,
    //     uint8 targetExpo
    // ) public pure returns (int64 crossRate) {
    //     // Check if the input prices are negative
    //     if (price1 < 0 || price2 < 0) {
    //         revert PythErrors.NegativeInputPrice();
    //     }
    //     // Check if the input exponents are valid and not less than -255
    //     if (expo1 > 0 || expo2 > 0 || expo1 < -255 || expo2 < -255) {
    //         revert PythErrors.InvalidInputExpo();
    //     }

    //     // Calculate the combined price with precision of 36
    //     uint256 fixedPointPrice = Math.mulDiv(uint64(price1), 10 ** PRECISION, uint64(price2));
    //     int32 combinedExpo = expo1 - expo2 - int32(PRECISION);

    //     console.log("PythUtils.deriveCrossRate: fixedPointPrice", fixedPointPrice);
    //     console.log("PythUtils.deriveCrossRate: combinedExpo", combinedExpo);

    //     // uint256 crossRateUnchecked = convertToUint(fixedPointPrice, combinedExpo, targetDecimals);



    //     // Convert the price to the target exponent
    //     // We can't use the convertToUint function because it accepts int64 and we need to use uint256
    //     uint256 fixedPointPrice;
    //     if (combinedExpo >= targetExpo) {
    //         console.log("combinedExpo >= targetExpo");
    //         // If combinedExpo is greater than or equal to targetExpo, we need to multiply
    //         fixedPointPrice = fixedPointPrice * 10 ** uint32(combinedExpo + targetExpo);
    //     } else {
    //         console.log("combinedExpo - targetExpo", combinedExpo - targetExpo);            
    //         // If combinedExpo is less than targetExpo, we need to divide
    //         fixedPointPrice = fixedPointPrice / 10 ** uint32(targetExpo - combinedExpo);
    //     }

    //     console.log("PythUtils.deriveCrossRate: crossRateUnchecked", fixedPointPrice);

    //     // Check if the combined price fits in int64
    //     if (fixedPointPrice > uint256(uint64(type(int64).max))) {
    //         revert PythErrors.CombinedPriceOverflow();
    //     }

    //     return int64(uint64(fixedPointPrice));
    // }
}
