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

    bytes[][] cachedPricesWhMerkleUpdateData; // i th element contains the update data for the first i prices
    bytes[] allCachedPricesWhMerkleUpdateData; // the update data for all prices
    uint[] cachedPricesWhMerkleUpdateFee; // i th element contains the update fee for the first i prices
    uint allCachedPricesWhMerkleUpdateFee; // the update fee for all prices

    // Fresh prices are different prices that can be used
    // as a fresh price to update the prices
    PythStructs.Price[] freshPrices;
    uint64[] freshPricesPublishTimes;
    bytes[][] freshPricesWhMerkleUpdateData; // i th element contains the update data for the first i prices
    bytes[] allFreshPricesWhMerkleUpdateData; // the update data for all prices
    uint[] freshPricesWhMerkleUpdateFee; // i th element contains the update fee for the first i prices
    uint allFreshPricesWhMerkleUpdateFee; // the update fee for all prices

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
            ) = generateWhMerkleUpdateDataAndFee(cachedPrices);

            cachedPricesWhMerkleUpdateData.push(updateData);
            cachedPricesWhMerkleUpdateFee.push(updateFee);

            (updateData, updateFee) = generateWhMerkleUpdateDataAndFee(
                freshPrices
            );

            freshPricesWhMerkleUpdateData.push(updateData);
            freshPricesWhMerkleUpdateFee.push(updateFee);
        }
        allCachedPricesWhMerkleUpdateData = cachedPricesWhMerkleUpdateData[
            NUM_PRICES - 1
        ];
        allCachedPricesWhMerkleUpdateFee = cachedPricesWhMerkleUpdateFee[
            NUM_PRICES - 1
        ];
        allFreshPricesWhMerkleUpdateData = freshPricesWhMerkleUpdateData[
            NUM_PRICES - 1
        ];
        allFreshPricesWhMerkleUpdateFee = freshPricesWhMerkleUpdateFee[
            NUM_PRICES - 1
        ];

        // Populate the contract with the initial prices
        pyth.updatePriceFeeds{value: allCachedPricesWhMerkleUpdateFee}(
            allCachedPricesWhMerkleUpdateData
        );
    }

    function getRand() internal returns (uint val) {
        ++randomSeed;
        val = uint(keccak256(abi.encode(randomSeed)));
    }

    function generateWhMerkleUpdateDataAndFee(
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

    function testBenchmarkUpdatePriceFeedsWhMerkle1FeedFresh() public {
        pyth.updatePriceFeeds{value: freshPricesWhMerkleUpdateFee[0]}(
            freshPricesWhMerkleUpdateData[0]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle2FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesWhMerkleUpdateFee[1]}(
            freshPricesWhMerkleUpdateData[1]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle3FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesWhMerkleUpdateFee[2]}(
            freshPricesWhMerkleUpdateData[2]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle4FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesWhMerkleUpdateFee[3]}(
            freshPricesWhMerkleUpdateData[3]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle5FeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesWhMerkleUpdateFee[4]}(
            freshPricesWhMerkleUpdateData[4]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle1FeedNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesWhMerkleUpdateFee[0]}(
            cachedPricesWhMerkleUpdateData[0]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle2FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesWhMerkleUpdateFee[1]}(
            cachedPricesWhMerkleUpdateData[1]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle3FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesWhMerkleUpdateFee[2]}(
            cachedPricesWhMerkleUpdateData[2]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle4FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesWhMerkleUpdateFee[3]}(
            cachedPricesWhMerkleUpdateData[3]
        );
    }

    function testBenchmarkUpdatePriceFeedsWhMerkle5FeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesWhMerkleUpdateFee[4]}(
            cachedPricesWhMerkleUpdateData[4]
        );
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryWhMerkleFresh() public {
        // Since the prices have advanced, the publishTimes are newer than one in
        // the contract and hence, the call should succeed.
        pyth.updatePriceFeedsIfNecessary{
            value: allFreshPricesWhMerkleUpdateFee
        }(allFreshPricesWhMerkleUpdateData, priceIds, freshPricesPublishTimes);
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryWhMerkleNotFresh() public {
        // Since the price is not advanced, the publishTimes are the same as the
        // ones in the contract.
        vm.expectRevert(PythErrors.NoFreshUpdate.selector);

        pyth.updatePriceFeedsIfNecessary{
            value: allCachedPricesWhMerkleUpdateFee
        }(
            allCachedPricesWhMerkleUpdateData,
            priceIds,
            cachedPricesPublishTimes
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeed() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdates{value: allFreshPricesWhMerkleUpdateFee}(
            allFreshPricesWhMerkleUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForTwoPriceFeed() public {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = priceIds[0];
        ids[1] = priceIds[1];

        pyth.parsePriceFeedUpdates{value: allFreshPricesWhMerkleUpdateFee}(
            allFreshPricesWhMerkleUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesUniqueForWhMerkle() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdatesUnique{
            value: freshPricesWhMerkleUpdateFee[0]
        }(
            freshPricesWhMerkleUpdateData[0],
            ids,
            uint64(freshPrices[0].publishTime),
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdatesUniqueWhMerkleForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdatesUnique{
            value: freshPricesWhMerkleUpdateFee[0]
        }(
            freshPricesWhMerkleUpdateData[0],
            ids,
            uint64(freshPrices[0].publishTime) - 1,
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForWhMerkle1() public {
        uint numIds = 1;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{
            value: freshPricesWhMerkleUpdateFee[numIds - 1]
        }(freshPricesWhMerkleUpdateData[numIds - 1], ids, 0, 50);
    }

    function testBenchmarkParsePriceFeedUpdatesForWhMerkle2() public {
        uint numIds = 2;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{
            value: freshPricesWhMerkleUpdateFee[numIds - 1]
        }(freshPricesWhMerkleUpdateData[numIds - 1], ids, 0, 50);
    }

    function testBenchmarkParsePriceFeedUpdatesForWhMerkle3() public {
        uint numIds = 3;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{
            value: freshPricesWhMerkleUpdateFee[numIds - 1]
        }(freshPricesWhMerkleUpdateData[numIds - 1], ids, 0, 50);
    }

    function testBenchmarkParsePriceFeedUpdatesForWhMerkle4() public {
        uint numIds = 4;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{
            value: freshPricesWhMerkleUpdateFee[numIds - 1]
        }(freshPricesWhMerkleUpdateData[numIds - 1], ids, 0, 50);
    }

    function testBenchmarkParsePriceFeedUpdatesForWhMerkle5() public {
        uint numIds = 5;

        bytes32[] memory ids = new bytes32[](numIds);
        for (uint i = 0; i < numIds; i++) {
            ids[i] = priceIds[i];
        }
        pyth.parsePriceFeedUpdates{
            value: freshPricesWhMerkleUpdateFee[numIds - 1]
        }(freshPricesWhMerkleUpdateData[numIds - 1], ids, 0, 50);
    }

    function testBenchmarkParsePriceFeedUpdatesForAllPriceFeedsShuffledSubsetPriceIds()
        public
    {
        uint numIds = 3;
        bytes32[] memory ids = new bytes32[](numIds);
        ids[0] = priceIds[4];
        ids[1] = priceIds[2];
        ids[2] = priceIds[0];
        pyth.parsePriceFeedUpdates{value: freshPricesWhMerkleUpdateFee[4]}( // updateFee based on number of priceFeeds in updateData
            freshPricesWhMerkleUpdateData[4],
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesWhMerkleForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: freshPricesWhMerkleUpdateFee[0]}(
            freshPricesWhMerkleUpdateData[0],
            ids,
            50,
            100
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: allFreshPricesWhMerkleUpdateFee}(
            allFreshPricesWhMerkleUpdateData,
            ids,
            50,
            100
        );
    }

    function testBenchmarkGetPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // is set to 60 seconds, the getPrice should work as expected.
        vm.warp(0);

        pyth.getPrice(priceIds[0]);
    }

    function testBenchmarkGetEmaPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // is set to 60 seconds, the getPrice should work as expected.
        vm.warp(0);

        pyth.getEmaPrice(priceIds[0]);
    }

    function testBenchmarkGetUpdateFeeWhMerkle1() public view {
        pyth.getUpdateFee(freshPricesWhMerkleUpdateData[0]);
    }

    function testBenchmarkGetUpdateFeeWhMerkle2() public view {
        pyth.getUpdateFee(freshPricesWhMerkleUpdateData[1]);
    }

    function testBenchmarkGetUpdateFeeWhMerkle3() public view {
        pyth.getUpdateFee(freshPricesWhMerkleUpdateData[2]);
    }

    function testBenchmarkGetUpdateFeeWhMerkle4() public view {
        pyth.getUpdateFee(freshPricesWhMerkleUpdateData[3]);
    }

    function testBenchmarkGetUpdateFeeWhMerkle5() public view {
        pyth.getUpdateFee(freshPricesWhMerkleUpdateData[4]);
    }
}
