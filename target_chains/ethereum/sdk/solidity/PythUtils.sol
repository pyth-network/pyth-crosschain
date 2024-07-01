// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {PythStructs} from "./PythStructs.sol";


// Constants for working with pyth's number representation
int32 constant PD_EXPO = -9;
uint64 constant  PD_SCALE = 1000000000;
uint64 constant MAX_PD_V_U64 = (1 << 28) - 1;

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
     /// Helper function to convert signed integers to unsigned and a sign bit, which simplifies
    /// some of the computations below.
    function toUnsigned(int64 x) public pure returns(uint64, int64){
        // Define the minimum value for int256
        int64 minInt = type(int64).min;
        // Define the maximum value for int256
        uint64 maxUint = uint64(type(int64).max) + 1;
        
        if (x == minInt) {
            // Special case because int256::MIN == -int256::MIN in absolute value terms
            return (maxUint, -1);
        } else if (x < 0) {
            // For negative values, convert to positive and mark the sign as -1
            return (uint64(-x), -1);
        } else {
            // For non-negative values, just convert directly and mark the sign as 1
            return (uint64(x), 1);
        }
    }

    
    /// Get a copy of this struct where the price and confidence
    /// have been normalized to be between `MIN_PD_V_I64` and `MAX_PD_V_I64`.
    function normalize (PythStructs.Price memory self) public pure returns(PythStructs.Price memory){
        (uint64 price , int64 sign  ) = toUnsigned(self.price);
        uint64 conf = self.conf;
        int32 expo = self.expo;

        while (price > MAX_PD_V_U64 || conf > MAX_PD_V_U64) {
            price = price / 10;
            conf = conf / 10;
            expo = expo + 1;
        }

        //TODO catch overflow error        
        int64 normalizeSelfPrice = int64(price) *sign;
        PythStructs.Price memory normalizedPrice = PythStructs.Price({
                                                        price: normalizeSelfPrice,
                                                        conf: conf,
                                                        expo: expo,
                                                        publishTime: self.publishTime
                                                    });
        return normalizedPrice;
    }

    /// Divide this price by `other` while propagating the uncertainty in both prices into the
    /// result.
    ///
    /// This method will automatically select a reasonable exponent for the result. If both
    /// `self` and `other` are normalized, the exponent is `self.expo + PD_EXPO - other.expo`
    /// (i.e., the fraction has `PD_EXPO` digits of additional precision). If they are not
    /// normalized, this method will normalize them, resulting in an unpredictable result
    /// exponent. If the result is used in a context that requires a specific exponent,
    /// please call `scaleToExponent` on it.
    function div (PythStructs.Price memory self , PythStructs.Price memory other) public pure returns(PythStructs.Price memory){
        
        // Price is not guaranteed to store its price/confidence in normalized form.
        // Normalize them here to bound the range of price/conf, which is required to perform
        // arithmetic operations.
        PythStructs.Price memory base = normalize(self);
        other = normalize(other);
        uint minPublishTIme = ((self.publishTime > other.publishTime) ? other.publishTime : self.publishTime);
        if (other.price == 0){
            revert();
        }

        // These use at most 27 bits each
        (uint64 basePrice, int64 basesign) = toUnsigned(base.price);
        (uint64 otherPrice, int64 othersign) = toUnsigned(other.price);

        // Compute the midprice, base in terms of other.
        // Uses at most 57 bits

        uint64 midPrice = (basePrice*PD_SCALE)/ otherPrice;
        int32 midPriceExpo = (base.expo - other.expo) + PD_EXPO ;

        // Compute the confidence interval.
        // This code uses the 1-norm instead of the 2-norm for computational reasons.
        // Let p +- a and q +- b be the two arguments to this method. The correct
        // formula is p/q * sqrt( (a/p)^2 + (b/q)^2 ). This quantity
        // is difficult to compute due to the sqrt and overflow/underflow considerations.
        //
        // This code instead computes p/q * (a/p + b/q) = a/andq + pb/q^2 .
        // This quantity is at most a factor of sqrt(2) greater than the correct result, which
        // shouldn't matter considering that confidence intervals are typically ~0.1% of the price.


        uint64 otherConf = (other.conf * PD_SCALE) / otherPrice;
        uint128 baseMax = type(uint64).max;
        
        uint64 baseConf = (base.conf*PD_SCALE)/otherPrice + ((otherConf * midPrice)/PD_SCALE);

        int64 signedMidPrice = int64(midPrice)*basesign*othersign;
        if (baseConf <  baseMax) {
           PythStructs.Price memory result = PythStructs.Price({
                                            price: signedMidPrice,
                                            conf: baseConf,
                                            expo: midPriceExpo,
                                            publishTime:  minPublishTIme
                                        });
                return result;
        }else {
            revert();
        }




    }
     /// Scale this price/confidence so that its exponent is `target_expo`.
    ///

    function scaleToExponent(PythStructs.Price memory self , int32 targetExpo) public pure returns(PythStructs.Price memory){
        int64 p;
       
            int32 delta =  targetExpo - self.expo;

            if (delta >= 0){
                p = self.price;
                uint64 c = self.conf;
                // 2nd term is a short-circuit t bound op consumption
                while ((delta > 0 ) && ( p !=0 || c != 0)){
                    p = p/10;
                    c = c/10;
                    delta = delta -1;
                }
                PythStructs.Price memory result = PythStructs.Price ({
                                                    price: p,
                                                    conf:  c,
                                                    expo:  targetExpo,
                                                    publishTime: self.publishTime
                });
                return (result);
        }else {

                p = self.price;
                uint64 c = self.conf;
                // Either p or c == None will short-circuit to bound op consumption
                while (delta < 0) {
                    p = p*10;
                    c = c*10;
                    delta = delta +1;

                }

                PythStructs.Price memory result = PythStructs.Price ({
                                                    price: p,
                                                    conf:  c,
                                                    expo:  targetExpo,
                                                    publishTime: self.publishTime
                });
                return (result);
            }
        
    }
    /// Get the current price of this account in a different quote currency.
    ///
    /// If this account represents the price of the product X/Z, and `quote` represents the price
    /// of the product Y/Z, this method returns the price of X/Y. Use this method to get the
    /// price of e.g., mSOL/SOL from the mSOL/USD and SOL/USD accounts.
    ///
    /// `result_expo` determines the exponent of the result, i.e., the number of digits below the
    /// decimal point. This method returns `None` if either the price or confidence are too
    /// large to be represented with the requested exponent.
    ///
    /// Example:
    /// ```ignore
    /// Price [] btcUsd = ...;
    /// Price [] ethUsd  = ...;
    /// // -8 is the desired exponent for the result
    /// Price [] btcEth: = btcUsd.getPriceinQuote(&eth_usd, -8);
    /// return("BTC/ETH price: ({} +- {}) x 10^{}", price.price, price.conf, price.expo);
    /// ```
    function getPriceinQuote (PythStructs.Price memory self , PythStructs.Price memory other, int32 resultExpo) public pure returns(PythStructs.Price memory quote){
        PythStructs.Price memory result = div(self, other);
        return scaleToExponent(result, resultExpo);
    }

}
