// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./utils/PulseTestUtils.t.sol";
import "../contracts/pulse/scheduler/SchedulerUpgradeable.sol";
import "../contracts/pulse/scheduler/IScheduler.sol";
import "../contracts/pulse/scheduler/SchedulerState.sol";
import "../contracts/pulse/scheduler/SchedulerEvents.sol";
import "../contracts/pulse/scheduler/SchedulerErrors.sol";

contract MockReader {
    address private _scheduler;

    constructor(address scheduler) {
        _scheduler = scheduler;
    }

    function getPricesUnsafe(
        uint256 subscriptionId,
        bytes32[] memory priceIds
    ) external view returns (PythStructs.Price[] memory) {
        return IScheduler(_scheduler).getPricesUnsafe(subscriptionId, priceIds);
    }

    function getEmaPriceUnsafe(
        uint256 subscriptionId,
        bytes32[] memory priceIds
    ) external view returns (PythStructs.Price[] memory) {
        return IScheduler(_scheduler).getEmaPriceUnsafe(subscriptionId, priceIds);
    }

    function verifyPriceFeeds(
        uint256 subscriptionId,
        bytes32[] memory priceIds,
        PythStructs.PriceFeed[] memory expectedFeeds
    ) external view returns (bool) {
        PythStructs.Price[] memory actualPrices = IScheduler(_scheduler)
            .getPricesUnsafe(subscriptionId, priceIds);

        if (actualPrices.length != expectedFeeds.length) {
            return false;
        }

        for (uint i = 0; i < actualPrices.length; i++) {
            if (
                actualPrices[i].price != expectedFeeds[i].price.price ||
                actualPrices[i].conf != expectedFeeds[i].price.conf ||
                actualPrices[i].publishTime != expectedFeeds[i].price.publishTime
            ) {
                return false;
            }
        }

        return true;
    }
}

