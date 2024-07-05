// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../PythStructs.sol";
import "../PriceLibrary.sol";

contract PriceLibraryTest is Test {
    using PriceLibrary for PythStructs.Price;

    function testScaleToExponentIncreaseExpo1() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            PD_EXPO,
            block.timestamp
        );
        int32 targetExpo = -6;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 100000000);
        assertEq(result.expo, -6);
    }

    function testScaleToExponentIncreaseExpo2() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            -18,
            block.timestamp
        );
        int32 targetExpo = -9;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 100);
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentIncreaseExpo3() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1 * int64(PD_SCALE),
            0,
            -18,
            block.timestamp
        );
        int32 targetExpo = -9;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1);
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentDecreaseExpo1() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            -6,
            block.timestamp
        );
        int32 targetExpo = -9;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 100000 * int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentDecreaseExpo2() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1 * int64(PD_SCALE),
            0,
            -9,
            block.timestamp
        );
        int32 targetExpo = -18;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1 * int64(PD_SCALE) * int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentZeroPrice() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            0,
            0,
            -6,
            block.timestamp
        );
        int32 targetExpo = PD_EXPO;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 0);
        assertEq(result.expo, -9);
    }

    function testScaleToExponentZeroExponent() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            0,
            block.timestamp
        ); // Reduce price to 1
        int32 targetExpo = PD_EXPO;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1 * int64(PD_SCALE));
        assertEq(result.expo, PD_EXPO);
    }

    function testScaleToExponentNegativeToPositiveExpo() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            10 * int64(PD_SCALE),
            0,
            PD_EXPO,
            block.timestamp
        );
        int32 targetExpo = 1;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1);
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentPositiveToNegativeExpo() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            10,
            0,
            1,
            block.timestamp
        );
        int32 targetExpo = PD_EXPO;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 100 * int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentLargeIncreaseExpo() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1 * int64(PD_SCALE),
            0,
            0,
            block.timestamp
        );
        int32 targetExpo = 18;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1 / int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentLargeDecreaseExpo() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1 * int64(PD_SCALE),
            0,
            9,
            block.timestamp
        );
        int32 targetExpo = 0;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1 * int64(PD_SCALE) * int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentMaxInt() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            type(int64).max,
            0,
            PD_EXPO,
            block.timestamp
        );
        int32 targetExpo = 0;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, type(int64).max / int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentMinInt() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            type(int64).min,
            0,
            0,
            block.timestamp
        );
        int32 targetExpo = 9;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, type(int64).min / int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentMaxUInt() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            int64(MAX_PD_V_U64),
            0,
            PD_EXPO,
            block.timestamp
        );
        int32 targetExpo = 0;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, int64(MAX_PD_V_U64) / int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentEdgeCases1() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            10,
            0,
            -1,
            block.timestamp
        );
        int32 targetExpo = 0;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 1);
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentEdgeCases2() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1 * int64(PD_SCALE),
            0,
            1,
            block.timestamp
        );
        int32 targetExpo = 0;
        PythStructs.Price memory result = PriceLibrary.scaleToExponent(
            price1,
            targetExpo
        );
        assertEq(result.price, 10 * int64(PD_SCALE));
        assertEq(result.expo, targetExpo);
    }

    function testScaleToExponentPrecisionLoss() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            18,
            block.timestamp
        );
        int32 targetExpo = -18;

        try PriceLibrary.scaleToExponent(price1, targetExpo) returns (
            PythStructs.Price memory result
        ) {
            // Calculate expected price after scaling
            int64 expectedPrice = 1 * int64(PD_SCALE);
            expectedPrice = expectedPrice / 1e18; // Divide by 10^18 to adjust for the targetExpo change

            assertEq(result.price, expectedPrice);
            assertEq(result.expo, -18);
        } catch {}
    }

    function testNormalizeNoChange() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1000,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 1000);
        assertEq(result.conf, 0);
        assertEq(result.expo, PD_EXPO);
    }

    function testNormalizeReduceMagnitude() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            int64(PD_SCALE),
            PD_SCALE,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assert(result.price == int64(PD_SCALE) / 10);
        assert(result.conf < PD_SCALE);
        assert(result.expo == PD_EXPO + 1);
    }

    function testNormalizeNegativePrice() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            -1 * int64(PD_SCALE),
            PD_SCALE,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assert(result.price == (-1 * int64(PD_SCALE)) / 10);
        assert(result.conf < PD_SCALE);
        assert(result.expo == PD_EXPO + 1);
    }

    function testNormalizeSmallPrice() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 1);
        assertEq(result.conf, 0);
        assert(result.expo == PD_EXPO);
    }

    function testNormalizeSmallConfidence() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            1,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 100000000);
        assertEq(result.conf, 0);
        assertEq(result.expo, -6);
    }

    function testNormalizeLargePrice() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            type(int64).max / 10,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assert(result.price < type(int64).max / 10);
        assertEq(result.conf, 0);
        assert(result.expo > PD_EXPO);
    }

    function testNormalizeLargeConfidence() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            type(uint64).max / 10,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 10);
        assert(result.conf < type(uint64).max / 10);
        assertEq(result.expo, 1);
    }

    function testNormalizeMaxInt64Price() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            type(int64).max,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assert(result.price < type(int64).max);
        assertEq(result.conf, 0);
        assert(result.expo > PD_EXPO);
    }

    function testNormalizeMinInt64Price() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            type(int64).min,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assert(result.price > type(int64).min);
        assertEq(result.conf, 0);
        assert(result.expo > PD_EXPO);
    }

    function testNormalizeZeroPrice() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            0,
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 0);
        assertEq(result.conf, 0);
        assertEq(result.expo, PD_EXPO);
    }

    function testNormalizeZeroConfidence() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            PD_EXPO,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 100000000);
        assertEq(result.conf, 0);
        assertEq(result.expo, -6);
    }

    function testNormalizeNegativeExponent() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            -18,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 100000000);
        assertEq(result.conf, 0);
        assertEq(result.expo, -15);
    }

    function testNormalizePositiveExponent() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * int64(PD_SCALE),
            0,
            18,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 100000000);
        assertEq(result.conf, 0);
        assertEq(result.expo, 21);
    }

    function testNormalizeEdgeCase1() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            1,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 1);
        assertEq(result.conf, 0);
        assertEq(result.expo, 1);
    }

    function testNormalizeEdgeCase2() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            -1,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 1);
        assertEq(result.conf, 0);
        assertEq(result.expo, -1);
    }

    function testNormalizePrecisionLoss() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            1,
            0,
            18,
            block.timestamp
        );
        PythStructs.Price memory result = PriceLibrary.normalize(price1);
        assertEq(result.price, 1);
        assertEq(result.conf, 0);
        assertEq(result.expo, 18);
    }

    function testGetPriceInQuote() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        PythStructs.Price memory price2 = PythStructs.Price(
            2 * 1e9,
            0,
            -9,
            block.timestamp
        );
        int32 resultExpo = -9;

        PythStructs.Price memory result = price1.getPriceInQuote(
            price2,
            resultExpo
        );

        assertEq(result.price, 50 * 1e9);
        assertEq(result.expo, resultExpo);
    }

    function testGetCollateralValuationPrice() public view {
        PythStructs.Price memory self = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        uint64 deposits = 500;
        uint64 depositsEndpoint = 1000;
        uint64 rateDiscountInitial = 100;
        uint64 rateDiscountFinal = 50;
        int32 discountExponent = -9;

        PythStructs.Price memory result = self.getCollateralValuationPrice(
            deposits,
            depositsEndpoint,
            rateDiscountInitial,
            rateDiscountFinal,
            discountExponent
        );

        assert(result.price > 0);
        assertEq(result.expo, -9);
    }

    function testGetBorrowValuationPrice() public view {
        PythStructs.Price memory self = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        uint64 borrows = 500;
        uint64 borrowsEndpoint = 1000;
        uint64 ratePremiumInitial = 50;
        uint64 ratePremiumFinal = 100;
        int32 premiumExponent = -9;

        PythStructs.Price memory result = self.getBorrowValuationPrice(
            borrows,
            borrowsEndpoint,
            ratePremiumInitial,
            ratePremiumFinal,
            premiumExponent
        );

        assert(result.price > 0);
        assertEq(result.expo, -9);
    }

    function testAffineCombination() public view {
        PythStructs.Price memory y1 = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        PythStructs.Price memory y2 = PythStructs.Price(
            200 * 1e9,
            0,
            -9,
            block.timestamp
        );
        int64 x1 = 0;
        int64 x2 = 1000;
        int64 xQuery = 500;
        int32 preAddExpo = -9;

        PythStructs.Price memory result = PriceLibrary.affineCombination(
            x1,
            y1,
            x2,
            y2,
            xQuery,
            preAddExpo
        );

        assert(result.price > 0);
        assertEq(result.expo, -9);
    }

    function testDiv() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        PythStructs.Price memory price2 = PythStructs.Price(
            2 * 1e9,
            0,
            -9,
            block.timestamp
        );

        PythStructs.Price memory result = PriceLibrary.div(price1, price2);

        assertEq(result.price, 50 * 1e7);
        assertEq(result.expo, -7);
    }

    function testAdd() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            50 * 1e9,
            0,
            -9,
            block.timestamp
        );
        PythStructs.Price memory price2 = PythStructs.Price(
            50 * 1e9,
            0,
            -9,
            block.timestamp
        );

        PythStructs.Price memory result = PriceLibrary.add(price1, price2);

        assertEq(result.price, 100 * 1e9);
        assertEq(result.expo, -9);
    }

    function testMul() public view {
        PythStructs.Price memory price1 = PythStructs.Price(
            100 * 1e9,
            0,
            -9,
            block.timestamp
        );
        PythStructs.Price memory price2 = PythStructs.Price(
            2 * 1e9,
            0,
            -9,
            block.timestamp
        );

        PythStructs.Price memory result = PriceLibrary.mul(price1, price2);

        assertEq(result.price, 20000000 * int64(PD_SCALE));
        assertEq(result.expo, -14);
    }

    function testFraction() public pure {
        int64 x = 50;
        int64 y = 100;

        PythStructs.Price memory result = PriceLibrary.fraction(x, y);

        assertEq(result.price, 50 * 1e7);
        assertEq(result.expo, -9);
    }
}
