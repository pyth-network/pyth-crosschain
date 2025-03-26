// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";
import "../contracts/pulse/PulseEvents.sol";
import "../contracts/pulse/PulseErrors.sol";
import "./utils/PulseTestUtils.t.sol";
import {console} from "forge-std/console.sol";
contract PulseGasBenchmark is Test, PulseTestUtils {
    ERC1967Proxy public proxy;
    PulseUpgradeable public pulse;
    IPulseConsumer public consumer;

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
        PulseUpgradeable _pulse = new PulseUpgradeable();
        proxy = new ERC1967Proxy(address(_pulse), "");
        pulse = PulseUpgradeable(address(proxy));

        pulse.initialize(
            owner,
            admin,
            PYTH_FEE,
            pyth,
            defaultProvider,
            true,
            15
        );
        vm.prank(defaultProvider);
        pulse.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );
        consumer = new VoidPulseConsumer(address(proxy));
    }

    // Estimate how much gas is used by all of the data mocking functionality in the other gas benchmarks.
    // Subtract this amount from the gas benchmarks to estimate the true usage of the pulse flow.
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
        uint96 totalFee = pulse.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );
        vm.deal(address(consumer), 1 ether);
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(defaultProvider, timestamp, priceIds, callbackGasLimit);

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            timestamp,
            numFeeds
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        pulse.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testFlow_01_Feed() public {
        _runBenchmarkWithFeeds(1);
    }

    function testFlow_02_Feeds() public {
        _runBenchmarkWithFeeds(2);
    }

    function testFlow_04_Feeds() public {
        _runBenchmarkWithFeeds(4);
    }

    function testFlow_08_Feeds() public {
        _runBenchmarkWithFeeds(8);
    }

    function testFlow_10_Feeds() public {
        _runBenchmarkWithFeeds(10);
    }

    // This test checks the gas usage for worst-case out-of-order fulfillment.
    // It creates 10 requests, and then fulfills them in reverse order.
    //
    // The last fulfillment will be the most expensive since it needs
    // to linearly scan through all the fulfilled requests in storage
    // in order to update _state.lastUnfulfilledReq
    // NOTE: Run test with -vv to see extra gas logs.
    function testMultipleRequestsOutOfOrderFulfillment() public {
        uint64 timestamp = SafeCast.toUint64(block.timestamp);
        bytes32[] memory priceIds = createPriceIds(2);
        uint32 callbackGasLimit = 100000;
        uint128 totalFee = pulse.getFee(
            defaultProvider,
            callbackGasLimit,
            priceIds
        );

        // Create 10 requests
        uint64[] memory sequenceNumbers = new uint64[](10);
        vm.deal(address(consumer), 10 ether);

        for (uint i = 0; i < 10; i++) {
            vm.prank(address(consumer));
            sequenceNumbers[i] = pulse.requestPriceUpdatesWithCallback{
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
            pulse.executeCallback(
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
        pulse.executeCallback(
            defaultProvider,
            sequenceNumbers[0],
            updateData,
            priceIds
        );
        uint endGas = gasleft();

        // Log gas usage for the last callback which would be the most expensive
        // in the original implementation
        console.log("Gas used for last callback (seq 1):", midGas - endGas);
        console.log("Gas used for all other callbacks:", startGas - midGas);
    }
}

// A simple consumer that does nothing with the price updates.
// Used to estimate the gas usage of the pulse flow.
contract VoidPulseConsumer is IPulseConsumer {
    address private _pulse;

    constructor(address pulse) {
        _pulse = pulse;
    }

    function getPulse() internal view override returns (address) {
        return _pulse;
    }

    function pulseCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal override {}
}
