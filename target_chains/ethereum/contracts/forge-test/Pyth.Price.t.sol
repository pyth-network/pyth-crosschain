pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/PythPrice.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythPriceTest is Test {
    PythPriceHarness harness;
    uint64 private constant PD_SCALE = 1_000_000_000;

    function setUp() public {
        harness = new PythPriceHarness();
    }

    function testDivNormalOperation() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory price2 = PythStructs.Price({
            price: 50,
            conf: 2,
            expo: -8,
            publishTime: 1100
        });
        PythStructs.Price memory result = harness.div(price1, price2);
        assertEq(result.price, 2 * 10 ** 9, "Division result should be 2");
        assertEq(result.expo, -9, "Exponent should be -9");
        assertEq(
            result.publishTime,
            1000,
            "PublishTime should be the minimum of the two"
        );
    }

    function testDivByZero() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory price2 = PythStructs.Price({
            price: 0,
            conf: 2,
            expo: -8,
            publishTime: 1100
        });
        vm.expectRevert(abi.encodeWithSignature("DivisionByZero()"));
        harness.div(price1, price2);
    }

    function testAddSameExponent() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory price2 = PythStructs.Price({
            price: 50,
            conf: 2,
            expo: -8,
            publishTime: 1100
        });
        PythStructs.Price memory result = harness.add(price1, price2);
        assertEq(result.price, 150, "Addition result should be 150");
        assertEq(result.conf, 7, "Confidence should be summed");
        assertEq(result.expo, -8, "Exponent should remain the same");
        assertEq(
            result.publishTime,
            1000,
            "PublishTime should be the minimum of the two"
        );
    }

    function testAddDifferentExponent() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory price2 = PythStructs.Price({
            price: 50,
            conf: 2,
            expo: -7,
            publishTime: 1100
        });
        vm.expectRevert(abi.encodeWithSignature("ExponentsMustMatch()"));
        harness.add(price1, price2);
    }

    function testMulNormalOperation() public {
        PythStructs.Price memory price1 = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory price2 = PythStructs.Price({
            price: 50,
            conf: 2,
            expo: -8,
            publishTime: 1100
        });
        PythStructs.Price memory result = harness.mul(price1, price2);
        assertEq(result.price, 5000, "Multiplication result should be 5000");
        assertEq(result.expo, -16, "Exponents should be added");
        assertEq(
            result.publishTime,
            1000,
            "PublishTime should be the minimum of the two"
        );
    }

    function testNormalize() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 2 * int64(PD_SCALE),
            conf: 3 * PD_SCALE,
            expo: 0,
            publishTime: 1000
        });
        PythStructs.Price memory result = harness.normalize(price);
        assertEq(
            result.price,
            (2 * int64(PD_SCALE)) / 100,
            "Price should be normalized to 10^9"
        );
        assertEq(
            result.conf,
            (3 * PD_SCALE) / 100,
            "Confidence should be normalized"
        );
        assertEq(result.expo, 2, "Exponent should be adjusted");
    }

    function testScaleToExponentUpscale() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 1000,
            conf: 50,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory result = harness.scaleToExponent(price, -6);
        assertEq(result.price, 10, "Price should be scaled up");
        assertEq(
            result.conf,
            0,
            "Confidence should be scaled (rounded down to 0)"
        );
        assertEq(result.expo, -6, "Exponent should be adjusted to target");
    }

    function testToUnsignedPositive() public {
        (uint64 unsignedValue, int64 sign) = harness.toUnsigned(100);
        assertEq(unsignedValue, 100, "Unsigned value should be 100");
        assertEq(sign, 1, "Sign should be positive");
    }

    function testToUnsignedNegative() public {
        (uint64 unsignedValue, int64 sign) = harness.toUnsigned(-100);
        assertEq(unsignedValue, 100, "Unsigned value should be 100");
        assertEq(sign, -1, "Sign should be negative");
    }

    function testFraction() public {
        PythStructs.Price memory result = harness.fraction(10, 5);
        assertEq(result.price, 2 * 10 ** 9, "Fraction result should be 2");
        assertEq(result.expo, -9, "Exponent should be -9");
    }

    function testAffineCombination() public {
        PythStructs.Price memory y1 = PythStructs.Price({
            price: 100,
            conf: 10,
            expo: -4,
            publishTime: 0
        });
        PythStructs.Price memory y2 = PythStructs.Price({
            price: 100,
            conf: 10,
            expo: -4,
            publishTime: 0
        });
        PythStructs.Price memory result = harness.affineCombination(
            0,
            y1,
            10,
            y2,
            5,
            -9
        );
        assertEq(result.price, 10 ** 7, "Affine combination should be 150");
        assertEq(result.expo, -9, "Exponent should be -9");
    }

    function testCmul() public {
        PythStructs.Price memory price = PythStructs.Price({
            price: 100,
            conf: 5,
            expo: -8,
            publishTime: 1000
        });
        PythStructs.Price memory result = harness.cmul(price, 2, 0);
        assertEq(result.price, 200, "Multiplication result should be 200");
        assertEq(result.expo, -8, "Exponent should remain the same");
    }
}

contract PythPriceHarness {
    using PythPrice for *;

    function div(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.div(price, price2);
    }

    function add(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.add(price, price2);
    }

    function mul(
        PythStructs.Price memory price,
        PythStructs.Price memory price2
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.mul(price, price2);
    }

    function normalize(
        PythStructs.Price memory price
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.normalize(price);
    }

    function scaleToExponent(
        PythStructs.Price memory price,
        int32 targetExpo
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.scaleToExponent(price, targetExpo);
    }

    function toUnsigned(int64 x) public pure returns (uint64, int64) {
        return PythPrice.toUnsigned(x);
    }

    function fraction(
        int64 x,
        int64 y
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.fraction(x, y);
    }

    function affineCombination(
        int64 x1,
        PythStructs.Price memory y1,
        int64 x2,
        PythStructs.Price memory y2,
        int64 x_query,
        int32 pre_add_expo
    ) public pure returns (PythStructs.Price memory) {
        return
            PythPrice.affineCombination(x1, y1, x2, y2, x_query, pre_add_expo);
    }

    function cmul(
        PythStructs.Price memory price,
        int64 c,
        int32 e
    ) public pure returns (PythStructs.Price memory) {
        return PythPrice.cmul(price, c, e);
    }
}
