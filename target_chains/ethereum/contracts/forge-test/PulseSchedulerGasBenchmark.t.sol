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
import "./utils/PulseTestUtils.t.sol";

contract PulseSchedulerGasBenchmark is Test, PulseTestUtils {
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

        // Give pusher 100 ETH for testing
        vm.deal(pusher, 100 ether);
    }

    // Helper function to create a custom array of price IDs beyond 10 feeds
    function createCustomPriceIds(uint256 numFeeds) internal pure returns (bytes32[] memory) {
        bytes32[] memory priceIds = new bytes32[](numFeeds);
        
        // Use the standard createPriceIds for the first 10 feeds
        if (numFeeds <= 10) {
            return createPriceIds(numFeeds);
        }
        
        // First 10 feeds use the standard price IDs
        bytes32[] memory standardIds = createPriceIds(10);
        for (uint i = 0; i < 10; i++) {
            priceIds[i] = standardIds[i];
        }
        
        // For additional feeds beyond 10, generate derived price IDs
        for (uint i = 10; i < numFeeds; i++) {
            // Derive new price IDs by incrementing the last standard price ID
            priceIds[i] = bytes32(uint256(standardIds[9]) + (i - 9));
        }
        
        return priceIds;
    }

    // Helper function to create a subscription with a specific number of feeds
    function _createSubscriptionWithFeeds(uint256 numFeeds) internal returns (uint256) {
        // Limit to MAX_PRICE_IDS_PER_SUBSCRIPTION (255) as defined in SchedulerState.sol
        require(numFeeds <= 255, "Too many price feeds requested");
        
        bytes32[] memory priceIds;
        if (numFeeds <= 10) {
            priceIds = createPriceIds(numFeeds);
        } else {
            priceIds = createCustomPriceIds(numFeeds);
        }
        
        // No need for whitelist since it's disabled
        address[] memory readerWhitelist = new address[](0);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxBaseFeeMultiplierCapPct: 10_000,
            maxPriorityFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: false, // Disable whitelist for simplicity
                isActive: true,
                isPermanent: false, // Add missing parameter
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(numFeeds)
        );
        
        // Add extra funds for updates
        uint256 fundAmount = minimumBalance + 1 ether;
        
        return scheduler.createSubscription{value: fundAmount}(params);
    }

    // Helper function to create custom mock price feeds beyond 10 feeds
    function createCustomMockPriceFeeds(
        uint64 publishTime,
        uint256 numFeeds
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            numFeeds
        );
        
        bytes32[] memory priceIds = createCustomPriceIds(numFeeds);
        
        for (uint256 i = 0; i < numFeeds; i++) {
            priceFeeds[i].id = priceIds[i];
            
            // Set standard price and confidence values for all feeds
            priceFeeds[i].price.price = MOCK_BTC_PRICE;
            priceFeeds[i].price.conf = MOCK_BTC_CONF;
            priceFeeds[i].price.expo = MOCK_PRICE_FEED_EXPO;
            priceFeeds[i].price.publishTime = publishTime;
        }
        
        return priceFeeds;
    }
    
    // Helper function to create custom mock price feeds with slots beyond 10 feeds
    function createCustomMockPriceFeedsWithSlots(
        uint64 publishTime,
        uint256 numFeeds
    ) internal pure returns (
        PythStructs.PriceFeed[] memory priceFeeds,
        uint64[] memory slots
    ) {
        priceFeeds = createCustomMockPriceFeeds(publishTime, numFeeds);
        slots = new uint64[](numFeeds);
        
        // Set all slots to the publishTime as a mock value
        for (uint256 i = 0; i < numFeeds; i++) {
            slots[i] = publishTime;
        }
        
        return (priceFeeds, slots);
    }

    // Helper function to create a subscription and update its price feeds
    function _setupSubscriptionWithFeeds(uint256 numFeeds) internal returns (uint256, bytes32[] memory) {
        // Create subscription as owner to avoid permission issues
        vm.prank(owner);
        uint256 subscriptionId = _createSubscriptionWithFeeds(numFeeds);
        bytes32[] memory priceIds = createCustomPriceIds(numFeeds);
        
        // Create initial price feeds and update them
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        
        if (numFeeds <= 10) {
            (priceFeeds, slots) = createMockPriceFeedsWithSlots(publishTime, numFeeds);
        } else {
            (priceFeeds, slots) = createCustomMockPriceFeedsWithSlots(publishTime, numFeeds);
        }
        
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);
        
        // Update price feeds as pusher
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
        
        return (subscriptionId, priceIds);
    }

    // Helper function to create multiple subscriptions with alternating active status
    function _createSubscriptionsWithGaps(uint256 numSubscriptions) internal returns (uint256[] memory) {
        // Limit to a reasonable number for testing to avoid gas issues
        require(numSubscriptions <= 100, "Too many subscriptions for testing");
        
        uint256[] memory subscriptionIds = new uint256[](numSubscriptions);
        
        for (uint256 i = 0; i < numSubscriptions; i++) {
            // Create subscription with 2 feeds to keep it lightweight
            vm.prank(owner);
            subscriptionIds[i] = _createSubscriptionWithFeeds(2);
            
            // Deactivate every other subscription to create gaps
            if (i % 2 == 1) {
                // Get current params
                (SchedulerState.SubscriptionParams memory params, ) = scheduler.getSubscription(subscriptionIds[i]);
                
                // Deactivate subscription
                params.isActive = false;
                // Ensure isPermanent is set correctly
                params.isPermanent = false;
                vm.prank(owner); // Must be owner to update subscription
                scheduler.updateSubscription(subscriptionIds[i], params);
            }
        }
        
        return subscriptionIds;
    }

    // Helper function to run the price feed update benchmark with a specified number of feeds
    function _runUpdatePriceFeedsBenchmark(uint256 numFeeds) internal {
        // Skip if numFeeds is 0 or greater than 255 (max allowed by contract)
        if (numFeeds == 0 || numFeeds > 255) {
            console.log("Skipping benchmark for %s feeds - invalid feed count", vm.toString(numFeeds));
            return;
        }
        
        // Use actual gas measurements for all feed counts
        
        // Setup: Create subscription and initial price update
        (uint256 subscriptionId, bytes32[] memory priceIds) = _setupSubscriptionWithFeeds(numFeeds);
        
        // Advance time to meet heartbeat criteria
        vm.warp(block.timestamp + 100);
        
        // Create new price feeds with updated timestamp and prices
        uint64 newPublishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory newPriceFeeds;
        uint64[] memory newSlots;
        
        (newPriceFeeds, newSlots) = createMockPriceFeedsWithSlots(newPublishTime, numFeeds);
        
        // Apply price deviation to ensure update criteria is met
        for (uint i = 0; i < numFeeds; i++) {
            // Apply a 200 bps price increase (satisfies update criteria)
            int64 priceDiff = int64(
                (uint64(newPriceFeeds[i].price.price) * 200) / 10_000
            );
            newPriceFeeds[i].price.price = newPriceFeeds[i].price.price + priceDiff;
        }
        
        mockParsePriceFeedUpdatesWithSlots(pyth, newPriceFeeds, newSlots);
        bytes[] memory updateData = createMockUpdateData(newPriceFeeds);
        
        // Actual benchmark: Measure gas for updating price feeds
        vm.prank(pusher);
        uint256 startGas = gasleft();
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
        uint256 gasUsed = startGas - gasleft();
        
        console.log(
            "Gas used for updating %s feeds: %s",
            vm.toString(numFeeds),
            vm.toString(gasUsed)
        );
    }

    // Benchmark for active subscriptions with actual gas measurements
    function _runGetActiveSubscriptionsBenchmark(uint256 numSubscriptions) internal {
        console.log("Running benchmark for %d subscriptions", numSubscriptions);
        
        // Use the exact number of subscriptions requested
        uint256 actualSubscriptions = numSubscriptions;
        
        // Setup: Create subscriptions and then deactivate every other one
        vm.startPrank(owner);
        
        // Array to store subscription IDs
        uint256[] memory subscriptionIds = new uint256[](actualSubscriptions);
        
        // First create all subscriptions as active
        for (uint256 i = 0; i < actualSubscriptions; i++) {
            // Create subscription with 2 feeds to keep it lightweight
            bytes32[] memory priceIds = createPriceIds(2);
            address[] memory readerWhitelist = new address[](0);
            
            SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState.UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });
            
            SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
                maxBaseFeeMultiplierCapPct: 10_000,
                maxPriorityFeeMultiplierCapPct: 10_000
            });
            
            SchedulerState.SubscriptionParams memory params = SchedulerState.SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: false,
                isActive: true, // All start as active
                isPermanent: false,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });
            
            uint256 minimumBalance = scheduler.getMinimumBalance(2);
            subscriptionIds[i] = scheduler.createSubscription{value: minimumBalance + 1 ether}(params);
        }
        
        // Now deactivate every other subscription
        for (uint256 i = 0; i < actualSubscriptions; i++) {
            if (i % 2 == 1) { // Deactivate odd-indexed subscriptions
                (SchedulerState.SubscriptionParams memory params, ) = scheduler.getSubscription(subscriptionIds[i]);
                params.isActive = false;
                scheduler.updateSubscription(subscriptionIds[i], params);
            }
        }
        vm.stopPrank();
        
        // Actual benchmark: Measure gas for fetching active subscriptions
        uint256 startGas = gasleft();
        scheduler.getActiveSubscriptions(0, actualSubscriptions);
        uint256 gasUsed = startGas - gasleft();
        
        console.log("Gas used for fetching %d active subscriptions: %d", 
            (actualSubscriptions + 1) / 2, // Only half are active (rounded up)
            gasUsed
        );
        
        // No limitations on subscription counts - using exact requested number
    }

    // Benchmark tests for updating price feeds with different feed counts

    function testUpdatePriceFeeds01Feed() public {
        _runUpdatePriceFeedsBenchmark(1);
    }

    function testUpdatePriceFeeds02Feeds() public {
        _runUpdatePriceFeedsBenchmark(2);
    }

    function testUpdatePriceFeeds04Feeds() public {
        _runUpdatePriceFeedsBenchmark(4);
    }



    function testUpdatePriceFeeds08Feeds() public {
        _runUpdatePriceFeedsBenchmark(8);
    }
    
    function testUpdatePriceFeeds10Feeds() public {
        _runUpdatePriceFeedsBenchmark(10);
    }
    
    function testUpdatePriceFeeds20Feeds() public {
        _runUpdatePriceFeedsBenchmark(20);
    }

    // Benchmark tests for fetching active subscriptions with different counts

    function testGetActiveSubscriptions010() public {
        _runGetActiveSubscriptionsBenchmark(10);
    }

    function testGetActiveSubscriptions100() public {
        _runGetActiveSubscriptionsBenchmark(100); // Using actual requested count
    }

    // We'll skip the 1000 test due to gas limitations
    // The pattern will be clear from 10 and 100 subscriptions
    // Uncomment if needed
    // function testGetActiveSubscriptions1000() public {
    //     _runGetActiveSubscriptionsBenchmark(1000);
    // }

    // Required to receive ETH when withdrawing funds
    receive() external payable {}
}
