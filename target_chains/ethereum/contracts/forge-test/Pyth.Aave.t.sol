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

contract PythAaveTest is Test, WormholeTestUtils, PythTestUtils, RandTestUtils {
    IPriceOracleGetter public pythOracleGetter;
    IPyth public pyth;
    address[] assets;
    bytes32[] priceIds;
    uint constant NUM_PRICE_FEEDS = 5;
    uint256 constant BASE_CURRENCY_UNIT = 1e8;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(1)));
        assets = new address[](NUM_PRICE_FEEDS);
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
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
            60
        );
    }

    function generateRandomPriceFeedMessage(
        uint numPriceFeeds
    ) internal returns (PriceFeedMessage[] memory priceFeedMessages) {
        priceFeedMessages = new PriceFeedMessage[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i] = PriceFeedMessage({
                priceId: getRandBytes32(),
                price: int64(getRandUint64() / 10), // assuming price should always be positive
                conf: getRandUint64(),
                expo: int32(getRandInt8() % 13), // pyth contract guarantees that expo between [-12, 12]
                publishTime: uint64(1),
                prevPublishTime: getRandUint64(),
                emaPrice: getRandInt64(),
                emaConf: getRandUint64()
            });
        }
    }

    function createWormholeMerkleUpdateData(
        PriceFeedMessage[] memory priceFeedMessages
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        updateData = new bytes[](1);

        uint8 depth = 0;
        while ((1 << depth) < priceFeedMessages.length) {
            depth++;
        }

        depth += getRandUint8() % 3;

        updateData[0] = generateWhMerkleUpdate(priceFeedMessages, depth, 1);

        updateFee = pyth.getUpdateFee(updateData);
    }

    function testGetAssetPriceWorks(uint seed) public {
        setRandSeed(seed);

        for (uint i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 assetPrice = pythOracleGetter.getAssetPrice(asset);
            uint256 price1 = assetPrice / BASE_CURRENCY_UNIT;

            bytes32 priceId = priceIds[i];
            PythStructs.Price memory price = pyth.getPrice(priceId);
            int64 pythPrice = price.price;
            uint pythNormalizer;
            uint price2;
            if (price.expo < 0) {
                pythNormalizer = 10 ** uint32(-price.expo);
                price2 = uint64(pythPrice) / pythNormalizer;
            } else {
                pythNormalizer = 10 ** uint32(price.expo);
                price2 = uint64(pythPrice) * pythNormalizer;
            }
            assertEq(price1, price2);
        }
    }

    function testGetAssetPriceWorksIfGivenUsdAddress() public {
        address usdAddress = address(0x0);
        uint256 assetPrice = pythOracleGetter.getAssetPrice(usdAddress);
        assertEq(assetPrice, BASE_CURRENCY_UNIT);
    }

    function testGetAssetRevertsIfPriceNotRecentEnough() public {
        vm.warp(block.timestamp + 5 days);
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
}
