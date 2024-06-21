// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythStructs.sol";

// Constants for working with pyth's number representation
int32 constant PD_EXPO = -9;
uint64 constant PD_SCALE = 1_000_000_000;
uint64 constant MAX_PD_V_U64 = (1 << 28) - 1;

library PriceCombine {
    function getPriceInQuote(PythStructs.Price memory self, PythStructs.Price memory quote, int32 resultExpo) public pure returns (PythStructs.Price memory) {
        PythStructs.Price memory result = div(self, quote);
        //return zero price so the error can be gracefully handeded by the caller
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

    function div(PythStructs.Price memory self, PythStructs.Price memory other) public pure returns (PythStructs.Price memory) {
        PythStructs.Price memory base = normalize(self);
        other = normalize(other);

        //if other.price == 0 then return zero
        if (other.price == 0) {
            return PythStructs.Price({
                price: 0,
                conf: 0,
                expo: 0,
                publishTime: 0
            });
        }

        // Convert prices to unsigned and sign
        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(other.price);

        // Compute the midprice
        uint64 midprice = basePrice * PD_SCALE / otherPrice;
        int32 midpriceExpo = base.expo - other.expo + PD_EXPO;

        // Compute the confidence interval
        uint64 otherConfidencePct = other.conf * PD_SCALE / otherPrice;
        uint128 conf = (base.conf * PD_SCALE / otherPrice) + (otherConfidencePct * midprice) / PD_SCALE;

        if (conf < type(uint64).max) {
            return PythStructs.Price(
                int64(int64(midprice) * baseSign * otherSign),
                uint64(conf),
                midpriceExpo,
                self.publishTime < other.publishTime ? self.publishTime : other.publishTime
            );
        } else {
            //return zero price so the error can be gracefully handeded by the caller
            return PythStructs.Price({
                price: 0,
                conf: 0,
                expo: 0,
                publishTime: 0
            });
        }
    }

    /// Get a copy of this struct where the price and confidence
    /// have been normalized to be between `MIN_PD_V_I64` and `MAX_PD_V_I64`.
    function normalize(PythStructs.Price memory self) public  pure returns (PythStructs.Price memory) {
        (uint64 price, int64 sign) = toUnsigned(self.price);
        uint64 conf = self.conf;
        int32 expo = self.expo;

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

    /// Scale this price/confidence so that its exponent is `target_expo`.
    ///
    /// Return `Zero` if this number is outside the range of numbers representable in `target_expo`,
    /// which will happen if `target_expo` is too small.
    ///
    /// Warning: if `target_expo` is significantly larger than the current exponent, this
    /// function will return 0 +- 0.
    function scaleToExponent(PythStructs.Price memory self, int32 targetExpo) public pure returns (PythStructs.Price memory) {
        int32 delta = targetExpo - self.expo;
        int64 price = self.price;
        uint64 conf = self.conf;
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

    /// Helper function to convert signed integers to unsigned and a sign bit, which simplifies
    /// some of the computations above.
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