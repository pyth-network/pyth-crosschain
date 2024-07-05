/**
 * @title PriceLibrary
 * @notice Library for manipulating PythStructs.Price data types.
 *         This library provides functions for basic arithmetic operations,
 *         normalization, scaling, and fraction calculations on Price structs.
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PythStructs.sol";


// Constants defining precision and limits for prices
int32 constant PD_EXPO = -9;
uint64 constant PD_SCALE = 1_000_000_000;
uint64 constant MAX_PD_V_U64 = (1 << 28) - 1;

/**
 * @notice Functions for manipulating PythStructs.Price data types.
 */
library PriceLibrary {

    /**
     * @notice Get the price in a specified quote currency.
     * @param self The base price.
     * @param quote The quote price.
     * @param resultExpo The exponent to scale the result to.
     * @return Scaled Price struct.
     */
    function getPriceInQuote(
        PythStructs.Price memory self,
        PythStructs.Price memory quote,
        int32 resultExpo
    ) public pure returns (PythStructs.Price memory) {
        // Divide the price self by the quote price and scale to desired exponent
        PythStructs.Price memory divResult = div(self, quote);
        return scaleToExponent(divResult, resultExpo);
    }

    /**
     * @notice Calculate collateral valuation price based on deposits and rate discounts.
     * @param self The base price.
     * @param deposits Amount of deposits.
     * @param depositsEndpoint Upper limit of deposits.
     * @param rateDiscountInitial Initial rate discount.
     * @param rateDiscountFinal Final rate discount.
     * @param discountExponent Exponent for rate discounts.
     * @return Adjusted Price struct.
     */
    function getCollateralValuationPrice(
        PythStructs.Price memory self,
        uint64 deposits,
        uint64 depositsEndpoint,
        uint64 rateDiscountInitial,
        uint64 rateDiscountFinal,
        int32 discountExponent
    ) public pure returns (PythStructs.Price memory) {
        // valuation price should not increase as amount of collateral grows, so
        // rate_discount_initial should >= rate_discount_final
        require(rateDiscountInitial >= rateDiscountFinal, "rateDiscountInitial should be greater than or equal to rateDiscountFinal");

        // Create Price structs for initial and final discount percentages
        PythStructs.Price memory initialPercentage = PythStructs.Price({
            price: int64(rateDiscountInitial),
            conf: 0,
            expo: discountExponent,
            publishTime: 0
        });
        PythStructs.Price memory finalPercentage = PythStructs.Price({
            price: int64(rateDiscountFinal),
            conf: 0,
            expo: discountExponent,
            publishTime: 0
        });

        // Interpolate discount percentage based on deposits amount
        PythStructs.Price memory discountInterpolated = affineCombination(
            0,
            initialPercentage,
            int64(depositsEndpoint),
            finalPercentage,
            int64(deposits),
            -9
        );

        uint64 confOrig = self.conf;
        int32 expoOrig = self.expo;

        // Apply discounted price to self price
        PythStructs.Price memory priceDiscounted = scaleToExponent(mul(self, discountInterpolated), expoOrig);
        // Return adjusted Price struct
        return PythStructs.Price({
            price: priceDiscounted.price,
            conf: confOrig,
            expo: priceDiscounted.expo,
            publishTime: self.publishTime
        });
    }

    /**
     * @notice Calculate borrow valuation price based on borrows and rate premiums.
     * @param self The base price.
     * @param borrows Amount of borrows.
     * @param borrowsEndpoint Upper limit of borrows.
     * @param ratePremiumInitial Initial rate premium.
     * @param ratePremiumFinal Final rate premium.
     * @param premiumExponent Exponent for rate premiums.
     * @return Adjusted Price struct.
     */
    function getBorrowValuationPrice(
        PythStructs.Price memory self,
        uint64 borrows,
        uint64 borrowsEndpoint,
        uint64 ratePremiumInitial,
        uint64 ratePremiumFinal,
        int32 premiumExponent
    ) public pure returns (PythStructs.Price memory) {
        // valuation price should not decrease as amount of borrow grows, so rate_premium_initial
        // should <= rate_premium_final
        require(ratePremiumInitial <= ratePremiumFinal, "ratePremiumInitial should not be greater than ratePremiumFinal");

        // Create Price structs for initial and final premium percentages
        PythStructs.Price memory initialPercentage = PythStructs.Price({
            price: int64(ratePremiumInitial),
            conf: 0,
            expo: premiumExponent,
            publishTime: 0
        });
        PythStructs.Price memory finalPercentage = PythStructs.Price({
            price: int64(ratePremiumFinal),
            conf: 0,
            expo: premiumExponent,
            publishTime: 0
        });

        // Interpolate premium percentage based on borrows amount
        PythStructs.Price memory premiumInterpolated = affineCombination(
            0,
            initialPercentage,
            int64(borrowsEndpoint),
            finalPercentage,
            int64(borrows),
            -9
        );

        uint64 confOrig = self.conf;
        int32 expoOrig = self.expo;

        // Apply premium price to self price
        PythStructs.Price memory pricePremium = scaleToExponent(mul(self, premiumInterpolated), expoOrig);
        
        // Return adjusted Price struct
        return PythStructs.Price({
            price: pricePremium.price,
            conf: confOrig,
            expo: pricePremium.expo,
            publishTime: self.publishTime
        });
    }

    /**
     * @notice Perform affine combination of two prices.
     * @dev Computes the value at `xQuery` by interpolating between `y1` and `y2` based on the coordinates `x1` and `x2`.
     *      The result is scaled to `preAddExpo` exponent.
     *      This function effectively draws a line between the two points (`x1`, `y1`) and (`x2`, `y2`), and then interpolates
     *      or extrapolates to find the value at `xQuery` along that line.
     *      If the prices (`y1` and `y2`) are normalized, no loss occurs in computation; otherwise, normalization ensures
     *      accuracy within 8 digits of precision.
     *      The scaling to `preAddExpo` introduces a maximum error of 2 * 10^`preAddExpo`. If `preAddExpo` is sufficiently
     *      small relative to the products, no loss due to scaling occurs.
     *      However, if `y1` and `y2` are unnormalized, normalization may zero out price fields, hence it's recommended
     *      to ensure input prices are normalized or have minimal discrepancies between price and confidence.
     * @param x1 X-coordinate of the first point.
     * @param y1 Y-coordinate of the first point, represented as a Price struct.
     * @param x2 X-coordinate of the second point, must be greater than `x1`.
     * @param y2 Y-coordinate of the second point, represented as a Price struct.
     * @param xQuery X-coordinate of the query point, at which we wish to impute a Y value.
     * @param preAddExpo Exponent to scale to before final addition; essentially the precision desired.
     * @return Affine combination result as a Price struct.
     *
     * Logic:
     * - Compute A = `xQuery` - `x1`
     * - Compute B = `x2` - `xQuery`
     * - Compute C = `x2` - `x1`
     * - Compute D = A / C
     * - Compute E = B / C
     * - Compute F = `y2` * D
     * - Compute G = `y1` * E
     * - Compute H = F + G
     *
     * Bounds due to precision loss:
     * - `x` = 10^(PD_EXPO + 2)
     * - Maximum loss due to normalization and division: `Err(D)`, `Err(E)` <= `x`
     * - If `y1` and `y2` are normalized, no additional error. Otherwise, `Err(y1)`, `Err(y2)` with normalization <= `x`
     * - `Err(F)`, `Err(G)` <= (1 + `x`)^2 - 1 (in fractional terms) ~= 2 * `x`
     * - `Err(H)` <= 2 * 2 * `x` = 4 * `x`, when `PD_EXPO` = -9 ==> `Err(H)` <= 4 * 10^-7
     * - Scaling back error bounded by `10^preAddExpo`. Error combines additively: `Err` <= 4 * `x` + 2 * 10^`preAddExpo`
     * - With `preAddExpo` reasonably small (<= -9), scaling error dominates.
     */
    function affineCombination(
        int64 x1,
        PythStructs.Price memory y1,
        int64 x2,
        PythStructs.Price memory y2,
        int64 xQuery,
        int32 preAddExpo
    ) public pure returns (PythStructs.Price memory) {
        require(x2 > x1, "X-coordinate of the second point, must be greater than X-coordinate of the first point");

        // Calculate deltas and fractions
        int64 deltaQ1 = xQuery - x1;
        int64 delta2Q = x2 - xQuery;
        int64 delta21 = x2 - x1;

        PythStructs.Price memory fracQ1 = fraction(deltaQ1, delta21);
        PythStructs.Price memory frac2Q = fraction(delta2Q, delta21);

        // Perform multiplication and scaling to target exponent
        PythStructs.Price memory left = mul(y2, fracQ1);
        PythStructs.Price memory right = mul(y1, frac2Q);
        left = scaleToExponent(left, preAddExpo);
        right = scaleToExponent(right, preAddExpo);

        // Return addition of left and right prices
        return add(left, right);
    }

    /**
     * @notice Perform division of two Price structs.
     * @param self The numerator Price struct.
     * @param other The denominator Price struct.
     * @return Resulting Price struct after division.
     */
    function div(
        PythStructs.Price memory self,
        PythStructs.Price memory other
    ) public pure returns (PythStructs.Price memory) {
        // Normalize both Price structs
        PythStructs.Price memory base = normalize(self);
        PythStructs.Price memory normalizedOther = normalize(other);

        // If normalizedOther price is zero, return zero Price struct
        if (normalizedOther.price == 0) {
            return PythStructs.Price({price: 0, conf: 0, expo: 0, publishTime: 0});
        }

        // Get unsigned values and signs of base and normalizedOther prices
        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(normalizedOther.price);

        // Calculate midprice and exponent for division
        uint64 midprice = (basePrice * PD_SCALE) / otherPrice;
        int32 midpriceExpo = base.expo - normalizedOther.expo + PD_EXPO;

        // Calculate confidence and handle overflow conditions
        uint64 otherConfidencePct = (normalizedOther.conf * PD_SCALE) / otherPrice;
        uint128 conf = (uint128(base.conf) * uint128(PD_SCALE)) /
            uint128(otherPrice) +
            uint128(otherConfidencePct) *
            uint128(midprice) / uint128(PD_SCALE);

        // Note that this check only fails if an argument's confidence interval was >> its price,
        // in which case None is a reasonable result, as we have essentially 0 information about the
        // price.
        require(conf < type(uint64).max, "Argument's confidence interval was >> its price");
        return PythStructs.Price({
            price: int64(midprice),
            conf: uint64(conf),
            expo: midpriceExpo,
            publishTime: base.publishTime
        });
    }

    /**
     * @notice Perform addition of two Price structs.
     * @param self The first Price struct.
     * @param other The second Price struct.
     * @return Resulting Price struct after addition.
     */
    function add(
        PythStructs.Price memory self,
        PythStructs.Price memory other
    ) public pure returns (PythStructs.Price memory) {
        require(self.expo == other.expo, "Exponents must match");

        // Calculate new price and confidence
        int64 price = self.price + other.price;
        uint64 conf = self.conf + other.conf;

        // Return adjusted Price struct
        return PythStructs.Price(
            price,
            conf,
            self.expo,
            min(self.publishTime, other.publishTime)
        );
    }

    /**
     * @notice Perform constant multiplication of a Price struct.
     * @param self The Price struct.
     * @param c The constant value.
     * @param e The exponent value.
     * @return Resulting Price struct after multiplication.
     */
    function cmul(
        PythStructs.Price memory self,
        int64 c,
        int32 e
    ) public pure returns (PythStructs.Price memory) {
        // Multiply Price struct by constant value c
        return mul(self, PythStructs.Price(c, 0, e, self.publishTime));
    }

    /**
     * @notice Perform multiplication of two Price structs.
     * @param self The first Price struct.
     * @param other The second Price struct.
     * @return Resulting Price struct after multiplication.
     */
    function mul(
        PythStructs.Price memory self,
        PythStructs.Price memory other
    ) public pure returns (PythStructs.Price memory) {
        // Normalize both Price structs
        PythStructs.Price memory base = normalize(self);
        PythStructs.Price memory normalizedOther = normalize(other);

        // Get unsigned values and signs of base and normalizedOther prices
        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(normalizedOther.price);

        // Calculate midprice and exponent for multiplication
        uint64 midprice = basePrice * otherPrice;
        int32 midpriceExpo = base.expo + normalizedOther.expo;

        // Calculate confidence and handle overflow conditions
        uint64 conf = base.conf * otherPrice + normalizedOther.conf * basePrice;

        // Return adjusted Price struct
        return PythStructs.Price(
            int64(midprice) * baseSign * otherSign,
            conf,
            midpriceExpo,
            min(self.publishTime, other.publishTime)
        );
    }

    /**
     * @notice Normalize a Price struct by adjusting price and confidence based on exponent.
     * @param self The Price struct to normalize.
     * @return Normalized Price struct.
     */
    function normalize(
        PythStructs.Price memory self
    ) public pure returns (PythStructs.Price memory) {
        // Convert price to unsigned and handle signs
        (uint64 price, int64 sign) = toUnsigned(self.price);
        uint64 conf = self.conf;
        int32 expo = self.expo;

        // Normalize price and confidence based on exponent
        while (price > MAX_PD_V_U64 || conf > MAX_PD_V_U64) {
            price = price / 10;
            conf = conf / 10;
            expo = expo + 1;
        }

        // Return normalized Price struct
        return PythStructs.Price({
            price: int64(price) * sign,
            conf: conf,
            expo: expo,
            publishTime: self.publishTime
        });
    }

    /**
     * @notice Scale a Price struct to a target exponent.
     * @param self The Price struct to scale.
     * @param targetExpo The target exponent.
     * @return Scaled Price struct.
     */
    function scaleToExponent(
        PythStructs.Price memory self,
        int32 targetExpo
    ) public pure returns (PythStructs.Price memory) {
        if (self.price == 0) {
            return PythStructs.Price({price: 0, conf: 0, expo: 0, publishTime: 0});
        }

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
        } else {
            while (delta < 0) {
                price = price * 10;
                conf = conf * 10;
                delta = delta + 1;
            }
        }

        // Return scaled Price struct
        return PythStructs.Price({
            price: price,
            conf: conf,
            expo: targetExpo,
            publishTime: self.publishTime
        });
    }

    /**
     * @notice Convert a signed integer to unsigned integer and handle special cases.
     * @param x The signed integer to convert.
     * @return Unsigned integer and sign.
     */
    function toUnsigned(int64 x) internal pure returns (uint64, int64) {
        if (x == type(int64).min) {
            return (uint64(type(int64).max) + 1, -1);
        } else if (x < 0) {
            return (uint64(-x), -1);
        } else {
            return (uint64(x), 1);
        }
    }

    /**
     * @notice Perform fraction calculation of two integers.
     * @param x The numerator.
     * @param y The denominator.
     * @return Fraction result as a Price struct.
     */
    function fraction(
        int64 x,
        int64 y
    ) public pure returns (PythStructs.Price memory) {
        // Convert integers to Price structs and perform division
        PythStructs.Price memory xAsPrice = PythStructs.Price(x, 0, 0, 0);
        PythStructs.Price memory yAsPrice = PythStructs.Price(y, 0, 0, 0);

        PythStructs.Price memory frac = div(xAsPrice, yAsPrice);
        if (frac.price == 0) {
            return PythStructs.Price(0, 0, 0, 0);
        }

        // Return fraction Price struct
        return frac;
    }

    /**
     * @notice Get the minimum of two unsigned integers.
     * @param a The first integer.
     * @param b The second integer.
     * @return The smaller integer.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}