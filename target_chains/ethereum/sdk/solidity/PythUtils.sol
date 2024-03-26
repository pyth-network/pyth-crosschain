
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

library PythUtils {
    
    /// @notice Converts a Pyth price to a uint256 with a target number of decimals
    /// @param price The Pyth price 
    /// @param expo The Pyth price exponent
    /// @param targetDecimals The target number of decimals
    /// @return The price as a uint256
    function convertToUint(
        int64 price,
        int32 expo,
        uint8 targetDecimals
    ) private pure returns (uint256) {
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
}