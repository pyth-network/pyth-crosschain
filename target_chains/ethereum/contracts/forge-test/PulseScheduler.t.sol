// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./utils/PulseSchedulerTestUtils.t.sol";
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
        return
            IScheduler(_scheduler).getEmaPriceUnsafe(subscriptionId, priceIds);
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
                actualPrices[i].publishTime !=
                expectedFeeds[i].price.publishTime
            ) {
                return false;
            }
        }

        return true;
    }
}

contract SchedulerTest is Test, SchedulerEvents, PulseSchedulerTestUtils {
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

        // Start tests at a high timestamp to avoid underflow when we set
        // `minPublishTime = timestamp - 1 hour` in updatePriceFeeds
        vm.warp(100000);

        // Give pusher 100 ETH for testing
        vm.deal(pusher, 100 ether);
    }

    function testCreateSubscription() public {
        SchedulerState.SubscriptionParams
            memory params = createDefaultSubscriptionParams(2, address(reader));
        bytes32[] memory priceIds = params.priceIds; // Get the generated price IDs

        // Calculate minimum balance
        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(priceIds.length)
        );

        // Add subscription with minimum balance
        vm.expectEmit();
        emit SubscriptionCreated(1, address(this));

        uint256 subscriptionId = scheduler.createSubscription{
            value: minimumBalance
        }(params);
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
            params.readerWhitelist.length,
            "Whitelist length mismatch"
        );
        assertEq(
            storedParams.whitelistEnabled,
            params.whitelistEnabled,
            "whitelistEnabled should match"
        );
        assertTrue(storedParams.isActive, "Subscription should be active");
        assertEq(
            storedParams.updateCriteria.heartbeatSeconds,
            params.updateCriteria.heartbeatSeconds,
            "Heartbeat seconds mismatch"
        );
        assertEq(
            storedParams.updateCriteria.deviationThresholdBps,
            params.updateCriteria.deviationThresholdBps,
            "Deviation threshold mismatch"
        );
        assertEq(
            storedParams.gasConfig.maxBaseFeeMultiplierCapPct,
            params.gasConfig.maxBaseFeeMultiplierCapPct,
            "Max gas multiplier mismatch"
        );

        assertEq(
            status.balanceInWei,
            minimumBalance,
            "Initial balance should match minimum balance"
        );
    }

    function testUpdateSubscription() public {
        // First add a subscription
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

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
                maxBaseFeeMultiplierCapPct: 20_000, // Changed from 10_000
                maxPriorityFeeMultiplierCapPct: 20_000 // Changed from 10_000
            });

        SchedulerState.SubscriptionParams memory newParams = SchedulerState
            .SubscriptionParams({
                priceIds: newPriceIds,
                readerWhitelist: newReaderWhitelist,
                whitelistEnabled: false, // Changed from true
                isActive: true,
                isPermanent: false,
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
            storedParams.gasConfig.maxBaseFeeMultiplierCapPct,
            20_000,
            "Max gas multiplier mismatch"
        );
    }

    function testUpdateSubscriptionClearsRemovedPriceFeeds() public {
        // 1. Setup: Add subscription with 3 price feeds, update prices
        uint8 numInitialFeeds = 3;
        uint256 subscriptionId = addTestSubscriptionWithFeeds(
            scheduler,
            numInitialFeeds,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory initialPriceIds = createPriceIds(numInitialFeeds);
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory initialPriceFeeds;
        uint64[] memory slots;
        (initialPriceFeeds, slots) = createMockPriceFeedsWithSlots(
            publishTime,
            numInitialFeeds
        );

        mockParsePriceFeedUpdatesWithSlots(pyth, initialPriceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(initialPriceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, initialPriceIds);

        // Verify initial state: All 3 feeds should be readable
        assertTrue(
            reader.verifyPriceFeeds(
                subscriptionId,
                initialPriceIds,
                initialPriceFeeds
            ),
            "Initial price feeds verification failed"
        );

        // 2. Action: Update subscription to remove the last price feed
        bytes32[] memory newPriceIds = new bytes32[](numInitialFeeds - 1);
        for (uint i = 0; i < newPriceIds.length; i++) {
            newPriceIds[i] = initialPriceIds[i];
        }
        bytes32 removedPriceId = initialPriceIds[numInitialFeeds - 1]; // The ID we removed

        (SchedulerState.SubscriptionParams memory currentParams, ) = scheduler
            .getSubscription(subscriptionId);
        SchedulerState.SubscriptionParams memory newParams = currentParams; // Copy existing params
        newParams.priceIds = newPriceIds; // Update price IDs

        vm.expectEmit(); // Expect SubscriptionUpdated
        emit SubscriptionUpdated(subscriptionId);
        scheduler.updateSubscription(subscriptionId, newParams);

        // 3. Verification:
        // - Querying the removed price ID should revert
        bytes32[] memory removedIdArray = new bytes32[](1);
        removedIdArray[0] = removedPriceId;
        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidPriceId.selector,
                removedPriceId,
                bytes32(0)
            )
        );
        scheduler.getPricesUnsafe(subscriptionId, removedIdArray);

        // - Querying the remaining price IDs should still work
        PythStructs.PriceFeed[]
            memory expectedRemainingFeeds = new PythStructs.PriceFeed[](
                newPriceIds.length
            );
        for (uint i = 0; i < newPriceIds.length; i++) {
            expectedRemainingFeeds[i] = initialPriceFeeds[i]; // Prices remain from the initial update
        }
        assertTrue(
            reader.verifyPriceFeeds(
                subscriptionId,
                newPriceIds,
                expectedRemainingFeeds
            ),
            "Remaining price feeds verification failed after update"
        );

        // - Querying all feeds (empty array) should return only the remaining feeds
        PythStructs.Price[] memory allPricesAfterUpdate = scheduler
            .getPricesUnsafe(subscriptionId, new bytes32[](0));
        assertEq(
            allPricesAfterUpdate.length,
            newPriceIds.length,
            "Querying all should only return remaining feeds"
        );
    }

    function testcreateSubscriptionWithInsufficientFundsReverts() public {
        uint8 numFeeds = 2;
        SchedulerState.SubscriptionParams
            memory params = createDefaultSubscriptionParams(
                numFeeds,
                address(reader)
            );

        // Calculate minimum balance
        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(params.priceIds.length)
        );

        // Try to add subscription with insufficient funds
        vm.expectRevert(abi.encodeWithSelector(InsufficientBalance.selector));
        scheduler.createSubscription{value: minimumBalance - 1 wei}(params);
    }

    function testActivateDeactivateSubscription() public {
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Get current params
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);

        // Deactivate subscription using updateSubscription
        params.isActive = false;

        vm.expectEmit();
        emit SubscriptionDeactivated(subscriptionId);
        vm.expectEmit();
        emit SubscriptionUpdated(subscriptionId);

        scheduler.updateSubscription(subscriptionId, params);

        // Verify subscription was deactivated
        (
            SchedulerState.SubscriptionParams memory storedParams,
            SchedulerState.SubscriptionStatus memory status
        ) = scheduler.getSubscription(subscriptionId);

        assertFalse(storedParams.isActive, "Subscription should be inactive");

        // Reactivate subscription using updateSubscription
        params.isActive = true;

        vm.expectEmit();
        emit SubscriptionActivated(subscriptionId);
        vm.expectEmit();
        emit SubscriptionUpdated(subscriptionId);

        scheduler.updateSubscription(subscriptionId, params);

        // Verify subscription was reactivated
        (storedParams, status) = scheduler.getSubscription(subscriptionId);

        assertTrue(storedParams.isActive, "Subscription should be active");
        assertTrue(
            storedParams.isActive,
            "Subscription params should show active"
        );
    }

    function testAddFunds() public {
        // First add a subscription
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Get initial balance (which includes minimum balance)
        (, SchedulerState.SubscriptionStatus memory initialStatus) = scheduler
            .getSubscription(subscriptionId);
        uint256 initialBalance = initialStatus.balanceInWei;

        // Add funds
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Verify funds were added
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            initialBalance + fundAmount,
            "Balance should match initial balance plus added funds"
        );
    }

    function testWithdrawFunds() public {
        // Add a subscription and get the parameters
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(params.priceIds.length)
        );

        // Add extra funds
        uint256 extraFunds = 1 ether;
        scheduler.addFunds{value: extraFunds}(subscriptionId);

        // Get initial balance
        uint256 initialBalance = address(this).balance;

        // Withdraw extra funds
        scheduler.withdrawFunds(subscriptionId, extraFunds);

        // Verify funds were withdrawn
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            minimumBalance,
            "Remaining balance should be minimum balance"
        );
        assertEq(
            address(this).balance,
            initialBalance + extraFunds,
            "Withdrawn amount not received"
        );

        // Try to withdraw below minimum balance
        vm.expectRevert(abi.encodeWithSelector(InsufficientBalance.selector));
        scheduler.withdrawFunds(subscriptionId, 1 wei);

        // Deactivate subscription
        params.isActive = false;
        scheduler.updateSubscription(subscriptionId, params);

        // Now we should be able to withdraw all funds
        scheduler.withdrawFunds(subscriptionId, minimumBalance);

        // Verify all funds were withdrawn
        (, status) = scheduler.getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            0,
            "Balance should be 0 after withdrawing all funds"
        );
    }

    function testPermanentSubscription() public {
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Verify subscription was created as non-permanent initially
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        assertFalse(params.isPermanent, "Should not be permanent initially");

        // Make it permanent
        params.isPermanent = true;
        scheduler.updateSubscription(subscriptionId, params);

        // Verify subscription is now permanent
        (SchedulerState.SubscriptionParams memory storedParams, ) = scheduler
            .getSubscription(subscriptionId);
        assertTrue(
            storedParams.isPermanent,
            "Subscription should be permanent"
        );

        // Test 1: Cannot disable isPermanent flag
        SchedulerState.SubscriptionParams memory updatedParams = storedParams;
        updatedParams.isPermanent = false;

        vm.expectRevert(
            abi.encodeWithSelector(
                IllegalPermanentSubscriptionModification.selector
            )
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 2: Cannot remove price feeds
        updatedParams = storedParams;
        bytes32[] memory reducedPriceIds = new bytes32[](
            params.priceIds.length - 1
        );
        for (uint i = 0; i < reducedPriceIds.length; i++) {
            reducedPriceIds[i] = params.priceIds[i];
        }
        updatedParams.priceIds = reducedPriceIds;

        vm.expectRevert(
            abi.encodeWithSelector(
                IllegalPermanentSubscriptionModification.selector
            )
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 3: Cannot withdraw funds
        uint256 extraFunds = 1 ether;
        vm.deal(address(0x123), extraFunds);

        // Anyone can add funds (not just manager)
        vm.prank(address(0x123));
        scheduler.addFunds{value: extraFunds}(subscriptionId);

        vm.expectRevert(
            abi.encodeWithSelector(
                IllegalPermanentSubscriptionModification.selector
            )
        );
        scheduler.withdrawFunds(subscriptionId, 0.1 ether);

        // Test 4: Can still add more price feeds
        updatedParams = storedParams;
        bytes32[] memory expandedPriceIds = new bytes32[](
            params.priceIds.length + 1
        );
        for (uint i = 0; i < params.priceIds.length; i++) {
            expandedPriceIds[i] = params.priceIds[i];
        }
        expandedPriceIds[params.priceIds.length] = bytes32(
            uint256(keccak256(abi.encodePacked("additional-price-id")))
        );
        updatedParams.priceIds = expandedPriceIds;
        updatedParams.isPermanent = true; // Ensure we keep isPermanent flag set to true

        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Verify price feeds were added
        (storedParams, ) = scheduler.getSubscription(subscriptionId);
        assertEq(
            storedParams.priceIds.length,
            params.priceIds.length + 1,
            "Should be able to add price feeds to permanent subscription"
        );
    }

    function testMakeExistingSubscriptionPermanent() public {
        // First create a non-permanent subscription
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Verify it's not permanent
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);

        assertFalse(
            params.isPermanent,
            "Subscription should not be permanent initially"
        );

        // Make it permanent
        params.isPermanent = true;
        scheduler.updateSubscription(subscriptionId, params);

        // Verify it's now permanent
        (params, ) = scheduler.getSubscription(subscriptionId);
        assertTrue(params.isPermanent, "Subscription should now be permanent");

        // Verify we can't make it non-permanent again
        params.isPermanent = false;
        vm.expectRevert(
            abi.encodeWithSelector(
                IllegalPermanentSubscriptionModification.selector
            )
        );
        scheduler.updateSubscription(subscriptionId, params);
    }

    function testAnyoneCanAddFunds() public {
        // Create a subscription
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Get initial balance
        (, SchedulerState.SubscriptionStatus memory initialStatus) = scheduler
            .getSubscription(subscriptionId);
        uint256 initialBalance = initialStatus.balanceInWei;

        // Have a different address add funds
        address funder = address(0x123);
        uint256 fundAmount = 1 ether;
        vm.deal(funder, fundAmount);

        vm.prank(funder);
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Verify funds were added
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.balanceInWei,
            initialBalance + fundAmount,
            "Balance should be increased by the funded amount"
        );
    }

    function testUpdatePriceFeedsWorks() public {
        // --- First Update ---
        // Add a subscription and funds
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        ); // Uses heartbeat 60s, deviation 100bps
        uint256 fundAmount = 2 ether; // Add enough for two updates
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Create price feeds and mock Pyth response for first update
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1;
        uint64[] memory slots;
        (priceFeeds1, slots) = createMockPriceFeedsWithSlots(
            publishTime1,
            priceIds.length
        );

        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds1, slots);
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

        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds2, slots); // Mock for the second call
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
            scheduler,
            criteria,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);
        // First update to set initial timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1;
        uint64[] memory slots1;
        (priceFeeds1, slots1) = createMockPriceFeedsWithSlots(publishTime1, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds1, slots1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update within heartbeat interval
        vm.warp(block.timestamp + 30); // Advance time by 30 seconds (less than 60)
        uint64 publishTime2 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds2;
        uint64[] memory slots2;
        (priceFeeds2, slots2) = createMockPriceFeedsWithSlots(publishTime2, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds2, slots2);
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
            scheduler,
            criteria,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // First update to set initial price
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1;
        uint64[] memory slots;
        (priceFeeds1, slots) = createMockPriceFeedsWithSlots(publishTime1, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds1, slots);
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

        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds2, slots);
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
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // First update to establish last updated timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime1 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds1;
        uint64[] memory slots1;
        (priceFeeds1, slots1) = createMockPriceFeedsWithSlots(publishTime1, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds1, slots1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update with an older timestamp
        uint64 publishTime2 = publishTime1 - 10; // Timestamp older than the first update
        PythStructs.PriceFeed[] memory priceFeeds2;
        uint64[] memory slots2;
        (priceFeeds2, slots2) = createMockPriceFeedsWithSlots(publishTime2, 2);
        // Mock Pyth response to return feeds with the older timestamp
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds2, slots2);
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

    function testUpdatePriceFeedsRevertsOnMismatchedSlots() public {
        // First add a subscription and funds
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Create two price feeds with same timestamp but different slots
        bytes32[] memory priceIds = createPriceIds(2);
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            2
        );
        priceFeeds[0] = createSingleMockPriceFeed(publishTime);
        priceFeeds[1] = createSingleMockPriceFeed(publishTime);

        // Create slots array with different slot values
        uint64[] memory slots = new uint64[](2);
        slots[0] = 100;
        slots[1] = 200; // Different slot

        // Mock Pyth response to return these feeds with mismatched slots
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Expect revert with PriceSlotMismatch error
        vm.expectRevert(abi.encodeWithSelector(PriceSlotMismatch.selector));

        // Attempt to update price feeds
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
    }

    function testGetPricesUnsafeAllFeeds() public {
        // First add a subscription, funds, and update price feeds
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(publishTime, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
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
        uint256 subscriptionId = addTestSubscriptionWithFeeds(
            scheduler,
            3,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds(3);
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(publishTime, 3);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
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

    function testDisabledWhitelistAllowsUnrestrictedReads() public {
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Get params and modify them
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        params.whitelistEnabled = false;
        params.readerWhitelist = new address[](0);
        scheduler.updateSubscription(subscriptionId, params);

        // Fund the subscription with enough to update it
        scheduler.addFunds{value: 1 ether}(subscriptionId);

        // Update price feeds for the subscription
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(publishTime, 2);
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);
        bytes32[] memory priceIds = params.priceIds;

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Try to access from a non-whitelisted address (should succeed)
        address randomUser = address(0xdead);
        vm.startPrank(randomUser);
        bytes32[] memory emptyPriceIds = new bytes32[](0);

        // Should not revert since whitelist is disabled
        scheduler.getPricesUnsafe(subscriptionId, emptyPriceIds);
        vm.stopPrank();

        // Verify the data is correct using the test's reader
        assertTrue(
            reader.verifyPriceFeeds(subscriptionId, emptyPriceIds, priceFeeds),
            "Whitelist Disabled: Price feeds verification failed"
        );
    }

    function testEnabledWhitelistEnforcesOnlyAuthorizedReads() public {
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Fund the subscription with enough to update it
        scheduler.addFunds{value: 1 ether}(subscriptionId);

        // Get the price IDs from the created subscription
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        bytes32[] memory priceIds = params.priceIds;

        // Update price feeds for the subscription
        uint64 publishTime = SafeCast.toUint64(block.timestamp + 10); // Slightly different time
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(
            publishTime,
            priceIds.length
        );
        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Try to access from a non-whitelisted address (should fail)
        vm.startPrank(address(0xdead));
        bytes32[] memory emptyPriceIds = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(Unauthorized.selector));
        scheduler.getPricesUnsafe(subscriptionId, emptyPriceIds);
        vm.stopPrank();

        // Try to access from the whitelisted reader address (should succeed)
        // Note: We call via the reader contract instance itself
        PythStructs.Price[] memory pricesFromReader = reader.getPricesUnsafe(
            subscriptionId,
            emptyPriceIds
        );
        assertEq(
            pricesFromReader.length,
            priceIds.length,
            "Whitelist Enabled: Reader should get correct number of prices"
        );

        // Verify the data obtained by the whitelisted reader is correct
        assertTrue(
            reader.verifyPriceFeeds(subscriptionId, emptyPriceIds, priceFeeds),
            "Whitelist Enabled: Price feeds verification failed via reader"
        );

        // Try to access from the manager address (should succeed)
        // Test contract is the manager
        vm.startPrank(address(this));
        PythStructs.Price[] memory pricesFromManager = scheduler
            .getPricesUnsafe(subscriptionId, emptyPriceIds);
        assertEq(
            pricesFromManager.length,
            priceIds.length,
            "Whitelist Enabled: Manager should get correct number of prices"
        );
        vm.stopPrank();
    }

    function testGetEmaPriceUnsafe() public {
        // First add a subscription, funds, and update price feeds
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(publishTime, 2);

        // Ensure EMA prices are set in the mock price feeds
        for (uint i = 0; i < priceFeeds.length; i++) {
            priceFeeds[i].emaPrice.price = priceFeeds[i].price.price * 2; // Make EMA price different for testing
            priceFeeds[i].emaPrice.conf = priceFeeds[i].price.conf;
            priceFeeds[i].emaPrice.publishTime = publishTime;
            priceFeeds[i].emaPrice.expo = priceFeeds[i].price.expo;
        }

        mockParsePriceFeedUpdatesWithSlots(pyth, priceFeeds, slots);
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
        // Add two subscriptions with the test contract as manager
        addTestSubscription(scheduler, address(reader));
        addTestSubscription(scheduler, address(reader));

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
            maxBaseFeeMultiplierCapPct: 10_000,
            maxPriorityFeeMultiplierCapPct: 10_000
        });

        SchedulerState.SubscriptionParams memory pusherParams = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: emptyWhitelist,
                whitelistEnabled: false,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria,
                gasConfig: gasConfig
            });

        uint256 minimumBalance = scheduler.getMinimumBalance(
            uint8(priceIds.length)
        );
        vm.deal(pusher, minimumBalance);
        scheduler.createSubscription{value: minimumBalance}(pusherParams);
        vm.stopPrank();

        // Get active subscriptions directly - should work without any special permissions
        uint256[] memory activeIds;
        SchedulerState.SubscriptionParams[] memory activeParams;
        uint256 totalCount;

        (activeIds, activeParams, totalCount) = scheduler
            .getActiveSubscriptions(0, 10);

        // We added 3 subscriptions and all should be active
        assertEq(activeIds.length, 3, "Should have 3 active subscriptions");
        assertEq(
            activeParams.length,
            3,
            "Should have 3 active subscription params"
        );
        assertEq(totalCount, 3, "Total count should be 3");

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
        (uint256[] memory firstPageIds, , uint256 firstPageTotal) = scheduler
            .getActiveSubscriptions(0, 1);

        assertEq(
            firstPageIds.length,
            1,
            "Should have 1 subscription in first page"
        );
        assertEq(firstPageTotal, 3, "Total count should still be 3");

        // Test pagination - get the second page
        vm.prank(owner);
        (uint256[] memory secondPageIds, , uint256 secondPageTotal) = scheduler
            .getActiveSubscriptions(1, 2);

        assertEq(
            secondPageIds.length,
            2,
            "Should have 2 subscriptions in second page"
        );
        assertEq(secondPageTotal, 3, "Total count should still be 3");

        // Test pagination - start index beyond total count
        vm.prank(owner);
        (uint256[] memory emptyPageIds, , uint256 emptyPageTotal) = scheduler
            .getActiveSubscriptions(10, 10);

        assertEq(
            emptyPageIds.length,
            0,
            "Should have 0 subscriptions when start index is beyond total"
        );
        assertEq(emptyPageTotal, 3, "Total count should still be 3");
    }

    function testSubscriptionParamValidations() public {
        uint256 initialSubId = 0; // For update tests

        // === Empty Price IDs ===
        SchedulerState.SubscriptionParams
            memory emptyPriceIdsParams = createDefaultSubscriptionParams(
                1,
                address(reader)
            );
        emptyPriceIdsParams.priceIds = new bytes32[](0);

        vm.expectRevert(abi.encodeWithSelector(EmptyPriceIds.selector));
        scheduler.createSubscription{value: 1 ether}(emptyPriceIdsParams);

        initialSubId = addTestSubscription(scheduler, address(reader)); // Create a valid one for update test
        vm.expectRevert(abi.encodeWithSelector(EmptyPriceIds.selector));
        scheduler.updateSubscription(initialSubId, emptyPriceIdsParams);

        // === Duplicate Price IDs ===
        SchedulerState.SubscriptionParams
            memory duplicatePriceIdsParams = createDefaultSubscriptionParams(
                2,
                address(reader)
            );
        bytes32 duplicateId = duplicatePriceIdsParams.priceIds[0];
        duplicatePriceIdsParams.priceIds[1] = duplicateId;

        vm.expectRevert(
            abi.encodeWithSelector(DuplicatePriceId.selector, duplicateId)
        );
        scheduler.createSubscription{value: 1 ether}(duplicatePriceIdsParams);

        initialSubId = addTestSubscription(scheduler, address(reader));
        vm.expectRevert(
            abi.encodeWithSelector(DuplicatePriceId.selector, duplicateId)
        );
        scheduler.updateSubscription(initialSubId, duplicatePriceIdsParams);

        // === Too Many Whitelist Readers ===
        SchedulerState.SubscriptionParams
            memory largeWhitelistParams = createDefaultSubscriptionParams(
                1,
                address(reader)
            );
        uint whitelistLength = uint(scheduler.MAX_READER_WHITELIST_SIZE()) + 1;
        address[] memory largeWhitelist = new address[](whitelistLength);
        for (uint i = 0; i < whitelistLength; i++) {
            largeWhitelist[i] = address(uint160(i + 1)); // Unique addresses
        }
        largeWhitelistParams.readerWhitelist = largeWhitelist;

        vm.expectRevert(
            abi.encodeWithSelector(
                TooManyWhitelistedReaders.selector,
                largeWhitelist.length,
                scheduler.MAX_READER_WHITELIST_SIZE()
            )
        );
        scheduler.createSubscription{value: 1 ether}(largeWhitelistParams);

        initialSubId = addTestSubscription(scheduler, address(reader));
        vm.expectRevert(
            abi.encodeWithSelector(
                TooManyWhitelistedReaders.selector,
                largeWhitelist.length,
                scheduler.MAX_READER_WHITELIST_SIZE()
            )
        );
        scheduler.updateSubscription(initialSubId, largeWhitelistParams);

        // === Duplicate Whitelist Address ===
        SchedulerState.SubscriptionParams
            memory duplicateWhitelistParams = createDefaultSubscriptionParams(
                1,
                address(reader)
            );
        address[] memory duplicateWhitelist = new address[](2);
        duplicateWhitelist[0] = address(reader);
        duplicateWhitelist[1] = address(reader); // Duplicate
        duplicateWhitelistParams.readerWhitelist = duplicateWhitelist;

        vm.expectRevert(
            abi.encodeWithSelector(
                DuplicateWhitelistAddress.selector,
                address(reader)
            )
        );
        scheduler.createSubscription{value: 1 ether}(duplicateWhitelistParams);

        initialSubId = addTestSubscription(scheduler, address(reader));
        vm.expectRevert(
            abi.encodeWithSelector(
                DuplicateWhitelistAddress.selector,
                address(reader)
            )
        );
        scheduler.updateSubscription(initialSubId, duplicateWhitelistParams);

        // === Invalid Heartbeat (Zero Seconds) ===
        SchedulerState.SubscriptionParams
            memory invalidHeartbeatParams = createDefaultSubscriptionParams(
                1,
                address(reader)
            );
        invalidHeartbeatParams.updateCriteria.updateOnHeartbeat = true;
        invalidHeartbeatParams.updateCriteria.heartbeatSeconds = 0; // Invalid

        vm.expectRevert(abi.encodeWithSelector(InvalidUpdateCriteria.selector));
        scheduler.createSubscription{value: 1 ether}(invalidHeartbeatParams);

        initialSubId = addTestSubscription(scheduler, address(reader));
        vm.expectRevert(abi.encodeWithSelector(InvalidUpdateCriteria.selector));
        scheduler.updateSubscription(initialSubId, invalidHeartbeatParams);

        // === Invalid Deviation (Zero Bps) ===
        SchedulerState.SubscriptionParams
            memory invalidDeviationParams = createDefaultSubscriptionParams(
                1,
                address(reader)
            );
        invalidDeviationParams.updateCriteria.updateOnDeviation = true;
        invalidDeviationParams.updateCriteria.deviationThresholdBps = 0; // Invalid

        vm.expectRevert(abi.encodeWithSelector(InvalidUpdateCriteria.selector));
        scheduler.createSubscription{value: 1 ether}(invalidDeviationParams);

        initialSubId = addTestSubscription(scheduler, address(reader));
        vm.expectRevert(abi.encodeWithSelector(InvalidUpdateCriteria.selector));
        scheduler.updateSubscription(initialSubId, invalidDeviationParams);
    }

    // Required to receive ETH when withdrawing funds
    receive() external payable {}
}
