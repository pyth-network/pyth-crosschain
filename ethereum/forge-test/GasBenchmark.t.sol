// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
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
    uint8 constant NO_PRICES = 5;

    uint constant BENCHMARK_ITERATIONS = 1000;

    IPyth public pyth;
    
    bytes32[] priceIds;
    PythStructs.Price[] prices;
    uint64 sequence;
    uint randSeed;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormhole(NUM_GUARDIANS)));

        priceIds = new bytes32[](NO_PRICES);
        priceIds[0] = bytes32(0x1000000000000000000000000000000000000000000000000000000000000f00);
        for (uint i = 1; i < NO_PRICES; ++i) {
            priceIds[i] = bytes32(uint256(priceIds[i-1])+1);
        }

        for (uint i = 0; i < NO_PRICES; ++i) {
            prices.push(PythStructs.Price(
                int64(uint64(getRand() % 1000)), // Price
                uint64(getRand() % 100), // Confidence
                -5, // Expo
                getRand() % 10 // publishTime
            ));
        }
    }

    function getRand() internal returns (uint val) {
        ++randSeed;
        val = uint(keccak256(abi.encode(randSeed)));
    }

    function advancePrices() internal {
        for (uint i = 0; i < NO_PRICES; ++i) {
            prices[i].price = int64(uint64(getRand() % 1000));
            prices[i].conf = uint64(getRand() % 100);
            prices[i].publishTime += getRand() % 10;
        }
    }

    function generateUpdateDataAndFee() internal returns (bytes[] memory updateData, uint updateFee) {
        bytes memory vaa = generatePriceFeedUpdateVAA(
            priceIds,
            prices,
            sequence,
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;
        
        updateData = new bytes[](1);
        updateData[0] = vaa;

        updateFee = pyth.getUpdateFee(updateData);
    }

    function testBenchmarkUpdatePriceFeedsFresh() public {
        for (uint i = 0; i < BENCHMARK_ITERATIONS; ++i) {
            advancePrices();

            (bytes[] memory updateData, uint updateFee) = generateUpdateDataAndFee();
            pyth.updatePriceFeeds{value: updateFee}(updateData);
        }
    }

    function testBenchmarkUpdatePriceFeedsNotFresh() public {
        for (uint i = 0; i < BENCHMARK_ITERATIONS; ++i) {
            (bytes[] memory updateData, uint updateFee) = generateUpdateDataAndFee();
            pyth.updatePriceFeeds{value: updateFee}(updateData);
        }
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryFresh() public {
        for (uint i = 0; i < BENCHMARK_ITERATIONS; ++i) {
            advancePrices();

            uint64[] memory publishTimes = new uint64[](NO_PRICES);
            
            for (uint j = 0; j < NO_PRICES; ++j) {
                publishTimes[j] = uint64(prices[j].publishTime);
            }

            (bytes[] memory updateData, uint updateFee) = generateUpdateDataAndFee();

            // Since the prices have advanced, the publishTimes are newer than one in
            // the contract and hence, the call should succeed.
            pyth.updatePriceFeedsIfNecessary{value: updateFee}(updateData, priceIds, publishTimes);
        }
    }

    function testBenchmarkUpdatePriceFeedsIfNecessaryNotFresh() public {
        for (uint i = 0; i < BENCHMARK_ITERATIONS; ++i) {
            uint64[] memory publishTimes = new uint64[](NO_PRICES);
            
            for (uint j = 0; j < NO_PRICES; ++j) {
                publishTimes[j] = uint64(prices[j].publishTime);
            }

            (bytes[] memory updateData, uint updateFee) = generateUpdateDataAndFee();

            // Since the price is not advanced, the publishTimes are the same as the
            // ones in the contract except the first update.
            if (i > 0) {
                vm.expectRevert(bytes("no prices in the submitted batch have fresh prices, so this update will have no effect"));
            }
    
            pyth.updatePriceFeedsIfNecessary{value: updateFee}(updateData, priceIds, publishTimes);
        }
    }

    function testBenchmarkGetPrice() public {
        (bytes[] memory updateData, uint updateFee) = generateUpdateDataAndFee();
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        // Set the block timestamp to the publish time, so getPrice work as expected.
        vm.warp(prices[0].publishTime);

        for (uint i = 0; i < BENCHMARK_ITERATIONS; ++i) {
            pyth.getPrice(priceIds[getRand() % NO_PRICES]);
        }
    }
}
