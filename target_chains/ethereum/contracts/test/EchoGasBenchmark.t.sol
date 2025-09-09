// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/echo/EchoUpgradeable.sol";
import "../contracts/echo/IEcho.sol";
import "../contracts/echo/EchoState.sol";
import "../contracts/echo/EchoEvents.sol";
import "../contracts/echo/EchoErrors.sol";
import "./utils/EchoTestUtils.sol";
import {console} from "forge-std/console.sol";
contract EchoGasBenchmark is Test, EchoTestUtils {
    ERC1967Proxy public proxy;
    EchoUpgradeable public echo;
    IEchoConsumer public consumer;

    address public owner;
    address public admin;
    address public pyth;
    address public defaultProvider;

    uint96 constant PYTH_FEE = 1 wei;
    uint96 constant DEFAULT_PROVIDER_FEE_PER_GAS = 1 wei;
    uint96 constant DEFAULT_PROVIDER_BASE_FEE = 1 wei;
    uint96 constant DEFAULT_PROVIDER_FEE_PER_FEED = 10 wei;

    function setUp() public {
        owner = address(1);
        admin = address(2);
        pyth = address(3);
        defaultProvider = address(4);
        EchoUpgradeable _echo = new EchoUpgradeable();
        proxy = new ERC1967Proxy(address(_echo), "");
        echo = EchoUpgradeable(address(proxy));

        echo.initialize(
            owner,
            admin,
            PYTH_FEE,
            pyth,
            defaultProvider,
            true,
            15
        );
        vm.prank(defaultProvider);
        echo.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );
        consumer = new VoidEchoConsumer(address(proxy));
    }

    // Estimate how much gas is used by all of the data mocking functionality in the other gas benchmarks.
    // Subtract this amount from the gas benchmarks to estimate the true usage of the echo flow.
    function testDataMocking() public {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        createPriceIds();

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        createMockUpdateData(priceFeeds);
    }

    // Helper function to run the basic request + fulfill flow with a specified number of feeds
    function _runBenchmarkWithFeeds(uint256 numFeeds) internal {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        bytes32[] memory priceIds = createPriceIds(numFeeds);

        uint32 callbackGasLimit = 100000;
        uint96 totalFee = echo.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );
        vm.deal(address(consumer), 1 ether);
        vm.prank(address(consumer));
        uint64 sequenceNumber = echo.requestPriceUpdatesWithCallback{
            value: totalFee
        }(defaultProvider, timestamp, priceIds, callbackGasLimit);

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp,
            numFeeds
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testBasicFlowWith01Feeds() public {
        _runBenchmarkWithFeeds(1);
    }

    function testBasicFlowWith02Feeds() public {
        _runBenchmarkWithFeeds(2);
    }

    function testBasicFlowWith04Feeds() public {
        _runBenchmarkWithFeeds(4);
    }

    function testBasicFlowWith08Feeds() public {
        _runBenchmarkWithFeeds(8);
    }

    function testBasicFlowWith10Feeds() public {
        _runBenchmarkWithFeeds(10);
    }

    // This test checks the gas usage for worst-case out-of-order fulfillment.
    // It creates 10 requests, and then fulfills them in reverse order.
    //
    // The last fulfillment will be the most expensive since it needs
    // to linearly scan through all the fulfilled requests in storage
    // in order to update _state.lastUnfulfilledReq
    //
    // NOTE: Run test with `forge test --gas-report --match-test testMultipleRequestsOutOfOrderFulfillment`
    // and observe the `max` value for `executeCallback` to see the cost of the most expensive request.
    function testMultipleRequestsOutOfOrderFulfillment() public {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        bytes32[] memory priceIds = createPriceIds(2);
        uint32 callbackGasLimit = 100000;
        uint128 totalFee = echo.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );

        // Create 10 requests
        uint64[] memory sequenceNumbers = new uint64[](10);
        vm.deal(address(consumer), 10 ether);

        for (uint i = 0; i < 10; i++) {
            vm.prank(address(consumer));
            sequenceNumbers[i] = echo.requestPriceUpdatesWithCallback{
                value: totalFee
            }(
                defaultProvider,
                timestamp + uint64(i),
                priceIds,
                callbackGasLimit
            );
        }

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Execute callbacks in reverse
        uint startGas = gasleft();
        for (uint i = 9; i > 0; i--) {
            echo.executeCallback(
                defaultProvider,
                sequenceNumbers[i],
                updateData,
                priceIds
            );
        }
        uint midGas = gasleft();

        // Execute the first request last - this would be the most expensive
        // in the original implementation as it would need to loop through
        // all sequence numbers
        echo.executeCallback(
            defaultProvider,
            sequenceNumbers[0],
            updateData,
            priceIds
        );
        uint endGas = gasleft();

        // Log gas usage for the last callback which would be the most expensive
        // in the original implementation (need to run test with -vv)
        console.log(
            "Gas used for last callback (seq 1): %s",
            vm.toString(midGas - endGas)
        );
        console.log(
            "Gas used for all other callbacks: %s",
            vm.toString(startGas - midGas)
        );
    }

    // Helper function to run the overflow mapping benchmark with a specified number of feeds
    function _runOverflowBenchmarkWithFeeds(uint256 numFeeds) internal {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        bytes32[] memory priceIds = createPriceIds(numFeeds);
        uint32 callbackGasLimit = 100000;
        uint128 totalFee = echo.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );

        // Create NUM_REQUESTS requests to fill up the main array
        // The constant is defined in EchoState.sol as 32
        uint64[] memory sequenceNumbers = new uint64[](32);
        vm.deal(address(consumer), 50 ether);

        // Use the same timestamp for all requests to avoid "Too far in future" error
        for (uint i = 0; i < 32; i++) {
            vm.prank(address(consumer));
            sequenceNumbers[i] = echo.requestPriceUpdatesWithCallback{
                value: totalFee
            }(defaultProvider, timestamp, priceIds, callbackGasLimit);
        }

        // Create one more request that will go to the overflow mapping
        // (This could potentially happen earlier if a shortKey collides,
        // but this guarantees it.)
        vm.prank(address(consumer));
        echo.requestPriceUpdatesWithCallback{value: totalFee}(
            defaultProvider,
            timestamp,
            priceIds,
            callbackGasLimit
        );
    }

    // These tests benchmark the gas usage when a new request overflows the fixed-size
    // request array and gets stored in the overflow mapping.
    //
    // NOTE: Run test with `forge test --gas-report --match-test testOverflowMappingGasUsageWithXXFeeds`
    // and observe the `max` value for `executeCallback` to see the cost of the overflowing request.
    function testOverflowMappingGasUsageWith01Feeds() public {
        _runOverflowBenchmarkWithFeeds(1);
    }

    function testOverflowMappingGasUsageWith02Feeds() public {
        _runOverflowBenchmarkWithFeeds(2);
    }

    function testOverflowMappingGasUsageWith04Feeds() public {
        _runOverflowBenchmarkWithFeeds(4);
    }

    function testOverflowMappingGasUsageWith08Feeds() public {
        _runOverflowBenchmarkWithFeeds(8);
    }

    function testOverflowMappingGasUsageWith10Feeds() public {
        _runOverflowBenchmarkWithFeeds(10);
    }
}

// A simple consumer that does nothing with the price updates.
// Used to estimate the gas usage of the echo flow.
contract VoidEchoConsumer is IEchoConsumer {
    address private _echo;

    constructor(address echo) {
        _echo = echo;
    }

    function getEcho() internal view override returns (address) {
        return _echo;
    }

    function echoCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal override {}
}
