// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PythStructs} from "./PythStructs.sol";

/**
 * @title PythPriceCombinationLibrary
 * @dev A library for combining Pyth prices using mathematical operations.
 */

library CombinePythPrice {
    /////////////////////
    //     Errors      //
    /////////////////////

    error DivisionByZero();
    error ExceedingComputationalRange();
    error AddingPricesOfDifferentExponents(int32 expo1, int32 expo2);
    error MathErrorWhileScaling();

    // Constants for working with Pyth's number representation
    uint64 private constant MAX_PD_V_U64 = (1 << 28) - 1;
    uint64 private constant PD_SCALE = 1_000_000_000;
    int32 private constant PD_EXPO = -9;

    /**
     *
     * @param p1 Price 1
     * @param p2 Price 2
     * @return result of the addition of the prices
     * @dev Function to add two pyth price when the exponents are same.
     */
    function addPrices(
        PythStructs.Price memory p1,
        PythStructs.Price memory p2
    ) internal pure returns (PythStructs.Price memory result) {
        int64 _price;
        uint64 _conf;

        if (p1.expo != p2.expo) {
            revert AddingPricesOfDifferentExponents(p1.expo, p2.expo);
        } else {
            _price = p1.price + p2.price;
            _conf = p1.conf + p2.conf;

            return
                PythStructs.Price({
                    price: _price,
                    conf: _conf,
                    expo: p1.expo,
                    publishTime: min(p1.publishTime, p2.publishTime)
                });
        }
    }

    /**
     *
     * @param p1 Price 1
     * @param p2 Price 2
     * @param expo Exponent value to which the price should be transformed to.
     * @return result of the addition of the prices
     * @dev Function to convert the price and confindence interval to the required exponent and then add the two pyth prices.
     */
    function addPriceToScaled(
        PythStructs.Price memory p1,
        PythStructs.Price memory p2,
        int32 expo
    ) internal pure returns (PythStructs.Price memory result) {
        PythStructs.Price memory _p1 = p1.expo != expo
            ? scaleToExponent(p1, expo)
            : p1;
        PythStructs.Price memory _p2 = p2.expo != expo
            ? scaleToExponent(p2, expo)
            : p2;

        return addPrices(_p1, _p2);
    }

    /**
     *
     * @param self Price 1
     * @param other Price 2
     * @return result of the addition of the prices
     * @dev Convert the price and confidence interval of Price 2 to the exponent of Price 1 and adds the two prices.
     */
    function convertAndAddPrices(
        PythStructs.Price memory self,
        PythStructs.Price memory other
    ) internal pure returns (PythStructs.Price memory result) {
        if (self.expo != other.expo) {
            PythStructs.Price memory scaledP2 = scaleToExponent(
                other,
                self.expo
            );
            return addPrices(self, scaledP2);
        } else {
            return addPrices(self, other);
        }
    }

    /**
     *
     * @param self Price
     * @param quote Price
     * @param targetExpo Exponent of the result.
     * @return result Returns the current price in a different quote currency.
     * @dev  Get the current price of this account in a different quote currency.
     * If this account represents the price of the product X/Z, and `quote` represents the price  of the product Y/Z, this method returns the price of X/Y. Use this method to get the price of e.g., mSOL/SOL from the mSOL/USD and SOL/USD accounts
     */
    function getPriceInQuote(
        PythStructs.Price memory self,
        PythStructs.Price memory quote,
        int32 targetExpo
    ) public pure returns (PythStructs.Price memory result) {
        PythStructs.Price memory divPrice = div(self, quote);

        if (divPrice.price != 0) {
            return scaleToExponent(divPrice, targetExpo);
        }
    }

    /**
     * @param self The price to be divided
     * @param other The price to divide by
     * @return result The resulting price after division
     * @dev Divide `se;f` price by `other` while propagating the uncertainty in both prices into the result.
     * This method will automatically select a reasonable exponent for the result. If both `self` and `other` are normalized, the
     * exponent is `self.expo + PD_EXPO - other.expo` (i.e., the fraction has `PD_EXPO` digits of additional precision). If they are not
     * normalized, this method will normalize them, resulting in an unpredictable result exponent. If the result is used in a context
     * that requires a specific exponent, please call `scale_to_exponent` on it.
     */
    function div(
        PythStructs.Price memory self,
        PythStructs.Price memory other
    ) public pure returns (PythStructs.Price memory result) {
        //Return zero price struct on denominator being 0
        if (other.price == 0) {
            revert DivisionByZero();
        }

        /// Price is not guaranteed to store its price/confidence in normalized form.
        /// Normalize them here to bound the range of price/conf, which is required to perform arithmetic operations.
        PythStructs.Price memory base = normalize(self);
        PythStructs.Price memory _other = normalize(other);

        //Converting to unsigned.
        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 _otherPrice, int64 _otherSign) = toUnsigned(_other.price);

        // Compute the midprice, base in terms of other.
        uint64 midPrice = ((basePrice * PD_SCALE) / _otherPrice);
        int32 midPriceExpo = ((base.expo - _other.expo) + PD_EXPO);

        /// Compute the confidence interval.
        ///
        /// This code uses the 1-norm instead of the 2-norm for computational reasons.
        /// Let p +- a and q +- b be the two arguments to this method.
        /// The correct formula is p/q * sqrt( (a/p)^2 + (b/q)^2 ).
        /// This quantity is difficult to compute due to the sqrt and overflow/underflow considerations.
        ///
        /// This code instead computes p/q * (a/p + b/q) = a/q + pb/q^2 .
        /// This quantity is at most a factor of sqrt(2) greater than the correct result, which shouldn't matter considering that confidence intervals are typically ~0.1% of the price.

        /// This uses 57 bits and has an exponent of PD_EXPO.
        uint64 otherConfPct = ((_other.conf * PD_SCALE) / _otherPrice);

        /// first term is 57 bits, second term is 57 + 58 - 29 = 86 bits. Same exponent as the midprice.
        uint128 conf = uint128((base.conf * PD_SCALE) / _otherPrice) +
            (uint128(otherConfPct) * uint128(midPrice)) /
            uint128(PD_SCALE);

        if (conf < type(uint64).max) {
            return
                PythStructs.Price({
                    price: int64(midPrice) * baseSign * _otherSign,
                    conf: uint64(conf),
                    expo: midPriceExpo,
                    publishTime: min(self.publishTime, _other.publishTime)
                });
        } else {
            revert ExceedingComputationalRange();
        }
    }

    /**
     *
     * @param a Unixtimestamp A
     * @param b Unixtimestamp B
     * @dev Helper function to find the minimum of two Unix timestamps
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     *
     * @param price Input the price value that needs to be Normalized
     * @dev Return the price struct after normalizing the price and confidence interval between the values of MAX_PD_V_I64 and MIN_PD_V_I64.
     * MAX_PD_V_I64 = int64(MAX_PD_V_U64) i.e int64((1 << 28) - 1)
     * MIN_PD_V_I64 = -MAX_PD_V_I64
     */
    function normalize(
        PythStructs.Price memory price
    ) internal pure returns (PythStructs.Price memory result) {
        (uint64 p, int64 _s) = toUnsigned(price.price);
        uint64 c = price.conf;
        int32 e = price.expo;

        ///Revert transaction incase `p` or `c` is zero leading to division by zero error.
        if (p == 0 || c == 0) {
            revert DivisionByZero();
        }

        // Scaling down if `p` and `c` are above MAX_PD_U64
        while (p > MAX_PD_V_U64 || c > MAX_PD_V_U64) {
            p /= 10;
            c /= 10;
            e += 1;
            ///Returns 0 incase of `p` or `c` becomes 0 during normalization.
            if (p == 0 || c == 0) {
                revert DivisionByZero();
            }
        }

        int64 signedPrice = int64(p) * _s;
        return
            PythStructs.Price({
                price: signedPrice,
                conf: c,
                expo: e,
                publishTime: price.publishTime
            });
    }

    /**
     *
     * @param x Price value that needs to convert to be unsigned integer
     * @return abs value of x
     * @return sign of x
     * @dev returns the unsigned value and the sign of the signed integer provided in the argument.
     */
    function toUnsigned(int64 x) internal pure returns (uint64, int64) {
        if (x == type(int64).min) {
            //Edge case
            return (uint64(type(int64).max) + 1, -1);
        } else if (x < 0) {
            return (uint64(-x), -1);
        } else {
            return (uint64(x), 1);
        }
    }

    /**
     *
     * @param self The price struct that needs to be scaled to the required exponent
     * @param targetExpo The target exponent that the price needs to be scaled to
     * @dev returns the price after scaling the it to the target exponent.
     */
    function scaleToExponent(
        PythStructs.Price memory self,
        int32 targetExpo
    ) internal pure returns (PythStructs.Price memory result) {
        int256 delta = targetExpo - self.expo;
        int64 p = self.price;
        uint64 c = self.conf;

        if (delta >= 0) {
            while (delta > 0 && (p != 0 || c != 0)) {
                p = p / 10;
                c = c / 10;
                delta--;
            }
        } else {
            while (delta < 0) {
                /// Following checks for p:
                ///1. Overflow
                ///2. Underflow
                ///3. Division by 0
                ///4. min of int64 when multiplied by 10 causes underflow
                if (
                    p > type(int64).max / 10 ||
                    p < type(int64).min / 10 ||
                    (p == type(int64).min && p % 10 != 0)
                ) {
                    revert MathErrorWhileScaling();
                }

                /// Following checks for c:
                ///1. Overflow
                ///2. Division by 0
                if (c > type(uint64).max / 10 || c % 10 != 0) {
                    revert MathErrorWhileScaling();
                }

                p = p * 10;
                c = c * 10;
                delta++;
            }
        }

        return PythStructs.Price(p, c, targetExpo, self.publishTime);
    }
}
