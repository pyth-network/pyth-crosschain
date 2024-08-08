// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";

contract GasBenchmark is Test, WormholeTestUtils, PythTestUtils {
    // 19, current mainnet number of guardians, is used to have gas estimates
    // close to our mainnet transactions.
    uint8 constant NUM_GUARDIANS = 19;
    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We use 5 prices to form a batch of 5 prices, close to our mainnet transactions.
    uint8 constant NUM_PRICES = 5;

    // We will have less than 512 price for a foreseeable future.
    uint8 constant MERKLE_TREE_DEPTH = 9;

    IWormhole public wormhole;
    IPyth public pyth;

    bytes32[] priceIds;

    // Cached prices are populated in the setUp
    PythStructs.Price[] cachedPrices;
    uint64[] cachedPricesPublishTimes;

    bytes[][] cachedPricesUpdateData; // i th element contains the update data for the first i prices
    bytes[] allCachedPricesUpdateData; // the update data for all prices
    uint[] cachedPricesUpdateFee; // i th element contains the update fee for the first i prices
    uint allCachedPricesUpdateFee; // the update fee for all prices

    // Fresh prices are different prices that can be used
    // as a fresh price to update the prices
    PythStructs.Price[] freshPrices;
    uint64[] freshPricesPublishTimes;
    bytes[][] freshPricesUpdateData; // i th element contains the update data for the first i prices
    bytes[] allFreshPricesUpdateData; // the update data for all prices
    uint[] freshPricesUpdateFee; // i th element contains the update fee for the first i prices
    uint allFreshPricesUpdateFee; // the update fee for all prices

    uint64 sequence;
    uint randomSeed;

    function setUp() public {
        address wormholeAddr = setUpWormholeReceiver(NUM_GUARDIANS);
        wormhole = IWormhole(wormholeAddr);
        pyth = IPyth(setUpPyth(wormholeAddr));

        priceIds = new bytes32[](NUM_PRICES);
        priceIds[0] = bytes32(
            0x1000000000000000000000000000000000000000000000000000000000000f00
        );
        for (uint i = 1; i < NUM_PRICES; ++i) {
            priceIds[i] = bytes32(uint256(priceIds[i - 1]) + 1);
        }

        for (uint i = 0; i < NUM_PRICES; ++i) {
            uint64 publishTime = uint64(getRand() % 10) + 1; // to make sure prevPublishTime is >= 0

            cachedPrices.push(
                PythStructs.Price(
                    int64(uint64(getRand() % 1000)), // Price
                    uint64(getRand() % 100), // Confidence
                    -5, // Expo
                    publishTime
                )
            );
            cachedPricesPublishTimes.push(publishTime);

            publishTime += uint64(getRand() % 10);
            freshPrices.push(
                PythStructs.Price(
                    int64(uint64(getRand() % 1000)), // Price
                    uint64(getRand() % 100), // Confidence
                    -5, // Expo
                    publishTime
                )
            );
            freshPricesPublishTimes.push(publishTime);

            // Generate Wormhole Merkle update data and fee for the first i th prices
            (
                bytes[] memory updateData,
                uint updateFee
            ) = generateUpdateDataAndFee(cachedPrices);

            cachedPricesUpdateData.push(updateData);
            cachedPricesUpdateFee.push(updateFee);

            (updateData, updateFee) = generateUpdateDataAndFee(freshPrices);

            freshPricesUpdateData.push(updateData);
            freshPricesUpdateFee.push(updateFee);
        }
        allCachedPricesUpdateData = cachedPricesUpdateData[NUM_PRICES - 1];
        allCachedPricesUpdateFee = cachedPricesUpdateFee[NUM_PRICES - 1];
        allFreshPricesUpdateData = freshPricesUpdateData[NUM_PRICES - 1];
        allFreshPricesUpdateFee = freshPricesUpdateFee[NUM_PRICES - 1];

        // Populate the contract with the initial prices
        pyth.updatePriceFeeds{value: allCachedPricesUpdateFee}(
            allCachedPricesUpdateData
        );
    }

    function getRand() internal returns (uint val) {
        ++randomSeed;
        val = uint(keccak256(abi.encode(randomSeed)));
    }

    function generateUpdateDataAndFee(
        PythStructs.Price[] memory prices
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        updateData = new bytes[](1);

        updateData[0] = generateWhMerkleUpdate(
            pricesToPriceFeedMessages(priceIds, prices),
            MERKLE_TREE_DEPTH,
            NUM_GUARDIAN_SIGNERS
        );

        updateFee = pyth.getUpdateFee(updateData);
    }

    function testBenchmarkUpdatePriceFeeds1FeedFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee[0]}(
            freshPricesUpdateData[0]
        );
    }

    function testBenchmarkUpdatePriceFeeds2FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee[1]}(
            freshPricesUpdateData[1]
        );
    }

    function testBenchmarkUpdatePriceFeeds3FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee[2]}(
            freshPricesUpdateData[2]
        );
    }

    function testBenchmarkUpdatePriceFeeds4FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee[3]}(
            freshPricesUpdateData[3]
        );
    }

    function testBenchmarkUpdatePriceFeeds5FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee[4]}(
            freshPricesUpdateData[4]
        );
    }

    function testBenchmarkUpdatePriceFeeds1FeedNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee[0]}(
            cachedPricesUpdateData[0]
        );
    }

    function testBenchmarkUpdatePriceFeeds2FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee[1]}(
            cachedPricesUpdateData[1]
        );
    }

    function testBenchmarkUpdatePriceFeeds3FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee[2]}(
            cachedPricesUpdateData[2]
        );
    }

    function testBenchmarkUpdatePriceFeeds4FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee[3]}(
            cachedPricesUpdateData[3]
        );
    }

    function testBenchmarkUpdatePriceFeeds5FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee[4]}(
            cachedPricesUpdateData[4]
        );
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryFresh() public {
        // Since the prices have advanced, the publishTimes are newer than one in
        // the contract and hence, the call should succeed.
        pyth.updatePriceFeedsIfNecessary{value: allFreshPricesUpdateFee}(
            allFreshPricesUpdateData,
            priceIds,
            freshPricesPublishTimes
        );
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryNotFresh() public {
        // Since the price is not advanced, the publishTimes are the same as the
        // ones in the contract.
        vm.expectRevert(PythErrors.NoFreshUpdate.selector);

        pyth.updatePriceFeedsIfNecessary{value: allCachedPricesUpdateFee}(
            allCachedPricesUpdateData,
            priceIds,
            cachedPricesPublishTimes
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeed() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdates{value: allFreshPricesUpdateFee}(
            allFreshPricesUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForTwoPriceFeed() public {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = priceIds[0];
        ids[1] = priceIds[1];

        pyth.parsePriceFeedUpdates{value: allFreshPricesUpdateFee}(
            allFreshPricesUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesUniqueFor() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdatesUnique{value: freshPricesUpdateFee[0]}(
            freshPricesUpdateData[0],
            ids,
            uint64(freshPrices[0].publishTime),
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdatesUniqueForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdatesUnique{value: freshPricesUpdateFee[0]}(
            freshPricesUpdateData[0],
            ids,
            uint64(freshPrices[0].publishTime) - 1,
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdates1() public {
        uint numIds = 1;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[numIds - 1]}(
            freshPricesUpdateData[numIds - 1],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdates2() public {
        uint numIds = 2;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[numIds - 1]}(
            freshPricesUpdateData[numIds - 1],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdates3() public {
        uint numIds = 3;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[numIds - 1]}(
            freshPricesUpdateData[numIds - 1],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdates4() public {
        uint numIds = 4;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[numIds - 1]}(
            freshPricesUpdateData[numIds - 1],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdates5() public {
        uint numIds = 5;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[numIds - 1]}(
            freshPricesUpdateData[numIds - 1],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForAllPriceFeedsShuffledSubsetPriceIds()
        public
    {
        uint numIds = 3;
        bytes32[] memory ids = new bytes32[](numIds);
        ids[0] = priceIds[4];
        ids[1] = priceIds[2];
        ids[2] = priceIds[0];
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[4]}( // updateFee based on number of priceFeeds in updateData
            freshPricesUpdateData[4],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee[0]}(
            freshPricesUpdateData[0],
            ids,
            50,
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForAllPriceFeedsNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: allFreshPricesUpdateFee}(
            allFreshPricesUpdateData,
            ids,
            50,
            100
        );
    }

    function testBenchmarkGetPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // below is set to 60 seconds, the getPriceNoOlderThan should work as expected.
        vm.warp(0);

        pyth.getPriceNoOlderThan(priceIds[0], 60);
    }

    function testBenchmarkGetEmaPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // below is set to 60 seconds, the getEmaPriceNoOlderThan should work as expected.
        vm.warp(0);

        pyth.getEmaPriceNoOlderThan(priceIds[0], 60);
    }

    function testBenchmarkGetUpdateFee1() public view {
        pyth.getUpdateFee(freshPricesUpdateData[0]);
    }

    function testBenchmarkGetUpdateFee2() public view {
        pyth.getUpdateFee(freshPricesUpdateData[1]);
    }

    function testBenchmarkGetUpdateFee3() public view {
        pyth.getUpdateFee(freshPricesUpdateData[2]);
    }

    function testBenchmarkGetUpdateFee4() public view {
        pyth.getUpdateFee(freshPricesUpdateData[3]);
    }

    function testBenchmarkGetUpdateFee5() public view {
        pyth.getUpdateFee(freshPricesUpdateData[4]);
    }
}
