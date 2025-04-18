// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "../contracts/pulse/scheduler/SchedulerUpgradeable.sol";
import "../contracts/pulse/scheduler/IScheduler.sol";
import "../contracts/pulse/scheduler/SchedulerState.sol";
import "../contracts/pulse/scheduler/SchedulerEvents.sol";
import "../contracts/pulse/scheduler/SchedulerErrors.sol";
import "./utils/PulseSchedulerTestUtils.t.sol";

contract PulseSchedulerGasBenchmark is Test, PulseSchedulerTestUtils {
    ERC1967Proxy public proxy;
    SchedulerUpgradeable public scheduler;
    address public owner;
    address public admin;
    address public pyth;
    address public pusher;

    // Constants
    uint96 constant PYTH_FEE = 1 wei;

    function setUp() public {
        owner = address(1);
        admin = address(2);
        pyth = address(3);
        pusher = address(4);

        SchedulerUpgradeable _scheduler = new SchedulerUpgradeable();
        proxy = new ERC1967Proxy(address(_scheduler), "");
        scheduler = SchedulerUpgradeable(address(proxy));

        scheduler.initialize(owner, admin, pyth);

        // Start tests at a high timestamp to avoid underflow when we set
        // `minPublishTime = timestamp - 1 hour` in updatePriceFeeds
        vm.warp(100000);

        // Give pusher and owner 1000 ETH for testing
        vm.deal(pusher, 1000 ether);
        vm.deal(owner, 1000 ether);
    }

    // Helper function to run the price feed update benchmark with a specified number of feeds
    function _runUpdateAndQueryPriceFeedsBenchmark(uint8 numFeeds) internal {
        // Setup: Create subscription and initial price update
        vm.prank(owner);
        uint256 subscriptionId = addTestSubscriptionWithFeeds(
            scheduler,
            numFeeds,
            address(owner)
        );

        // Fetch the price IDS
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        bytes32[] memory priceIds = params.priceIds;

        // Create initial price feed updates
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;

        (priceFeeds, slots) = createMockPriceFeedsWithSlots(
            publishTime,
            numFeeds
        );

        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds);
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Advance time to meet heartbeat criteria
        vm.warp(block.timestamp + 100);

        // Create new price feed updates with updated timestamp and prices
        uint64 newPublishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory newPriceFeeds;
        uint64[] memory newSlots;

        (newPriceFeeds, newSlots) = createMockPriceFeedsWithSlots(
            newPublishTime,
            numFeeds
        );

        // Apply price deviation to ensure update criteria is met
        for (uint i = 0; i < numFeeds; i++) {
            // Apply a 200 bps price increase (satisfies update criteria)
            int64 priceDiff = int64(
                (uint64(newPriceFeeds[i].price.price) * 200) / 10_000
            );
            newPriceFeeds[i].price.price =
                newPriceFeeds[i].price.price +
                priceDiff;
        }

        mockParsePriceFeedUpdatesWithSlots(pyth, newPriceFeeds, newSlots);
        bytes[] memory updateData2 = createMockUpdateData(newPriceFeeds);

        // Actual benchmark: Measure gas for updating price feeds
        vm.prank(pusher);
        uint256 startGas = gasleft();
        scheduler.updatePriceFeeds(subscriptionId, updateData2, priceIds);
        uint256 updateGasUsed = startGas - gasleft();

        console.log(
            "Gas used for updating %s feeds: %s",
            vm.toString(numFeeds),
            vm.toString(updateGasUsed)
        );

        // Benchmark querying the price feeds after updating
        uint256 queryStartGas = gasleft();
        scheduler.getPricesUnsafe(subscriptionId, priceIds);
        uint256 queryGasUsed = queryStartGas - gasleft();

        console.log(
            "Gas used for querying %s feeds: %s",
            vm.toString(numFeeds),
            vm.toString(queryGasUsed)
        );
        console.log(
            "Total gas used for updating and querying %s feeds: %s",
            vm.toString(numFeeds),
            vm.toString(updateGasUsed + queryGasUsed)
        );
    }

    /// Helper function for benchmarking querying active subscriptions with a specified number of total subscriptions.
    /// Half of them will be inactive to simulate gaps in the subscriptions list.
    /// Keepers will poll this function to get the list of active subscriptions.
    function _runGetActiveSubscriptionsBenchmark(
        uint256 numSubscriptions
    ) internal {
        // Setup: Create subscriptions and then deactivate every other one.
        vm.startPrank(owner);

        // Array to store subscription IDs
        uint256[] memory subscriptionIds = new uint256[](numSubscriptions);

        // First create all subscriptions as active with 2 price feeds
        for (uint256 i = 0; i < numSubscriptions; i++) {
            bytes32[] memory priceIds = createPriceIds();
            address[] memory readerWhitelist = new address[](0);

            SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
                .UpdateCriteria({
                    updateOnHeartbeat: true,
                    heartbeatSeconds: 60,
                    updateOnDeviation: true,
                    deviationThresholdBps: 100
                });

            SchedulerState.GasConfig memory gasConfig = SchedulerState
                .GasConfig({
                    maxBaseFeeMultiplierCapPct: 10_000,
                    maxPriorityFeeMultiplierCapPct: 10_000
                });

            SchedulerState.SubscriptionParams memory params = SchedulerState
                .SubscriptionParams({
                    priceIds: priceIds,
                    readerWhitelist: readerWhitelist,
                    whitelistEnabled: false,
                    isActive: true, // All start as active
                    isPermanent: false,
                    updateCriteria: updateCriteria,
                    gasConfig: gasConfig
                });

            uint256 minimumBalance = scheduler.getMinimumBalance(2);
            subscriptionIds[i] = scheduler.createSubscription{
                value: minimumBalance
            }(params);
        }

        // Deactivate every other subscription
        for (uint256 i = 0; i < numSubscriptions; i++) {
            if (i % 2 == 1) {
                (SchedulerState.SubscriptionParams memory params, ) = scheduler
                    .getSubscription(subscriptionIds[i]);
                params.isActive = false;
                scheduler.updateSubscription(subscriptionIds[i], params);
            }
        }
        vm.stopPrank();

        // Actual benchmark: Measure gas for fetching active subscriptions
        uint256 startGas = gasleft();
        scheduler.getActiveSubscriptions(0, numSubscriptions);
        uint256 gasUsed = startGas - gasleft();

        console.log(
            "Gas used for fetching %s active subscriptions out of %s total: %s",
            vm.toString((numSubscriptions + 1) / 2), // Only half are active (rounded up)
            vm.toString(numSubscriptions),
            vm.toString(gasUsed)
        );
    }

    // Benchmark tests for the basic flow: updating and reading price feeds with different feed counts
    // NOTE: run these tests with -vv to see the gas usage for the operations under test, without setup costs

    function testUpdateAndQueryPriceFeeds01Feed() public {
        _runUpdateAndQueryPriceFeedsBenchmark(1);
    }

    function testUpdateAndQueryPriceFeeds02Feeds() public {
        _runUpdateAndQueryPriceFeedsBenchmark(2);
    }

    function testUpdateAndQueryPriceFeeds04Feeds() public {
        _runUpdateAndQueryPriceFeedsBenchmark(4);
    }

    function testUpdateAndQueryPriceFeeds08Feeds() public {
        _runUpdateAndQueryPriceFeedsBenchmark(8);
    }

    function testUpdateAndQueryPriceFeeds10Feeds() public {
        _runUpdateAndQueryPriceFeedsBenchmark(10);
    }

    function testUpdateAndQueryPriceFeeds20Feeds() public {
        _runUpdateAndQueryPriceFeedsBenchmark(20);
    }

    // Benchmark tests for fetching active subscriptions with different counts
    // NOTE: run these tests with -vv to see the gas usage for the operations under test, without setup costs

    function testGetActiveSubscriptions010() public {
        _runGetActiveSubscriptionsBenchmark(10);
    }

    function testGetActiveSubscriptions100() public {
        _runGetActiveSubscriptionsBenchmark(100);
    }

    function testGetActiveSubscriptions1000() public {
        _runGetActiveSubscriptionsBenchmark(1000);
    }
}
