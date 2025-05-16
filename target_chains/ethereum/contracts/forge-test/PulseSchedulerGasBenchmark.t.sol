// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../contracts/pulse/SchedulerUpgradeable.sol";
import "@pythnetwork/pulse-sdk-solidity/IScheduler.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerStructs.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerEvents.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerErrors.sol";
import "./utils/PulseSchedulerTestUtils.t.sol";

contract PulseSchedulerGasBenchmark is Test, PulseSchedulerTestUtils {
    ERC1967Proxy public proxy;
    SchedulerUpgradeable public scheduler;
    address public manager;
    address public admin;
    address public pyth;

    function setUp() public {
        manager = address(1);
        admin = address(2);
        pyth = address(3);
        uint128 minBalancePerFeed = 10 ** 16; // 0.01 ether
        uint128 keeperFee = 10 ** 15; // 0.001 ether

        SchedulerUpgradeable _scheduler = new SchedulerUpgradeable();
        proxy = new ERC1967Proxy(
            address(_scheduler),
            abi.encodeWithSelector(
                SchedulerUpgradeable.initialize.selector,
                manager,
                admin,
                pyth,
                minBalancePerFeed,
                keeperFee
            )
        );
        scheduler = SchedulerUpgradeable(address(proxy));

        // Start tests at a high timestamp to avoid underflow when we set
        // `minPublishTime = timestamp - 1 hour` in updatePriceFeeds
        vm.warp(100000);

        // Give manager 1000 ETH for testing
        vm.deal(manager, 1000 ether);
    }

    // Helper function to run the price feed update benchmark with a specified number of feeds
    function _runUpdateAndQueryPriceFeedsBenchmark(uint8 numFeeds) internal {
        // Setup: Create subscription and perform initial update
        vm.prank(manager);
        uint256 subscriptionId = _setupSubscriptionWithInitialUpdate(numFeeds);
        (SchedulerStructs.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);

        // Advance time to meet heartbeat criteria
        vm.warp(block.timestamp + 100);

        // Create new price feed updates with updated timestamp
        uint64 newPublishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory newPriceFeeds;
        uint64[] memory newSlots;

        (newPriceFeeds, newSlots) = createMockPriceFeedsWithSlots(
            newPublishTime,
            numFeeds
        );

        // Mock Pyth response for the benchmark
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, newPriceFeeds, newSlots);

        // Actual benchmark: Measure gas for updating price feeds
        uint256 startGas = gasleft();
        scheduler.updatePriceFeeds(
            subscriptionId,
            createMockUpdateData(newPriceFeeds)
        );
        uint256 updateGasUsed = startGas - gasleft();

        console.log(
            "Gas used for updating %s feeds: %s",
            vm.toString(numFeeds),
            vm.toString(updateGasUsed)
        );

        // Benchmark querying the price feeds after updating
        uint256 queryStartGas = gasleft();
        scheduler.getPricesUnsafe(subscriptionId, params.priceIds);
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

    // Helper function to set up a subscription with initial price update
    function _setupSubscriptionWithInitialUpdate(
        uint8 numFeeds
    ) internal returns (uint256) {
        uint256 subscriptionId = addTestSubscriptionWithFeeds(
            scheduler,
            numFeeds,
            address(manager)
        );

        // Create initial price feed updates
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;

        (priceFeeds, slots) = createMockPriceFeedsWithSlots(
            publishTime,
            numFeeds
        );

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Update the price feeds. We should have enough balance to cover the update
        // because we funded the subscription with the minimum balance during creation.
        scheduler.updatePriceFeeds(subscriptionId, updateData);
        return subscriptionId;
    }

    // Helper function to create updated price feeds for benchmark
    function _createUpdatedPriceFeeds(
        uint8 numFeeds
    ) internal returns (PythStructs.PriceFeed[] memory, uint64[] memory) {}

    /// Helper function for benchmarking querying active subscriptions with a specified number of total subscriptions.
    /// Half of them will be inactive to simulate gaps in the subscriptions list.
    /// Keepers will poll this function to get the list of active subscriptions.
    function _runGetActiveSubscriptionsBenchmark(
        uint256 numSubscriptions
    ) internal {
        // Setup: As manager, create subscriptions and then deactivate every other one.
        vm.startPrank(manager);

        // Array to store subscription IDs
        uint256[] memory subscriptionIds = new uint256[](numSubscriptions);

        // First create all subscriptions as active (with default 2 price feeds)
        for (uint256 i = 0; i < numSubscriptions; i++) {
            subscriptionIds[i] = addTestSubscription(
                scheduler,
                address(manager)
            );
        }

        // Deactivate every other subscription
        for (uint256 i = 0; i < numSubscriptions; i++) {
            if (i % 2 == 1) {
                (
                    SchedulerStructs.SubscriptionParams memory params,

                ) = scheduler.getSubscription(subscriptionIds[i]);
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
            vm.toString((numSubscriptions + 1) / 2),
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

    // Allow the contract to receive Ether (for keeper payments during tests)
    receive() external payable {}
}
