// PriceCombine.sol
// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythStructs.sol";

// Constants for working with Pyth's number representation
int32 constant PD_EXPO = -9;
uint64 constant PD_SCALE = 1_000_000_000;
uint64 constant MAX_PD_V_U64 = (1 << 28) - 1;

// Solidity Library to easily combine 2 Pyth Prices into 1 ( for example SOL:USD/ETH:USD=SOL/ETH). For Rust implementation, refer Pyth Rust SDK https://github.com/pyth-network/pyth-sdk-rs/blob/main/pyth-sdk/src/price.rs
// Based on the Rust implementation, the functions are defined within the `impl Price` block, and they are public methods of the `Price` struct and are as follows `get_price_in_quote`, `div`, `normalize`, `scale_to_exponent`
// Similarly the functions implemented in solidity are `public` and `pure` types.

library PriceCombine {
    /**
     * @notice Computes the price in quote currency.
     * @param self The price of the base currency.
     * @param quote The price of the quote currency.
     * @param resultExpo The exponent for the result.
     * @return The combined price in the quote currency.
     */
    function getPriceInQuote(PythStructs.Price memory self, PythStructs.Price memory quote, int32 resultExpo) public pure returns (PythStructs.Price memory) {
        PythStructs.Price memory result = div(self, quote);
        // Return zero price so the error can be gracefully handled by the caller
        if (result.price == 0 && result.conf == 0) {
            return PythStructs.Price({
                price: 0,
                conf: 0,
                expo: 0,
                publishTime: 0
            });
        }
        return scaleToExponent(result, resultExpo);
    }

    /**
     * @notice Divides the price of the base currency by the quote currency price.
     * @param self The price of the base currency.
     * @param other The price of the quote currency.
     * @return The combined price after division.
     */
    function div(PythStructs.Price memory self, PythStructs.Price memory other) public pure returns (PythStructs.Price memory) {
        PythStructs.Price memory base = normalize(self);
        other = normalize(other);

        // If the price of the quote currency is zero, return zero
        if (other.price == 0) {
            return PythStructs.Price({
                price: 0,
                conf: 0,
                expo: 0,
                publishTime: 0
            });
        }

        // Convert prices to unsigned integers and get their signs
        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(other.price);

        // Compute the midprice
        uint64 midprice = basePrice * PD_SCALE / otherPrice;
        int32 midpriceExpo = base.expo - other.expo + PD_EXPO;

        // Compute the confidence interval
        uint64 otherConfidencePct = other.conf * PD_SCALE / otherPrice;
        uint128 conf = (base.conf * PD_SCALE / otherPrice) + (otherConfidencePct * midprice) / PD_SCALE;

        // Check for overflow and return the result
        if (conf < type(uint64).max) {
            return PythStructs.Price(
                int64(int64(midprice) * baseSign * otherSign),
                uint64(conf),
                midpriceExpo,
                self.publishTime < other.publishTime ? self.publishTime : other.publishTime
            );
        } else {
            // Return zero price if there's an overflow
            return PythStructs.Price({
                price: 0,
                conf: 0,
                expo: 0,
                publishTime: 0
            });
        }
    }

    /**
     * @notice Normalizes the price and confidence to be within acceptable range.
     * @param self The price structure to normalize.
     * @return The normalized price structure.
     */
    function normalize(PythStructs.Price memory self) public pure returns (PythStructs.Price memory) {
        (uint64 price, int64 sign) = toUnsigned(self.price);
        uint64 conf = self.conf;
        int32 expo = self.expo;

        // Adjust the price and confidence if they are too large
        while (price > MAX_PD_V_U64 || conf > MAX_PD_V_U64) {
            price = price / 10;
            conf = conf / 10;
            expo = expo + 1;
        }

        return PythStructs.Price({
            price: int64(price) * sign,
            conf: conf,
            expo: expo,
            publishTime: self.publishTime
        });
    }

    /**
     * @notice Scales the price to the target exponent.
     * @param self The price structure to scale.
     * @param targetExpo The target exponent.
     * @return The scaled price structure.
     */
    function scaleToExponent(PythStructs.Price memory self, int32 targetExpo) public pure returns (PythStructs.Price memory) {
        int32 delta = targetExpo - self.expo;
        int64 price = self.price;
        uint64 conf = self.conf;

        // Adjust the price and confidence based on the exponent difference
        if (delta >= 0) {
            while (delta > 0 && (price != 0 || conf != 0)) {
                price = price / 10;
                conf = conf / 10;
                delta = delta - 1;
            }
            return PythStructs.Price({
                price: price,
                conf: conf,
                expo: targetExpo,
                publishTime: self.publishTime
            });
        } else {
            while (delta < 0) {
                price = price * 10;
                conf = conf * 10;
                delta = delta + 1;
            }
            return PythStructs.Price({
                price: price,
                conf: conf,
                expo: targetExpo,
                publishTime: self.publishTime
            });
        }
    }

    /**
     * @notice Converts a signed integer to an unsigned integer and a sign bit.
     * @param x here is the signed integer.
     * @return The unsigned integer and sign bit.
     */
    function toUnsigned(int64 x) public pure returns (uint64, int64) {
        if (x == type(int64).min) {
            return (uint64(type(int64).max) + 1, -1);
        } else if (x < 0) {
            return (uint64(-x), -1);
        } else {
            return (uint64(x), 1);
        }
    }
}
