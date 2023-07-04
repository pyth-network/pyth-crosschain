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

    function testGetAssetPriceWorks() public {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        // "display" price is 529.30903
        PriceFeedMessage memory priceFeedMessage = PriceFeedMessage({
            priceId: getRandBytes32(),
            price: int64(52_930_903),
            conf: getRandUint64(),
            expo: int32(-5),
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

        uint256 aavePrice = pythOracleGetter.getAssetPrice(assets[0]);
        assertEq(aavePrice, 52_930_903_000);
    }

    function testGetAssetPriceWorksWithBoundedRandomValues(uint seed) public {
        setRandSeed(seed);

        for (uint i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 assetPrice = pythOracleGetter.getAssetPrice(asset);
            uint256 aavePrice = assetPrice / BASE_CURRENCY_UNIT;

            bytes32 priceId = priceIds[i];
            PythStructs.Price memory price = pyth.getPrice(priceId);
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
            price: int64(-5), // assuming price should always be positive
            conf: getRandUint64(),
            expo: int32(getRandInt8() % 13), // pyth contract guarantees that expo between [-12, 12]
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
}
