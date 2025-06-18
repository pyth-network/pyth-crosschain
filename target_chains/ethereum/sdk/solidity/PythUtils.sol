// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PythStructs.sol";
import "./PythErrors.sol";
import "./Math.sol";

library PythUtils {
    uint8 public constant PRECISION = 36;
    /// @notice Converts a Pyth price to a uint256 with a target number of decimals
    /// @param price The Pyth price
    /// @param expo The Pyth price exponent
    /// @param targetDecimals The target number of decimals
    /// @return The price as a uint256
    /// @dev Function will lose precision if targetDecimals is less than the Pyth price decimals.
    /// This method will truncate any digits that cannot be represented by the targetDecimals.
    /// e.g. If the price is 0.000123 and the targetDecimals is 2, the result will be 0
    /// This function will overflow if the combined exponent(targetDecimals + expo) is greater than 58 or less than -58.
    /// This function will also revert if prices combined with the targetDecimals are greater than 10 ** 58 or less than 10 ** -58.
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

        // If targetDecimals is 6, we want to multiply the final price by 10 ** -6
        // So the delta exponent is targetDecimals + currentExpo
        int32 deltaExponent = int32(uint32(targetDecimals)) + expo;

        // Bounds check: prevent overflow/underflow with base 10 exponentiation 
        // Calculation: 10 ** n <= (2 ** 256 - 63) - 1
        //              n <= log10((2 ** 193) - 1)
        //              n <= 58.2
        if (deltaExponent > 58 || deltaExponent < -58) revert PythErrors.ExponentOverflow();

        // We can safely cast the price to uint256 because the above condition will revert if the price is negative
        uint256 unsignedPrice = uint256(uint64(price)); 

        if (deltaExponent > 0) {
            (bool success, uint256 result) = Math.tryMul(unsignedPrice, 10 ** uint32(deltaExponent));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            return result;
        } else {
            (bool success, uint256 result) = Math.tryDiv(unsignedPrice, 10 ** uint(Math.abs(deltaExponent)));
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
    /// @param targetExpo The target number of decimals for the cross-rate
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
    ) public pure returns (int256 crossRate) {
        // Check if the input prices are negative
        if (price1 < 0 || price2 < 0) {
            revert PythErrors.NegativeInputPrice();
        }
        // Check if the input exponents are valid and not less than -255
        if (expo1 < -255 || expo2 < -255) {
            revert PythErrors.InvalidInputExpo();
        }

        // We can safely cast the prices to uint64 because we know they are positive
        uint256 fixedPointPrice = Math.mulDiv(uint64(price1), 10 ** PRECISION, uint64(price2));
        int32 combinedExpo = expo1 - expo2 - int32(int8(PRECISION));

        int32 factoredExpo = combinedExpo - targetExpo;

        if (factoredExpo > 77 || factoredExpo < -77) revert PythErrors.ExponentOverflow();
        // Convert the price to the target exponent
        // We can't use the convertToUint function because it accepts int64 and we need to use uint256
        // It makes more sense to ask users for exponent and not decimals here.
        if (factoredExpo > 0) {
            // If combinedExpo is greater than targetExpo, we need to multiply
            (bool success, uint256 result) = Math.tryMul(fixedPointPrice, 10 ** uint32(factoredExpo));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            fixedPointPrice = result;
        } else if (factoredExpo < 0) {
            // If combinedExpo is less than targetExpo, we need to divide
            (bool success, uint256 result) = Math.tryDiv(fixedPointPrice, 10 ** uint32(Math.abs(factoredExpo)));
            if (!success) {
                revert PythErrors.CombinedPriceOverflow();
            }
            fixedPointPrice = result;
        }

        // Check if the combined price fits in int256
        if (fixedPointPrice > uint256((type(int256).max))) {
            revert PythErrors.CombinedPriceOverflow();
        }

        return int256(fixedPointPrice);
    }
}
