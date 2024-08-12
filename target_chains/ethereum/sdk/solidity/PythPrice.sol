// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "./PythStructs.sol";

library PythPrice {
    // Constants for working with Pyth's number representation
    int32 private constant PD_EXPO = -9;
    uint64 private constant PD_SCALE = 1_000_000_000;
    uint64 private constant MAX_PD_V_U64 = (1 << 28) - 1;

    // Custom errors
    error DivisionByZero();
    error ConfidenceOverflow();
    error ExponentsMustMatch();
    error InvalidDiscount();
    error InvalidPremiumRates();

    /**
     * @dev Get the current price in a different quote currency.
     * @param price The base price
     * @param quote The quote price
     * @param resultExpo The desired exponent for the result
     * @return The price in the quote currency
     */
    function getPriceInQuote(
        PythStructs.Price memory price,
        PythStructs.Price memory quote,
        int32 resultExpo
    ) public pure returns (PythStructs.Price memory) {
        PythStructs.Price memory divResult = div(price, quote);
        return scaleToExponent(divResult, resultExpo);
    }

    /**
     * @dev Get the valuation price of a collateral position.
     * @param price The original price
     * @param deposits Quantity of token deposited in the protocol
     * @param deposits_endpoint Deposits right endpoint for the affine combination
     * @param rate_discount_initial Initial discounted rate at 0 deposits (units given by discount_exponent)
     * @param rate_discount_final Final discounted rate at deposits_endpoint deposits (units given by discount_exponent)
     * @param discount_exponent The exponent to apply to the discounts
     * @return The valuation price of the collateral
     */
    function getCollateralValuationPrice(
        PythStructs.Price memory price,
        uint64 deposits,
        uint64 deposits_endpoint,
        uint64 rate_discount_initial,
        uint64 rate_discount_final,
        int32 discount_exponent
    ) public pure returns (PythStructs.Price memory) {
        // rate_discount_initial should be >= rate_discount_final
        if (rate_discount_initial < rate_discount_final) {
            revert InvalidDiscount();
        }

        // get price versions of discounts
        PythStructs.Price memory initial_percentage = PythStructs.Price({
            price: int64(rate_discount_initial),
            conf: 0,
            expo: discount_exponent,
            publishTime: 0
        });

        PythStructs.Price memory final_percentage = PythStructs.Price({
            price: int64(rate_discount_final),
            conf: 0,
            expo: discount_exponent,
            publishTime: 0
        });

        // get the interpolated discount as a price
        PythStructs.Price memory discount_interpolated = affineCombination(
            0,
            initial_percentage,
            int64(deposits_endpoint),
            final_percentage,
            int64(deposits),
            -9
        );

        PythStructs.Price memory price_discounted = scaleToExponent(
            mul(price, discount_interpolated),
            price.expo
        );

        return
            PythStructs.Price({
                price: price_discounted.price,
                conf: price.conf,
                expo: price_discounted.expo,
                publishTime: price.publishTime
            });
    }

    /**
     * @dev Get the valuation of a borrow position according to various parameters.
     * @param borrows The quantity of token borrowed from the protocol
     * @param borrows_endpoint The borrows right endpoint for the affine combination
     * @param rate_premium_initial The initial premium at 0 borrows
     * @param rate_premium_final The final premium at borrows_endpoint borrows
     * @param premium_exponent The exponent to apply to the premiums above
     * @return The price of the borrow valuation
     */
    function getBorrowValuationPrice(
        PythStructs.Price memory price,
        uint64 borrows,
        uint64 borrows_endpoint,
        uint64 rate_premium_initial,
        uint64 rate_premium_final,
        int32 premium_exponent
    ) public pure returns (PythStructs.Price memory) {
        // Valuation price should not decrease as amount of borrow grows, so rate_premium_initial
        // should <= rate_premium_final
        if (rate_premium_initial > rate_premium_final) {
            revert InvalidPremiumRates();
        }

        // Get price versions of premiums
        PythStructs.Price memory initial_percentage = PythStructs.Price({
            price: int64(rate_premium_initial),
            conf: 0,
            expo: premium_exponent,
            publishTime: 0
        });

        PythStructs.Price memory final_percentage = PythStructs.Price({
            price: int64(rate_premium_final),
            conf: 0,
            expo: premium_exponent,
            publishTime: 0
        });

        // Get the interpolated premium as a price
        PythStructs.Price memory premium_interpolated = affineCombination(
            0,
            initial_percentage,
            int64(borrows_endpoint),
            final_percentage,
            int64(borrows),
            -9
        );

        // Get price premium, convert back to the original exponents we received the price in
        PythStructs.Price memory price_premium = scaleToExponent(
            mul(price, premium_interpolated),
            price.expo
        );

        return
            PythStructs.Price({
                price: price_premium.price,
                conf: price.conf,
                expo: price_premium.expo,
                publishTime: price.publishTime
            });
    }

    /**
     * @dev Perform an affine combination of two prices located at x coordinates x1 and x2, for query x coordinate x_query.
     * @param x1 The x coordinate of the first point
     * @param y1 The y coordinate of the first point, represented as a Price struct
     * @param x2 The x coordinate of the second point, must be greater than x1
     * @param y2 The y coordinate of the second point, represented as a Price struct
     * @param x_query The query x coordinate, at which we wish to impute a y value
     * @param pre_add_expo The exponent to scale to, before final addition; essentially the final precision you want
     * @return The price at the query x coordinate
     */
    function affineCombination(
        int64 x1,
        PythStructs.Price memory y1,
        int64 x2,
        PythStructs.Price memory y2,
        int64 x_query,
        int32 pre_add_expo
    ) internal pure returns (PythStructs.Price memory) {
        if (x2 <= x1) {
            revert("x2 must be greater than x1");
        }

        // Get the deltas for the x coordinates
        // 1. compute A = x_query - x1
        int64 delta_q1 = x_query - x1;
        // 2. compute B = x2 - x_query
        int64 delta_2q = x2 - x_query;
        // 3. compute C = x2 - x1
        int64 delta_21 = x2 - x1;

        // Get the relevant fractions of the deltas, with scaling
        // 4. compute D = A / C
        PythStructs.Price memory frac_q1 = fraction(delta_q1, delta_21);
        // 5. compute E = B / C
        PythStructs.Price memory frac_2q = fraction(delta_2q, delta_21);

        // Calculate products for left and right
        // 6. compute F = y2 * D
        PythStructs.Price memory left = mul(y2, frac_q1);
        // 7. compute G = y1 * E
        PythStructs.Price memory right = mul(y1, frac_2q);

        // Scaling
        left = scaleToExponent(left, pre_add_expo);
        right = scaleToExponent(right, pre_add_expo);

        // 8. compute H = F + G
        return add(left, right);
    }

    /**
     * @dev Divide one price by another, propagating uncertainty.
     * @param price The numerator price
     * @param price2 The denominator price
     * @return The resulting price
     */
    function div(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) internal pure returns (PythStructs.Price memory) {
        PythStructs.Price memory base = normalize(price);
        price2 = normalize(price2);

        if (price2.price == 0) {
            revert DivisionByZero();
        }

        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(price2.price);

        uint64 midprice = (basePrice * PD_SCALE) / otherPrice;
        int32 midpriceExpo = base.expo - price2.expo + PD_EXPO;

        uint64 otherConfidencePct = (price2.conf * PD_SCALE) / otherPrice;
        uint128 conf = ((uint128(base.conf) * PD_SCALE) / otherPrice) +
            ((uint128(otherConfidencePct) * midprice) / PD_SCALE);

        if (conf >= type(uint64).max) {
            revert ConfidenceOverflow();
        }

        return
            PythStructs.Price({
                price: int64(midprice) * baseSign * otherSign,
                conf: uint64(conf),
                expo: midpriceExpo,
                publishTime: Math.min(price.publishTime, price2.publishTime)
            });
    }

    /**
     * @dev Add two prices, propagating uncertainty.
     * @param price The first price
     * @param price2 The second price
     * @return The sum of the two prices
     */
    function add(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) internal pure returns (PythStructs.Price memory) {
        if (price.expo != price2.expo) {
            revert ExponentsMustMatch();
        }

        return
            PythStructs.Price({
                price: price.price + price2.price,
                conf: price.conf + price2.conf,
                expo: price.expo,
                publishTime: Math.min(price.publishTime, price2.publishTime)
            });
    }

    /**
     * @dev Multiply a price by a constant.
     * @param price The price
     * @param c The constant
     * @param e The exponent of the constant
     * @return The resulting price
     */
    function cmul(
        PythStructs.Price memory price,
        int64 c,
        int32 e
    ) internal pure returns (PythStructs.Price memory) {
        return
            mul(
                price,
                PythStructs.Price({
                    price: c,
                    conf: 0,
                    expo: e,
                    publishTime: price.publishTime
                })
            );
    }

    /**
     * @dev Multiply two prices, propagating uncertainty.
     * @param price The first price
     * @param price2 The second price
     * @return The product of the two prices
     */
    function mul(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) internal pure returns (PythStructs.Price memory) {
        PythStructs.Price memory base = normalize(price);
        price2 = normalize(price2);

        (uint64 basePrice, int64 baseSign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 otherSign) = toUnsigned(price2.price);

        uint64 midprice = basePrice * otherPrice;
        int32 midpriceExpo = base.expo + price2.expo;

        uint64 conf = base.conf * otherPrice + price2.conf * basePrice;

        return
            PythStructs.Price({
                price: int64(midprice) * baseSign * otherSign,
                conf: conf,
                expo: midpriceExpo,
                publishTime: Math.min(price.publishTime, price2.publishTime)
            });
    }

    /**
     * @dev Normalize a price to be between MIN_PD_V_I64 and MAX_PD_V_I64.
     * @param price The price to normalize
     * @return The normalized price
     */
    function normalize(
        PythStructs.Price memory price
    ) internal pure returns (PythStructs.Price memory) {
        (uint64 p, int64 s) = toUnsigned(price.price);
        uint64 c = price.conf;
        int32 e = price.expo;

        while (p > MAX_PD_V_U64 || c > MAX_PD_V_U64) {
            p /= 10;
            c /= 10;
            e += 1;
        }

        return
            PythStructs.Price({
                price: int64(p) * s,
                conf: c,
                expo: e,
                publishTime: price.publishTime
            });
    }

    /**
     * @dev Scale a price to a target exponent.
     * @param price The price to scale
     * @param targetExpo The target exponent
     * @return The scaled price
     */
    function scaleToExponent(
        PythStructs.Price memory price,
        int32 targetExpo
    ) internal pure returns (PythStructs.Price memory) {
        int32 delta = targetExpo - price.expo;
        if (delta == 0) return price;

        int64 p = price.price;
        uint64 c = price.conf;

        if (delta > 0) {
            while (delta > 0 && (p != 0 || c != 0)) {
                p /= 10;
                c /= 10;
                delta -= 1;
            }
        } else {
            while (delta < 0) {
                p *= 10;
                c *= 10;
                delta += 1;
            }
        }

        return
            PythStructs.Price({
                price: p,
                conf: c,
                expo: targetExpo,
                publishTime: price.publishTime
            });
    }

    /**
     * @dev Convert a signed integer to unsigned and a sign bit.
     * @param x The signed integer
     * @return The unsigned value and sign
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
     * @dev Helper function to create a fraction of two integers as a Price struct.
     * @param x The numerator
     * @param y The denominator
     * @return The fraction as a Price struct
     */
    function fraction(
        int64 x,
        int64 y
    ) internal pure returns (PythStructs.Price memory) {
        // Convert x and y to Prices
        PythStructs.Price memory x_as_price = PythStructs.Price({
            price: x,
            conf: 0,
            expo: 0,
            publishTime: 0
        });

        PythStructs.Price memory y_as_price = PythStructs.Price({
            price: y,
            conf: 0,
            expo: 0,
            publishTime: 0
        });

        // Get the relevant fraction
        return div(x_as_price, y_as_price);
    }
}
