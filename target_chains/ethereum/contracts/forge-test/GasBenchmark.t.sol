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

    IPyth public pyth;

    bytes32[] priceIds;

    // Cached prices are populated in the setUp
    PythStructs.Price[] cachedPrices;
    bytes[] cachedPricesUpdateData;
    uint cachedPricesUpdateFee;
    uint64[] cachedPricesPublishTimes;

    // Fresh prices are different prices that can be used
    // as a fresh price to update the prices
    PythStructs.Price[] freshPrices;
    bytes[] freshPricesUpdateData;
    uint freshPricesUpdateFee;
    uint64[] freshPricesPublishTimes;

    uint64 sequence;
    uint randSeed;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormhole(NUM_GUARDIANS)));

        priceIds = new bytes32[](NUM_PRICES);
        priceIds[0] = bytes32(
            0x1000000000000000000000000000000000000000000000000000000000000f00
        );
        for (uint i = 1; i < NUM_PRICES; ++i) {
            priceIds[i] = bytes32(uint256(priceIds[i - 1]) + 1);
        }

        for (uint i = 0; i < NUM_PRICES; ++i) {
            uint64 publishTime = uint64(getRand() % 10);

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
        }

        // Populate the contract with the initial prices
        (
            cachedPricesUpdateData,
            cachedPricesUpdateFee
        ) = generateUpdateDataAndFee(cachedPrices);
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData
        );

        (
            freshPricesUpdateData,
            freshPricesUpdateFee
        ) = generateUpdateDataAndFee(freshPrices);
    }

    function getRand() internal returns (uint val) {
        ++randSeed;
        val = uint(keccak256(abi.encode(randSeed)));
    }

    function generateUpdateDataAndFee(
        PythStructs.Price[] memory prices
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        bytes memory vaa = generatePriceFeedUpdateVAA(
            pricesToPriceAttestations(priceIds, prices),
            sequence,
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;

        updateData = new bytes[](1);
        updateData[0] = vaa;

        updateFee = pyth.getUpdateFee(updateData);
    }

    function testBenchmarkUpdatePriceFeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee}(
            freshPricesUpdateData
        );
    }

    function testBenchmarkUpdatePriceFeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData
        );
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryFresh() public {
        // Since the prices have advanced, the publishTimes are newer than one in
        // the contract and hence, the call should succeed.
        pyth.updatePriceFeedsIfNecessary{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
            priceIds,
            freshPricesPublishTimes
        );
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryNotFresh() public {
        // Since the price is not advanced, the publishTimes are the same as the
        // ones in the contract.
        vm.expectRevert(PythErrors.NoFreshUpdate.selector);

        pyth.updatePriceFeedsIfNecessary{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData,
            priceIds,
            cachedPricesPublishTimes
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeed() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForTwoPriceFeed() public {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = priceIds[0];
        ids[1] = priceIds[1];

        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
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
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
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

    function testBenchmarkGetUpdateFee() public view {
        pyth.getUpdateFee(freshPricesUpdateData);
    }
}