contract SchedulerTest is Test, SchedulerEvents, PulseTestUtils {
    ERC1967Proxy public proxy;
    SchedulerUpgradeable public scheduler;
    MockReader public reader;
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

        reader = new MockReader(address(proxy));

        // Start tests at timestamp 100 to avoid underflow when we set
        // `minPublishTime = timestamp - 10 seconds` in updatePriceFeeds
        vm.warp(100);
    }

    function testAddSubscription() public {
        // Create subscription parameters
        bytes32[] memory priceIds = createPriceIds();
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = address(reader);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        // Add subscription
        vm.expectEmit();
        emit SubscriptionCreated(1, address(this));

        uint256 subscriptionId = scheduler.addSubscription(params);
        assertEq(subscriptionId, 1, "Subscription ID should be 1");

        // Verify subscription was added correctly
        (
            SchedulerState.SubscriptionParams memory storedParams,
            SchedulerState.SubscriptionStatus memory status
        ) = scheduler.getSubscription(subscriptionId);

        assertEq(
            storedParams.priceIds.length,
            priceIds.length,
            "Price IDs length mismatch"
        );
        assertEq(
            storedParams.readerWhitelist.length,
            readerWhitelist.length,
            "Whitelist length mismatch"
        );
        assertEq(
            storedParams.whitelistEnabled,
            true,
            "whitelistEnabled should be true"
        );
        assertEq(
            storedParams.updateCriteria.heartbeatSeconds,
            60,
            "Heartbeat seconds mismatch"
        );
        assertEq(
            storedParams.updateCriteria.deviationThresholdBps,
            100,
            "Deviation threshold mismatch"
        );
        assertEq(
            storedParams.gasConfig.maxGasMultiplierCapPct,
            10_000,
            "Max gas multiplier mismatch"
        );

        assertTrue(status.isActive, "Subscription should be active");
        assertEq(status.balanceInWei, 0, "Initial balance should be 0");
    }

    function testUpdateSubscription() public {
        // First add a subscription
        uint256 subscriptionId = addTestSubscription();

        // Create updated parameters
        bytes32[] memory newPriceIds = createPriceIds(3); // Add one more price ID
        address[] memory newReaderWhitelist = new address[](2);
        newReaderWhitelist[0] = address(reader);
        newReaderWhitelist[1] = address(0x123);

        SchedulerState.UpdateCriteria memory newUpdateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 120, // Changed from 60
                updateOnDeviation: true,
                deviationThresholdBps: 200 // Changed from 100
            });

        SchedulerState.GasConfig memory newGasConfig = SchedulerState
            .GasConfig({
                maxGasMultiplierCapPct: 20_000, // Changed from 10_000
                maxFeeMultiplierCapPct: 20_000 // Changed from 10_000
            });

        SchedulerState.SubscriptionParams memory newParams = SchedulerState
            .SubscriptionParams({
                priceIds: newPriceIds,
                readerWhitelist: newReaderWhitelist,
                whitelistEnabled: false, // Changed from true
                updateCriteria: newUpdateCriteria,
                gasConfig: newGasConfig
            });

        // Update subscription
        vm.expectEmit();
        emit SubscriptionUpdated(subscriptionId);

        scheduler.updateSubscription(subscriptionId, newParams);

        // Verify subscription was updated correctly
        (SchedulerState.SubscriptionParams memory storedParams, ) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            storedParams.priceIds.length,
            newPriceIds.length,
            "Price IDs length mismatch"
        );
        assertEq(
            storedParams.readerWhitelist.length,
            newReaderWhitelist.length,
            "Whitelist length mismatch"
        );
        assertEq(
            storedParams.whitelistEnabled,
            false,
            "whitelistEnabled should be false"
        );
        assertEq(
            storedParams.updateCriteria.heartbeatSeconds,
            120,
            "Heartbeat seconds mismatch"
        );
        assertEq(
            storedParams.updateCriteria.deviationThresholdBps,
            200,
            "Deviation threshold mismatch"
        );
        assertEq(
            storedParams.gasConfig.maxGasMultiplierCapPct,
            20_000,
            "Max gas multiplier mismatch"
        );
    }

    function testDeactivateSubscription() public {
        // First add a subscription
        uint256 subscriptionId = addTestSubscription();

        // Deactivate subscription
        vm.expectEmit();
        emit SubscriptionDeactivated(subscriptionId);

        scheduler.deactivateSubscription(subscriptionId);

        // Verify subscription was deactivated
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertFalse(status.isActive, "Subscription should be inactive");
    }

    function testAddFunds() public {
        // First add a subscription
        uint256 subscriptionId = addTestSubscription();

        // Add funds
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Verify funds were added
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            fundAmount,
            "Balance should match added funds"
        );
    }

    function testWithdrawFunds() public {
        // First add a subscription and funds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Get initial balance
        uint256 initialBalance = address(this).balance;

        // Withdraw half the funds
        uint256 withdrawAmount = fundAmount / 2;
        scheduler.withdrawFunds(subscriptionId, withdrawAmount);

        // Verify funds were withdrawn
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            fundAmount - withdrawAmount,
            "Remaining balance incorrect"
        );
        assertEq(
            address(this).balance,
            initialBalance + withdrawAmount,
            "Withdrawn amount not received"
        );
    }

    function testUpdatePriceFeedsWorks() public {
        // --- First Update ---
        // Add a subscription and funds
        uint256 subscriptionId = addTestSubscription(); // Uses heartbeat 60s, deviation 100bps
        uint256 fundAmount = 2 ether; // Add enough for two updates
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Create price feeds and mock Pyth response for first update
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1 = createMockPriceFeeds(
            publishTime1
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);

        // Perform first update
        vm.expectEmit();
        emit PricesUpdated(subscriptionId, publishTime1);
        vm.prank(pusher);

        vm.breakpoint("a");
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Verify first update
        (, SchedulerState.SubscriptionStatus memory status1) = scheduler
            .getSubscription(subscriptionId);
        assertEq(
            status1.priceLastUpdatedAt,
            publishTime1,
            "First update timestamp incorrect"
        );
        assertEq(
            status1.totalUpdates,
            1,
            "Total updates should be 1 after first update"
        );
        assertTrue(
            status1.totalSpent > 0,
            "Total spent should be > 0 after first update"
        );
        uint256 spentAfterFirst = status1.totalSpent; // Store spent amount

        // --- Second Update ---
        // Advance time beyond heartbeat interval (e.g., 100 seconds)
        vm.warp(block.timestamp + 100);

        // Create price feeds for second update by cloning first update and modifying
        uint64 publishTime2 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[]
            memory priceFeeds2 = new PythStructs.PriceFeed[](
                priceFeeds1.length
            );
        for (uint i = 0; i < priceFeeds1.length; i++) {
            priceFeeds2[i] = priceFeeds1[i]; // Clone the feed struct
            priceFeeds2[i].price.publishTime = publishTime2; // Update timestamp

            // Apply a 100 bps price increase (satisfies update criteria)
            int64 priceDiff = int64(
                (uint64(priceFeeds1[i].price.price) * 100) / 10_000
            );
            priceFeeds2[i].price.price = priceFeeds1[i].price.price + priceDiff;
            priceFeeds2[i].emaPrice.publishTime = publishTime2;
        }

        mockParsePriceFeedUpdates(pyth, priceFeeds2); // Mock for the second call
        bytes[] memory updateData2 = createMockUpdateData(priceFeeds2);

        // Perform second update
        vm.expectEmit();
        emit PricesUpdated(subscriptionId, publishTime2);
        vm.prank(pusher);

        vm.breakpoint("b");
        scheduler.updatePriceFeeds(subscriptionId, updateData2, priceIds);

        // Verify second update
        (, SchedulerState.SubscriptionStatus memory status2) = scheduler
            .getSubscription(subscriptionId);
        assertEq(
            status2.priceLastUpdatedAt,
            publishTime2,
            "Second update timestamp incorrect"
        );
        assertEq(
            status2.totalUpdates,
            2,
            "Total updates should be 2 after second update"
        );
        assertTrue(
            status2.totalSpent > spentAfterFirst,
            "Total spent should increase after second update"
        );
        // Verify price feed data using the reader contract for the second update
        assertTrue(
            reader.verifyPriceFeeds(
                subscriptionId,
                new bytes32[](0),
                priceFeeds2
            ),
            "Price feeds verification failed after second update"
        );
    }

    function testUpdatePriceFeedsRevertsOnHeartbeatUpdateConditionNotMet()
        public
    {
        // Add a subscription with only heartbeat criteria (60 seconds)
        uint32 heartbeat = 60;
        SchedulerState.UpdateCriteria memory criteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: heartbeat,
                updateOnDeviation: false,
                deviationThresholdBps: 0
            });
        uint256 subscriptionId = addTestSubscriptionWithUpdateCriteria(
            criteria
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // First update to set initial timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1 = createMockPriceFeeds(
            publishTime1
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update within heartbeat interval
        vm.warp(block.timestamp + 30); // Advance time by 30 seconds (less than 60)
        uint64 publishTime2 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds2 = createMockPriceFeeds(
            publishTime2 // Same prices, just new timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds2); // Mock the response for the second update
        bytes[] memory updateData2 = createMockUpdateData(priceFeeds2);

        // Expect revert because heartbeat condition is not met
        vm.expectRevert(
            abi.encodeWithSelector(UpdateConditionsNotMet.selector)
        );
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData2, priceIds);
    }

    function testUpdatePriceFeedsRevertsOnDeviationUpdateConditionNotMet()
        public
    {
        // Add a subscription with only deviation criteria (100 bps / 1%)
        uint16 deviationBps = 100;
        SchedulerState.UpdateCriteria memory criteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: false,
                heartbeatSeconds: 0,
                updateOnDeviation: true,
                deviationThresholdBps: deviationBps
            });
        uint256 subscriptionId = addTestSubscriptionWithUpdateCriteria(
            criteria
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // First update to set initial price
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1 = createMockPriceFeeds(
            publishTime1
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update with price deviation less than threshold (e.g., 50 bps)
        vm.warp(block.timestamp + 1000); // Advance time significantly (doesn't matter for deviation)
        uint64 publishTime2 = SafeCast.toUint64(block.timestamp);

        // Clone priceFeeds1 and apply a 50 bps deviation to its prices
        PythStructs.PriceFeed[]
            memory priceFeeds2 = new PythStructs.PriceFeed[](
                priceFeeds1.length
            );
        for (uint i = 0; i < priceFeeds1.length; i++) {
            priceFeeds2[i].id = priceFeeds1[i].id;
            // Apply 50 bps deviation to the price
            int64 priceDiff = int64(
                (uint64(priceFeeds1[i].price.price) * 50) / 10_000
            );
            priceFeeds2[i].price.price = priceFeeds1[i].price.price + priceDiff;
            priceFeeds2[i].price.conf = priceFeeds1[i].price.conf;
            priceFeeds2[i].price.expo = priceFeeds1[i].price.expo;
            priceFeeds2[i].price.publishTime = publishTime2;
        }

        mockParsePriceFeedUpdates(pyth, priceFeeds2);
        bytes[] memory updateData2 = createMockUpdateData(priceFeeds2);

        // Expect revert because deviation condition is not met
        vm.expectRevert(
            abi.encodeWithSelector(UpdateConditionsNotMet.selector)
        );
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData2, priceIds);
    }

    function testUpdatePriceFeedsRevertsOnOlderTimestamp() public {
        // Add a subscription and funds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // First update to establish last updated timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1 = createMockPriceFeeds(
            publishTime1
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update with an older timestamp
        uint64 publishTime2 = publishTime1 - 10; // Timestamp older than the first update
        PythStructs.PriceFeed[] memory priceFeeds2 = createMockPriceFeeds(
            publishTime2
        );
        // Mock Pyth response to return feeds with the older timestamp
        mockParsePriceFeedUpdates(pyth, priceFeeds2);
        bytes[] memory updateData2 = createMockUpdateData(priceFeeds2);

        // Expect revert with TimestampOlderThanLastUpdate (checked in _validateShouldUpdatePrices)
        vm.expectRevert(
            abi.encodeWithSelector(
                TimestampOlderThanLastUpdate.selector,
                publishTime2,
                publishTime1
            )
        );

        // Attempt to update price feeds
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData2, priceIds);
    }

    function testUpdatePriceFeedsRevertsOnMismatchedTimestamps() public {
        // First add a subscription and funds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Create two price feeds with mismatched timestamps
        bytes32[] memory priceIds = createPriceIds(2);
        uint64 time1 = SafeCast.toUint64(block.timestamp);
        uint64 time2 = time1 + 10;
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            2
        );
        priceFeeds[0] = createSingleMockPriceFeed(time1);
        priceFeeds[1] = createSingleMockPriceFeed(time2);

        // Mock Pyth response to return these feeds
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds); // Data needs to match expected length

        // Expect revert with PriceTimestampMismatch error
        vm.expectRevert(
            abi.encodeWithSelector(PriceTimestampMismatch.selector)
        );

        // Attempt to update price feeds
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
    }

    function testGetPricesUnsafeAllFeeds() public {
        // First add a subscription, funds, and update price feeds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Get all latest prices (empty priceIds array)
        bytes32[] memory emptyPriceIds = new bytes32[](0);
        PythStructs.Price[] memory latestPrices = scheduler.getPricesUnsafe(
            subscriptionId,
            emptyPriceIds
        );

        // Verify all price feeds were returned
        assertEq(
            latestPrices.length,
            priceIds.length,
            "Should return all price feeds"
        );

        // Verify price feed data using the reader contract
        assertTrue(
            reader.verifyPriceFeeds(subscriptionId, emptyPriceIds, priceFeeds),
            "Price feeds verification failed"
        );
    }

    function testGetPricesUnsafeSelectiveFeeds() public {
        // First add a subscription with 3 price feeds, funds, and update price feeds
        uint256 subscriptionId = addTestSubscriptionWithFeeds(3);
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds(3);
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime,
            3
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Get only the first price feed
        bytes32[] memory selectedPriceIds = new bytes32[](1);
        selectedPriceIds[0] = priceIds[0];

        PythStructs.Price[] memory latestPrices = scheduler.getPricesUnsafe(
            subscriptionId,
            selectedPriceIds
        );

        // Verify only one price feed was returned
        assertEq(latestPrices.length, 1, "Should return only one price feed");

        // Create expected price feed array with just the first feed
        PythStructs.PriceFeed[]
            memory expectedFeeds = new PythStructs.PriceFeed[](1);
        expectedFeeds[0] = priceFeeds[0];

        // Verify price feed data using the reader contract
        assertTrue(
            reader.verifyPriceFeeds(
                subscriptionId,
                selectedPriceIds,
                expectedFeeds
            ),
            "Price feeds verification failed"
        );
    }

    function testOptionalWhitelist() public {
        // Add a subscription with whitelistEnabled = false
        bytes32[] memory priceIds = createPriceIds();
        address[] memory emptyWhitelist = new address[](0);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: emptyWhitelist,
                whitelistEnabled: false, // No whitelist
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        uint256 subscriptionId = scheduler.addSubscription(params);

        // Update price feeds
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Try to access from a non-whitelisted address
        address randomUser = address(0xdead);
        vm.startPrank(randomUser);
        bytes32[] memory emptyPriceIds = new bytes32[](0);

        // Should not revert since whitelist is disabled
        // We'll just check that it doesn't revert
        scheduler.getPricesUnsafe(subscriptionId, emptyPriceIds);
        vm.stopPrank();

        // Verify the data is correct
        assertTrue(
            reader.verifyPriceFeeds(subscriptionId, emptyPriceIds, priceFeeds),
            "Price feeds verification failed"
        );
    }
    
    function testGetEmaPriceUnsafe() public {
        // First add a subscription, funds, and update price feeds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        
        // Ensure EMA prices are set in the mock price feeds
        for (uint i = 0; i < priceFeeds.length; i++) {
            priceFeeds[i].emaPrice.price = priceFeeds[i].price.price * 2; // Make EMA price different for testing
            priceFeeds[i].emaPrice.conf = priceFeeds[i].price.conf;
            priceFeeds[i].emaPrice.publishTime = publishTime;
            priceFeeds[i].emaPrice.expo = priceFeeds[i].price.expo;
        }
        
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Get EMA prices
        bytes32[] memory emptyPriceIds = new bytes32[](0);
        PythStructs.Price[] memory emaPrices = scheduler.getEmaPriceUnsafe(
            subscriptionId,
            emptyPriceIds
        );

        // Verify all EMA prices were returned
        assertEq(
            emaPrices.length,
            priceIds.length,
            "Should return all EMA prices"
        );
        
        // Verify EMA price values
        for (uint i = 0; i < emaPrices.length; i++) {
            assertEq(
                emaPrices[i].price,
                priceFeeds[i].emaPrice.price,
                "EMA price value mismatch"
            );
            assertEq(
                emaPrices[i].publishTime,
                priceFeeds[i].emaPrice.publishTime,
                "EMA price publish time mismatch"
            );
        }
    }

    function testGetActiveSubscriptions() public {
        // Add multiple subscriptions with the test contract as manager
        addTestSubscription();
        addTestSubscription();
        uint256 subscriptionId = addTestSubscription();

        // Verify we can deactivate our own subscription
        scheduler.deactivateSubscription(subscriptionId);

        // Create a subscription with pusher as manager
        vm.startPrank(pusher);
        bytes32[] memory priceIds = createPriceIds();
        address[] memory emptyWhitelist = new address[](0);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: emptyWhitelist,
                whitelistEnabled: false,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        scheduler.addSubscription(params);
        vm.stopPrank();

        // Get active subscriptions - use owner who has admin rights
        vm.prank(owner);
        (
            uint256[] memory activeIds,
            SchedulerState.SubscriptionParams[] memory activeParams,
            uint256 totalCount
        ) = scheduler.getActiveSubscriptions(0, 10); // Start at index 0, get up to 10 results

        // Verify active subscriptions
        assertEq(activeIds.length, 3, "Should have 3 active subscriptions");
        assertEq(
            activeParams.length,
            3,
            "Should have 3 active subscription params"
        );
        assertEq(
            totalCount,
            3,
            "Total count should be 3"
        );

        // Verify subscription params
        for (uint i = 0; i < activeIds.length; i++) {
            (
                SchedulerState.SubscriptionParams memory storedParams,

            ) = scheduler.getSubscription(activeIds[i]);

            assertEq(
                activeParams[i].priceIds.length,
                storedParams.priceIds.length,
                "Price IDs length mismatch"
            );

            assertEq(
                activeParams[i].updateCriteria.heartbeatSeconds,
                storedParams.updateCriteria.heartbeatSeconds,
                "Heartbeat seconds mismatch"
            );
        }
        
        // Test pagination - get only the first subscription
        vm.prank(owner);
        (
            uint256[] memory firstPageIds,
            SchedulerState.SubscriptionParams[] memory firstPageParams,
            uint256 firstPageTotal
        ) = scheduler.getActiveSubscriptions(0, 1);
        
        assertEq(firstPageIds.length, 1, "Should have 1 subscription in first page");
        assertEq(firstPageTotal, 3, "Total count should still be 3");
        
        // Test pagination - get the second page
        vm.prank(owner);
        (
            uint256[] memory secondPageIds,
            SchedulerState.SubscriptionParams[] memory secondPageParams,
            uint256 secondPageTotal
        ) = scheduler.getActiveSubscriptions(1, 2);
        
        assertEq(secondPageIds.length, 2, "Should have 2 subscriptions in second page");
        assertEq(secondPageTotal, 3, "Total count should still be 3");
        
        // Test pagination - start index beyond total count
        vm.prank(owner);
        (
            uint256[] memory emptyPageIds,
            SchedulerState.SubscriptionParams[] memory emptyPageParams,
            uint256 emptyPageTotal
        ) = scheduler.getActiveSubscriptions(10, 10);
        
        assertEq(emptyPageIds.length, 0, "Should have 0 subscriptions when start index is beyond total");
        assertEq(emptyPageTotal, 3, "Total count should still be 3");
    }

    // Helper function to add a test subscription
    function addTestSubscription() internal returns (uint256) {
        bytes32[] memory priceIds = createPriceIds();
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = address(reader);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        return scheduler.addSubscription(params);
    }

    // Helper function to add a test subscription with variable number of feeds
    function addTestSubscriptionWithFeeds(
        uint256 numFeeds
    ) internal returns (uint256) {
        bytes32[] memory priceIds = createPriceIds(numFeeds);
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = address(reader);

        SchedulerState.UpdateCriteria memory updateCriteria = SchedulerState
            .UpdateCriteria({
                updateOnHeartbeat: true,
                heartbeatSeconds: 60,
                updateOnDeviation: true,
                deviationThresholdBps: 100
            });

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        return scheduler.addSubscription(params);
    }

    // Helper function to add a test subscription with specific update criteria
    function addTestSubscriptionWithUpdateCriteria(
        SchedulerState.UpdateCriteria memory updateCriteria
    ) internal returns (uint256) {
        bytes32[] memory priceIds = createPriceIds();
        address[] memory readerWhitelist = new address[](1);
        readerWhitelist[0] = address(reader);

        SchedulerState.GasConfig memory gasConfig = SchedulerState.GasConfig({
            maxGasMultiplierCapPct: 10_000,
            maxFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory params = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: readerWhitelist,
                whitelistEnabled: true,
                updateCriteria: updateCriteria, // Use provided criteria
                gasConfig: gasConfig
            });

        return scheduler.addSubscription(params);
    }

    // Required to receive ETH when withdrawing funds
    receive() external payable {}
}
