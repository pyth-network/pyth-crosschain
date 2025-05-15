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

        int256 combinedExpo = int32(int8(targetDecimals)) + expo;

        if (combinedExpo > 0) {
            (bool success, uint256 result) = Math.tryMul(uint64(price), 10 ** uint(uint32(int32(combinedExpo))));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            return result;
        } else {
            (bool success, uint256 result) = Math.tryDiv(uint64(price), 10 ** uint(Math.abs(combinedExpo)));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            return result;
        }
    }

    /// @notice Combines two prices to get a cross-rate
    /// @param price1 The first price (a/b)
    /// @param expo1 The exponent of the first price
    /// @param price2 The second price (c/b)
    /// @param expo2 The exponent of the second price
    /// @param targetExpo The target exponent of the cross-rate
    /// @return crossRate The cross-rate (a/c)
    /// @dev This function will revert if either price is negative or if the exponents are invalid.
    /// @dev This function will also revert if the cross-rate is greater than int64.max
    /// @notice This function doesn't return the combined confidence interval.
    function deriveCrossRate(
        int64 price1,
        int32 expo1,
        int64 price2,
        int32 expo2,
        int32 targetExpo
    ) public pure returns (int64 crossRate) {
        // Check if the input prices are negative
        if (price1 < 0 || price2 < 0) {
            revert PythErrors.NegativeInputPrice();
        }
        // Check if the input exponents are valid and not less than -255
        if (expo1 > 0 || expo2 > 0 || expo1 < -255 || expo2 < -255) {
            revert PythErrors.InvalidInputExpo();
        }
        // Check if the target exponent is valid and not less than -255
        if (targetExpo > 0 || targetExpo < -255) {
            revert PythErrors.InvalidTargetExpo();
        }

        // Calculate the combined price with precision of 36
        uint256 fixedPointPrice = Math.mulDiv(uint64(price1), 10 ** PRECISION, uint64(price2));
        // TODO: Check for underflow
        int32 combinedExpo = expo1 - expo2 - int32(PRECISION);
        console.log("fixedPointPrice", fixedPointPrice);
        console.log("combinedExpo", combinedExpo);
        console.log("targetExpo", targetExpo);
        // Convert the price to the target exponent
        uint256 combined;
        if (combinedExpo >= targetExpo) {
            console.log("combinedExpo >= targetExpo");
            // If combinedExpo is greater than or equal to targetExpo, we need to multiply
            combined = fixedPointPrice * 10 ** uint32(combinedExpo + targetExpo);
        } else {
            console.log("combinedExpo - targetExpo", combinedExpo - targetExpo);            
            // If combinedExpo is less than targetExpo, we need to divide
            combined = fixedPointPrice / 10 ** uint32(targetExpo - combinedExpo);
        }

        console.log("combined", combined);

        // Check if the combined price fits in int64
        if (combined > uint256(uint64(type(int64).max))) {
            revert();
        }

        return int64(uint64(combined));
    }
}
