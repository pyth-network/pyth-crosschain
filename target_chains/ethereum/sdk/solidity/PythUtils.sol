// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {PythStructs} from "./PythStructs.sol";

library PythUtils {

    int256 constant D18_SCALE = 1e18;
    uint256 constant uD18_SCALE = 1e18;
    int32 constant D18_EXPO = -18;

    /// @notice A memory structs for not getting stack too deep
    struct DivVar {
        int256 x_ExpoDelta;
        int256 x_priceD18;
        uint256 x_confD18;
        int256 y_ExpoDelta;
        int256 y_priceD18;
        uint256 y_confD18;
    }

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

    /// @notice Dividing Pyth Price x_ over y_
    /// @param x_ Dividend Price
    /// @param y_ Divisor Price
    /// @return res Quotient Price
    /// @dev This function will scale the price into 18 decimals first (`WAD`) before operation, then scaling it down to `x_` expo
    function div(PythStructs.Price memory x_, PythStructs.Price memory y_) public pure returns (PythStructs.Price memory res) {
        DivVar memory vars;
        vars.x_ExpoDelta = x_.expo - D18_EXPO;

        if(vars.x_ExpoDelta >= 0) {
            vars.x_priceD18 = x_.price * int(10 ** uint256(vars.x_ExpoDelta));
            vars.x_confD18 = x_.conf * 10 ** uint256(vars.x_ExpoDelta);
        }
        else {
            vars.x_priceD18 =  x_.price / int((10 ** uint256(-vars.x_ExpoDelta)));
            vars.x_confD18 = x_.conf / (10 ** uint256(-vars.x_ExpoDelta));
        }
        vars.y_ExpoDelta = y_.expo - D18_EXPO;
        if(vars.y_ExpoDelta >= 0) {
            vars.y_priceD18 = y_.price * int(10 ** uint256(vars.y_ExpoDelta));
            vars.y_confD18 = y_.conf * 10 ** uint256(vars.y_ExpoDelta);
        }
        else {
            vars.y_priceD18 =  y_.price / int(10 ** uint256(-vars.y_ExpoDelta));
            vars.y_confD18 = y_.conf / (10 ** uint256(-vars.y_ExpoDelta));
        }
        uint256 ux_priceD18;
        uint256 uy_priceD18;
        unchecked {
            ux_priceD18 = vars.x_priceD18 > 0 ? uint256(vars.x_priceD18) : uint256(-vars.x_priceD18);
            uy_priceD18 = vars.y_priceD18 > 0 ? uint256(vars.y_priceD18) : uint256(-vars.y_priceD18);
        }
        uint256 x_y = ux_priceD18 * uD18_SCALE / uy_priceD18;
        uint256 y_conf_pct = vars.y_confD18 * uD18_SCALE / uy_priceD18;
        uint256 confD18 = (vars.x_confD18 * uD18_SCALE / uy_priceD18) + (y_conf_pct * x_y  / uD18_SCALE);
        bool sameSign = (x_.price ^ y_.price) > 1;
        int256 xyPriceD18 = sameSign ? int256(x_y) : -int256(x_y);
        if(vars.x_ExpoDelta >= 0) {
            int256 xyPrice = xyPriceD18 / int(10 ** uint256(vars.x_ExpoDelta));
            if(xyPrice > type(int64).max) {
                revert();
            }
            uint256 xyConf = confD18 / (10 ** uint256(vars.x_ExpoDelta));
            if(xyConf > type(uint64).max) {
                revert();
            }
            res.price = int64(xyPrice);
            res.conf = uint64(xyConf);
        }
        else {
            int256 xyPrice = xyPriceD18 * int(10 ** uint256(-vars.x_ExpoDelta));
            if(xyPrice > type(int64).max) {
                revert();
            }
            uint256 xyConf = confD18 * (10 ** uint256(-vars.x_ExpoDelta));
            if(xyConf > type(uint64).max) {
                revert();
            }
            res.price = int64(xyPrice);
            res.conf = uint64(xyConf);
        }
        res.expo =  x_.expo;
        res.publishTime = (x_.publishTime < y_.publishTime) ? x_.publishTime : y_.publishTime;
    }

    /// @notice Dividing Pyth Price x_ over y_ without calculating confident interval
    /// @param x_ Dividend Price
    /// @param y_ Divisor Price
    /// @return quotientD18 Quotient in integer with 18 decimals
    /// @dev This does not scale back like `div` and can be use in most place immediately 
    function divD18(PythStructs.Price memory x_, PythStructs.Price memory y_) public pure returns (int256 quotientD18) {
        int32 x_expo = x_.expo - D18_EXPO;
        int256 x_price = (x_expo > 0) ? int256(x_.price) * int256(10 ** uint32(x_expo)) : int256(x_.price) / int256(10 ** uint32(-x_expo));
        if (y_.expo < 0) {
            return x_price * int256(10 ** uint32(-y_.expo)) / y_.price;
        }
        else {
            return x_price / int256(10 ** uint32(y_.expo)) / y_.price;
        }
    }
}
