// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.25;

import {Test, console2} from "forge-std/Test.sol";
import {CombinePythPrice} from "src/CombinePythPrice.sol";
import {PythStructs} from "src/PythStructs.sol";

contract CombinePythPriceTest is Test {
    PythStructs.Price public Price;
    uint64 private constant PD_SCALE = 1_000_000_000;

    function setUp() public view {}

    ////////////////////////////////
    //      toUnsigned()          //
    ////////////////////////////////

    function testToUnsignedPositive() public pure {
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(100);
        assertEq(value, 100);
        assertEq(sign, 1);
    }

    function testToUnsignedNegative() public pure {
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(-100);
        assertEq(value, 100);
        assertEq(sign, -1);
    }

    function testToUnsignedZero() public pure {
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(0);
        assertEq(value, 0);
        assertEq(sign, 1);
    }

    function testToUnsignedMinInt64() public pure {
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(
            type(int64).min
        );
        assertEq(value, uint64(type(int64).max) + 1);
        assertEq(sign, -1);
    }

    function testToUnsignedMaxInt64() public pure {
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(
            type(int64).max
        );
        assertEq(value, uint64(type(int64).max));
        assertEq(sign, 1);
    }

    function testToUnsignedFuzzPositive(int64 input) public pure {
        vm.assume(input > 0);
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(input);
        assertEq(value, uint64(input));
        assertEq(sign, 1);
    }

    function testToUnsignedFuzzNegative(int64 input) public pure {
        vm.assume(input < 0 && input != type(int64).min);
        (uint64 value, int64 sign) = CombinePythPrice.toUnsigned(input);
        assertEq(value, uint64(-input));
        assertEq(sign, -1);
    }

    ////////////////////////////////
    //           min()            //
    ////////////////////////////////

    function testMinBasicCase() public pure {
        uint256 a = 100;
        uint256 b = 200;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == a);
    }

    function testMinReversedOrder() public pure {
        uint256 a = 200;
        uint256 b = 100;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == b);
    }

    function testMinEqualValues() public pure {
        uint256 a = 100;
        uint256 b = 100;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == a);
        assert(result == b);
    }

    function testMinZeroAndPositive() public pure {
        uint256 a = 0;
        uint256 b = 100;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == a);
    }

    function testMinPositiveAndZero() public pure {
        uint256 a = 100;
        uint256 b = 0;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == b);
    }

    function testMinLargeNumbers() public pure {
        uint256 a = type(uint256).max;
        uint256 b = type(uint256).max - 1;
        uint256 result = CombinePythPrice.min(a, b);
        assert(result == b);
    }

    function testMinFuzz(uint256 a, uint256 b) public pure {
        uint256 result = CombinePythPrice.min(a, b);
        assert(result <= a && result <= b);
        assert(result == a || result == b);
    }

    function testMinWithTypicalTimestamps() public view {
        uint256 currentTimestamp = block.timestamp;
        uint256 futureTimestamp = currentTimestamp + 3600; // 1 hour in the future
        uint256 result = CombinePythPrice.min(
            currentTimestamp,
            futureTimestamp
        );
        assert(result == currentTimestamp);
    }

    function testMinWithPastAndFutureTimestamps() public pure {
        uint256 pastTimestamp = 1609459200; // 2021-01-01 00:00:00 UTC
        uint256 futureTimestamp = 1735689600; // 2025-01-01 00:00:00 UTC
        uint256 result = CombinePythPrice.min(pastTimestamp, futureTimestamp);
        assert(result == pastTimestamp);
    }

    ////////////////////////////////
    //    scaleToExponent()       //
    ////////////////////////////////

    function testScaleToExponentNoChange() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000,
            conf: 10,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            -2
        );
        assert(result.price == 1000);
        assert(result.conf == 10);
        assert(result.expo == -2);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentScaleUp() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000,
            conf: 10,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            0
        );
        assert(result.price == 10);
        assert(result.conf == 0);
        assert(result.expo == 0);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentScaleDown() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000,
            conf: 10,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            -4
        );
        assert(result.price == 100000);
        assert(result.conf == 1000);
        assert(result.expo == -4);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentZeroPrice() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 0,
            conf: 10,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            0
        );
        assert(result.price == 0);
        assert(result.conf == 0);
        assert(result.expo == 0);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentZeroConf() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000,
            conf: 0,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            0
        );
        assert(result.price == 10);
        assert(result.conf == 0);
        assert(result.expo == 0);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentLargeScaleUp() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000000000,
            conf: 10000000,
            expo: -8,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            0
        );
        assert(result.price == 10);
        assert(result.conf == 0);
        assert(result.expo == 0);
        assert(result.publishTime == 1625097600);
    }

    function testScaleToExponentLargeScaleDown() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 10,
            conf: 1,
            expo: 0,
            publishTime: 1625097600
        });

        vm.expectRevert(CombinePythPrice.MathErrorWhileScaling.selector);
        CombinePythPrice.scaleToExponent(price, -8);
    }

    function testScaleToExponentNegativePrice() public pure {
        PythStructs.Price memory price = PythStructs.Price({
            price: -1000,
            conf: 10,
            expo: -2,
            publishTime: 1625097600
        });
        PythStructs.Price memory result = CombinePythPrice.scaleToExponent(
            price,
            0
        );
        assert(result.price == -10);
        assert(result.conf == 0);
        assert(result.expo == 0);
        assert(result.publishTime == 1625097600);
    }

    ///////////////////////////
    //        Normalise()    //
    ///////////////////////////

    function testNormalizeNormalCase() public view {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000000,
            conf: 1000,
            expo: -6,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.normalize(price);

        assertEq(result.price, 1000000);
        assertEq(result.conf, 1000);
        assertEq(result.expo, -6);
        assertEq(result.publishTime, price.publishTime);
    }

    function testNormalizeNegativePrice() public view {
        PythStructs.Price memory price = PythStructs.Price({
            price: -1000000,
            conf: 1000,
            expo: -6,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.normalize(price);

        assertEq(result.price, -1000000);
        assertEq(result.conf, 1000);
        assertEq(result.expo, -6);
        assertEq(result.publishTime, price.publishTime);
    }

    function testNormalizeLargePrice() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1_000_000_000_000_000_000,
            conf: 1_000_000_000,
            expo: -6,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);
        CombinePythPrice.normalize(price);
    }

    function testNormalizeMinInt64() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: type(int64).min,
            conf: 1000,
            expo: -6,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);
        CombinePythPrice.normalize(price);
    }

    function testNormalizeMaxUint64() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: type(int64).max,
            conf: 1,
            expo: 0,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);
        CombinePythPrice.normalize(price);
    }

    function testNormalizeDivisionByZero() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 0,
            conf: 0,
            expo: -6,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);
        CombinePythPrice.normalize(price);
    }

    ////////////////////////
    //        div         //
    ////////////////////////

    function testDivNormalCase() public view {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 1000000000, // $1.00
            conf: 10000000, // $0.01
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory price2 = PythStructs.Price({
            price: 2000000000, // $2.00
            conf: 20000000, // $0.02
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.div(price1, price2);

        assertEq(result.price, 500000000); // 0.5
        assertEq(result.conf, 10000000); // 0.0075
        assertEq(result.expo, -9);
    }

    function testDivDifferentExponents() public view {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 1_000_000, // $1.00
            conf: 10_000, // $0.01
            expo: -6,
            publishTime: block.timestamp
        });

        PythStructs.Price memory price2 = PythStructs.Price({
            price: 2_000_000_000, // $2.00
            conf: 20_000_000, // $0.02
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.div(price1, price2);

        assertEq(result.price, 5000000); // 0.5
        assertEq(result.conf, 100000); // 0.0075
        assertEq(result.expo, -7);
    }

    function testDivZeroDenominator() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 1000000000,
            conf: 10000000,
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory price2 = PythStructs.Price({
            price: 0,
            conf: 20000000,
            expo: -9,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);
        CombinePythPrice.div(price1, price2);
    }

    function testDivLargeNumbers() public view {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 1000000000000000000, // 1e18
            conf: 10000000000000000, // 1e16
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory price2 = PythStructs.Price({
            price: 1000000000, // 1e9
            conf: 10000000, // 1e7
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.div(price1, price2);

        assertEq(result.price, 1000000000); // 1e9
        assertEq(result.conf, 20000000); // 2e7
        assertEq(result.expo, 0);
    }

    function testDivNegativeNumbers() public view {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: -1000000000, // -$1.00
            conf: 10000000, // $0.01
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory price2 = PythStructs.Price({
            price: 2000000000, // $2.00
            conf: 20000000, // $0.02
            expo: -9,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.div(price1, price2);

        assertEq(result.price, -500000000); // -0.5
        assertEq(result.conf, 10000000); // 0.0075
        assertEq(result.expo, -9);
    }

    ////////////////////////////////
    //      getPriceInQuotes      //
    ////////////////////////////////

    function testGetPriceInQuote_SameExponent() public view {
        PythStructs.Price memory basePrice = PythStructs.Price({
            price: 100_000_000,
            conf: 1_000_000,
            expo: -8,
            publishTime: block.timestamp
        });
        PythStructs.Price memory quotePrice = PythStructs.Price({
            price: 50_000_000,
            conf: 500_000,
            expo: -8,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.getPriceInQuote(
            basePrice,
            quotePrice,
            -9
        );

        PythStructs.Price memory nRes = CombinePythPrice.normalize(quotePrice);
        console2.log("price", nRes.price);
        console2.log("conf", nRes.conf);

        assertEq(result.price, 2_000_000_000);
        assertEq(result.conf, 40000000);
        assertEq(result.expo, -9);
    }

    function testGetPriceInQuote_DifferentExponents() public view {
        PythStructs.Price memory basePrice = PythStructs.Price({
            price: 100000000,
            conf: 1000000,
            expo: -8,
            publishTime: block.timestamp
        });
        PythStructs.Price memory quotePrice = PythStructs.Price({
            price: 5000000000,
            conf: 50000000,
            expo: -10,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.getPriceInQuote(
            basePrice,
            quotePrice,
            -9
        );

        assertEq(result.price, 2000000000);
        assertEq(result.conf, 40000000);
        assertEq(result.expo, -9);
    }

    function testGetPriceInQuote_ZeroQuotePrice() public {
        PythStructs.Price memory basePrice = PythStructs.Price({
            price: 100000000,
            conf: 1000000,
            expo: -8,
            publishTime: block.timestamp
        });
        PythStructs.Price memory quotePrice = PythStructs.Price({
            price: 0,
            conf: 0,
            expo: -8,
            publishTime: block.timestamp
        });

        vm.expectRevert(CombinePythPrice.DivisionByZero.selector);

        CombinePythPrice.getPriceInQuote(basePrice, quotePrice, -9);
    }

    function testGetPriceInQuote_NegativePrices() public view {
        PythStructs.Price memory basePrice = PythStructs.Price({
            price: -100000000,
            conf: 1000000,
            expo: -8,
            publishTime: block.timestamp
        });
        PythStructs.Price memory quotePrice = PythStructs.Price({
            price: -50000000,
            conf: 500000,
            expo: -8,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.getPriceInQuote(
            basePrice,
            quotePrice,
            -9
        );

        assertEq(result.price, 2000000000);
        assertEq(result.conf, 40000000);
        assertEq(result.expo, -9);
    }

    function testGetPriceInQuote_LargeExponentDifference() public view {
        PythStructs.Price memory basePrice = PythStructs.Price({
            price: 100000000000000,
            conf: 1000000000000,
            expo: -14,
            publishTime: block.timestamp
        });
        PythStructs.Price memory quotePrice = PythStructs.Price({
            price: 5,
            conf: 1,
            expo: -1,
            publishTime: block.timestamp
        });

        PythStructs.Price memory result = CombinePythPrice.getPriceInQuote(
            basePrice,
            quotePrice,
            -9
        );

        assertEq(result.price, 2000000000);
        assertEq(result.conf, 420000000);
        assertEq(result.expo, -9);
    }

    //////////////////////
    //      addPrice    //
    //////////////////////

    function testAddPricesWithSameExponent() public pure {
        PythStructs.Price memory p1 = PythStructs.Price({
            price: 100000000,
            conf: 1000000,
            expo: -8,
            publishTime: 1625097600
        });

        PythStructs.Price memory p2 = PythStructs.Price({
            price: 200000000,
            conf: 2000000,
            expo: -8,
            publishTime: 1625097700
        });

        PythStructs.Price memory result = CombinePythPrice.addPrices(p1, p2);

        assertEq(result.price, 300000000);
        assertEq(result.conf, 3000000);
        assertEq(result.expo, -8);
        assertEq(result.publishTime, 1625097600);
    }

    function testAddPricesWithNegativeValues() public pure {
        PythStructs.Price memory p1 = PythStructs.Price({
            price: -100000000,
            conf: 1000000,
            expo: -8,
            publishTime: 1625097600
        });

        PythStructs.Price memory p2 = PythStructs.Price({
            price: 200000000,
            conf: 2000000,
            expo: -8,
            publishTime: 1625097700
        });

        PythStructs.Price memory result = CombinePythPrice.addPrices(p1, p2);

        assertEq(result.price, 100000000);
        assertEq(result.conf, 3000000);
        assertEq(result.expo, -8);
        assertEq(result.publishTime, 1625097600);
    }

    function testAddPricesWithZeroValues() public pure {
        PythStructs.Price memory p1 = PythStructs.Price({
            price: 0,
            conf: 0,
            expo: -8,
            publishTime: 1625097600
        });

        PythStructs.Price memory p2 = PythStructs.Price({
            price: 200000000,
            conf: 2000000,
            expo: -8,
            publishTime: 1625097700
        });

        PythStructs.Price memory result = CombinePythPrice.addPrices(p1, p2);

        assertEq(result.price, 200000000);
        assertEq(result.conf, 2000000);
        assertEq(result.expo, -8);
        assertEq(result.publishTime, 1625097600);
    }

    function testAddPricesWithDifferentExponents() public {
        PythStructs.Price memory p1 = PythStructs.Price({
            price: 100000000,
            conf: 1000000,
            expo: -8,
            publishTime: 1625097600
        });

        PythStructs.Price memory p2 = PythStructs.Price({
            price: 200000000,
            conf: 2000000,
            expo: -9,
            publishTime: 1625097700
        });

        vm.expectRevert(
            abi.encodeWithSelector(
                CombinePythPrice.AddingPricesOfDifferentExponents.selector,
                -8,
                -9
            )
        );
        CombinePythPrice.addPrices(p1, p2);
    }
}
