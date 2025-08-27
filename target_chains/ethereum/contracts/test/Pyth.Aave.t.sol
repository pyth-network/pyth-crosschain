// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";

import "../contracts/aave/interfaces/IPriceOracleGetter.sol";
import "../contracts/aave/PythPriceOracleGetter.sol";
import "./Pyth.WormholeMerkleAccumulator.t.sol";

contract PythAaveTest is PythWormholeMerkleAccumulatorTest {
    IPriceOracleGetter public pythOracleGetter;
    address[] assets;
    bytes32[] priceIds;
    uint constant NUM_PRICE_FEEDS = 5;
    uint256 constant BASE_CURRENCY_UNIT = 1e8;
    uint constant VALID_TIME_PERIOD_SECS = 60;

    function setUp() public override {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(1)));
        assets = new address[](NUM_PRICE_FEEDS);
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomBoundedPriceFeedMessage(
                NUM_PRICE_FEEDS
            );
        priceIds = new bytes32[](NUM_PRICE_FEEDS);

        for (uint i = 0; i < NUM_PRICE_FEEDS; i++) {
            assets[i] = address(
                uint160(uint(keccak256(abi.encodePacked(i + NUM_PRICE_FEEDS))))
            );
            priceIds[i] = priceFeedMessages[i].priceId;
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            BASE_CURRENCY_UNIT,
            VALID_TIME_PERIOD_SECS
        );
    }

    function testConversion(
        int64 pythPrice,
        int32 pythExpo,
        uint256 aavePrice,
        uint256 baseCurrencyUnit
    ) private {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        PriceFeedMessage memory priceFeedMessage = PriceFeedMessage({
            priceId: getRandBytes32(),
            price: pythPrice,
            conf: getRandUint64(),
            expo: pythExpo,
            publishTime: uint64(1),
            prevPublishTime: getRandUint64(),
            emaPrice: getRandInt64(),
            emaConf: getRandUint64()
        });
        priceFeedMessages[0] = priceFeedMessage;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessage.priceId;
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            baseCurrencyUnit,
            VALID_TIME_PERIOD_SECS
        );

        assertEq(pythOracleGetter.getAssetPrice(assets[0]), aavePrice);
    }

    function testGetAssetPriceWorks() public {
        // "display" price is 529.30903
        testConversion(52_930_903, -5, 52_930_903_000, BASE_CURRENCY_UNIT);
    }

    function testGetAssetPriceWorksWithPositiveExponent() public {
        // "display" price is 5_293_000
        testConversion(5_293, 3, 529_300_000_000_000, BASE_CURRENCY_UNIT);
    }

    function testGetAssetPriceWorksWithZeroExponent() public {
        // "display" price is 5_293
        testConversion(5_293, 0, 529_300_000_000, BASE_CURRENCY_UNIT);
    }

    function testGetAssetPriceWorksWithNegativeNormalizerExponent() public {
        // "display" price is 5_293
        testConversion(
            5_293_000_000_000_000,
            -12,
            529_300_000_000,
            BASE_CURRENCY_UNIT
        );
    }

    function testGetAssetPriceWorksWithBaseCurrencyUnitOfOne() public {
        // "display" price is 529.30903
        testConversion(52_930_903, -5, 529, 1);
    }

    function testGetAssetPriceWorksWithBoundedRandomValues(uint seed) public {
        setRandSeed(seed);

        for (uint i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 assetPrice = pythOracleGetter.getAssetPrice(asset);
            uint256 aavePrice = assetPrice / BASE_CURRENCY_UNIT;

            bytes32 priceId = priceIds[i];
            PythStructs.Price memory price = pyth.getPriceNoOlderThan(
                priceId,
                60
            );
            int64 pythRawPrice = price.price;
            uint pythNormalizer;
            uint pythPrice;
            if (price.expo < 0) {
                pythNormalizer = 10 ** uint32(-price.expo);
                pythPrice = uint64(pythRawPrice) / pythNormalizer;
            } else {
                pythNormalizer = 10 ** uint32(price.expo);
                pythPrice = uint64(pythRawPrice) * pythNormalizer;
            }
            assertEq(aavePrice, pythPrice);
        }
    }

    function testGetAssetPriceWorksIfGivenBaseCurrencyAddress() public {
        address usdAddress = address(0x0);
        uint256 assetPrice = pythOracleGetter.getAssetPrice(usdAddress);
        assertEq(assetPrice, BASE_CURRENCY_UNIT);
    }

    function testGetAssetRevertsIfPriceNotRecentEnough() public {
        uint timestamp = block.timestamp;
        vm.warp(timestamp + VALID_TIME_PERIOD_SECS);
        for (uint i = 0; i < assets.length; i++) {
            pythOracleGetter.getAssetPrice(assets[i]);
        }
        vm.warp(timestamp + VALID_TIME_PERIOD_SECS + 1);
        for (uint i = 0; i < assets.length; i++) {
            vm.expectRevert(PythErrors.StalePrice.selector);
            pythOracleGetter.getAssetPrice(assets[i]);
        }
    }

    function testGetAssetRevertsIfPriceFeedNotFound() public {
        address addr = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );
        vm.expectRevert(PythErrors.PriceFeedNotFound.selector);
        pythOracleGetter.getAssetPrice(addr);
    }

    function testGetAssetPriceRevertsIfPriceIsNegative() public {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        PriceFeedMessage memory priceFeedMessage = PriceFeedMessage({
            priceId: getRandBytes32(),
            price: int64(-5),
            conf: getRandUint64(),
            expo: getRandInt32(),
            publishTime: uint64(1),
            prevPublishTime: getRandUint64(),
            emaPrice: getRandInt64(),
            emaConf: getRandUint64()
        });

        priceFeedMessages[0] = priceFeedMessage;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessage.priceId;
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            BASE_CURRENCY_UNIT,
            VALID_TIME_PERIOD_SECS
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidNonPositivePrice()"));
        pythOracleGetter.getAssetPrice(assets[0]);
    }

    function testGetAssetPriceRevertsIfNormalizerOverflows() public {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        PriceFeedMessage memory priceFeedMessage = PriceFeedMessage({
            priceId: getRandBytes32(),
            price: int64(1),
            conf: getRandUint64(),
            expo: int32(59), // type(uint192).max = ~6.27e58
            publishTime: uint64(1),
            prevPublishTime: getRandUint64(),
            emaPrice: getRandInt64(),
            emaConf: getRandUint64()
        });

        priceFeedMessages[0] = priceFeedMessage;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessage.priceId;
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            BASE_CURRENCY_UNIT,
            VALID_TIME_PERIOD_SECS
        );

        vm.expectRevert(abi.encodeWithSignature("NormalizationOverflow()"));
        pythOracleGetter.getAssetPrice(assets[0]);
    }

    function testGetAssetPriceRevertsIfNormalizedToZero() public {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        PriceFeedMessage memory priceFeedMessage = PriceFeedMessage({
            priceId: getRandBytes32(),
            price: int64(1),
            conf: getRandUint64(),
            expo: int32(-75),
            publishTime: uint64(1),
            prevPublishTime: getRandUint64(),
            emaPrice: getRandInt64(),
            emaConf: getRandUint64()
        });

        priceFeedMessages[0] = priceFeedMessage;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessage.priceId;
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            BASE_CURRENCY_UNIT,
            VALID_TIME_PERIOD_SECS
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidNonPositivePrice()"));
        pythOracleGetter.getAssetPrice(assets[0]);
    }

    function testPythPriceOracleGetterConstructorRevertsIfAssetsAndPriceIdsLengthAreDifferent()
        public
    {
        priceIds = new bytes32[](2);
        priceIds[0] = getRandBytes32();
        priceIds[1] = getRandBytes32();
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        vm.expectRevert(abi.encodeWithSignature("InconsistentParamsLength()"));
        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            BASE_CURRENCY_UNIT,
            VALID_TIME_PERIOD_SECS
        );
    }

    function testPythPriceOracleGetterConstructorRevertsIfInvalidBaseCurrencyUnit()
        public
    {
        priceIds = new bytes32[](1);
        priceIds[0] = getRandBytes32();
        assets = new address[](1);
        assets[0] = address(
            uint160(uint(keccak256(abi.encodePacked(uint(100)))))
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidBaseCurrencyUnit()"));
        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            0,
            VALID_TIME_PERIOD_SECS
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidBaseCurrencyUnit()"));
        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            11,
            VALID_TIME_PERIOD_SECS
        );

        vm.expectRevert(abi.encodeWithSignature("InvalidBaseCurrencyUnit()"));
        pythOracleGetter = new PythPriceOracleGetter(
            address(pyth),
            assets,
            priceIds,
            address(0x0),
            20,
            VALID_TIME_PERIOD_SECS
        );
    }
}
