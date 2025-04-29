// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/SchedulerUpgradeable.sol";
import "../contracts/pulse/IScheduler.sol";
import "../contracts/pulse/SchedulerState.sol";
import "../contracts/pulse/SchedulerEvents.sol";
import "../contracts/pulse/SchedulerErrors.sol";
import "./utils/PulseSchedulerTestUtils.t.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

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

    function setUp() public {
        owner = address(1);
        admin = address(2);
        pyth = address(3);
        pusher = address(4);

        uint128 minBalancePerFeed = 10 ** 16; // 0.01 ether
        uint128 keeperFee = 10 ** 14; // 0.0001 ether

        SchedulerUpgradeable _scheduler = new SchedulerUpgradeable();
        proxy = new ERC1967Proxy(address(_scheduler), "");
        scheduler = SchedulerUpgradeable(address(proxy));

        scheduler.initialize(owner, admin, pyth, minBalancePerFeed, keeperFee);

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

        SchedulerState.SubscriptionParams memory newParams = SchedulerState
            .SubscriptionParams({
                priceIds: newPriceIds,
                readerWhitelist: newReaderWhitelist,
                whitelistEnabled: false, // Changed from true
                isActive: true,
                isPermanent: false,
                updateCriteria: newUpdateCriteria
            });

        // Add the required funds to cover the new minimum balance
        scheduler.addFunds{
            value: scheduler.getMinimumBalance(uint8(newPriceIds.length))
        }(subscriptionId);

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

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, initialPriceFeeds, slots);
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
        // Add multiple subscriptions
        uint256 subId1 = addTestSubscription(scheduler, address(reader)); // ID 1
        uint256 subId2 = addTestSubscription(scheduler, address(reader)); // ID 2
        uint256 subId3 = addTestSubscription(scheduler, address(reader)); // ID 3

        // --- Verify initial state ---
        (uint256[] memory activeIds, , uint256 totalCount) = scheduler
            .getActiveSubscriptions(0, 10);
        assertEq(totalCount, 3, "Initial: Total count should be 3");
        assertEq(activeIds.length, 3, "Initial: Active IDs length should be 3");
        assertEq(activeIds[0], subId1, "Initial: ID 1 should be active");
        assertEq(activeIds[1], subId2, "Initial: ID 2 should be active");
        assertEq(activeIds[2], subId3, "Initial: ID 3 should be active");

        // --- Deactivate the middle subscription (ID 2) ---
        (SchedulerState.SubscriptionParams memory params2, ) = scheduler
            .getSubscription(subId2);
        params2.isActive = false;
        vm.expectEmit();
        emit SubscriptionDeactivated(subId2);
        vm.expectEmit();
        emit SubscriptionUpdated(subId2);
        scheduler.updateSubscription(subId2, params2);

        // Verify state after deactivating ID 2
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 2, "After Deact 2: Total count should be 2");
        assertEq(
            activeIds.length,
            2,
            "After Deact 2: Active IDs length should be 2"
        );
        assertEq(activeIds[0], subId1, "After Deact 2: ID 1 should be active");
        assertEq(
            activeIds[1],
            subId3,
            "After Deact 2: ID 3 should be active (moved)"
        ); // ID 3 takes the place of ID 2

        // --- Deactivate the last subscription (ID 3, now at index 1) ---
        (SchedulerState.SubscriptionParams memory params3, ) = scheduler
            .getSubscription(subId3);
        params3.isActive = false;
        vm.expectEmit();
        emit SubscriptionDeactivated(subId3);
        vm.expectEmit();
        emit SubscriptionUpdated(subId3);
        scheduler.updateSubscription(subId3, params3);

        // Verify state after deactivating ID 3
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 1, "After Deact 3: Total count should be 1");
        assertEq(
            activeIds.length,
            1,
            "After Deact 3: Active IDs length should be 1"
        );
        assertEq(
            activeIds[0],
            subId1,
            "After Deact 3: Only ID 1 should be active"
        );

        // --- Reactivate the middle subscription (ID 2) ---
        params2.isActive = true; // Use the params struct from earlier
        vm.expectEmit();
        emit SubscriptionActivated(subId2);
        vm.expectEmit();
        emit SubscriptionUpdated(subId2);
        scheduler.updateSubscription(subId2, params2);

        // Verify state after reactivating ID 2
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 2, "After React 2: Total count should be 2");
        assertEq(
            activeIds.length,
            2,
            "After React 2: Active IDs length should be 2"
        );
        assertEq(activeIds[0], subId1, "After React 2: ID 1 should be active");
        assertEq(activeIds[1], subId2, "After React 2: ID 2 should be active"); // ID 2 is added back to the end

        // --- Reactivate the last subscription (ID 3) ---
        params3.isActive = true; // Use the params struct from earlier
        vm.expectEmit();
        emit SubscriptionActivated(subId3);
        vm.expectEmit();
        emit SubscriptionUpdated(subId3);
        scheduler.updateSubscription(subId3, params3);

        // Verify final state (all active)
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 3, "Final: Total count should be 3");
        assertEq(activeIds.length, 3, "Final: Active IDs length should be 3");
        assertEq(activeIds[0], subId1, "Final: ID 1 should be active");
        assertEq(activeIds[1], subId2, "Final: ID 2 should be active");
        assertEq(activeIds[2], subId3, "Final: ID 3 should be active"); // ID 3 is added back to the end

        // --- Deactivate all remaining subscriptions ---
        // Deactivate ID 1 (first element)
        (SchedulerState.SubscriptionParams memory params1, ) = scheduler
            .getSubscription(subId1);
        params1.isActive = false;
        vm.expectEmit();
        emit SubscriptionDeactivated(subId1);
        vm.expectEmit();
        emit SubscriptionUpdated(subId1);
        scheduler.updateSubscription(subId1, params1);

        // Verify state after deactivating ID 1
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 2, "After Deact 1: Total count should be 2");
        assertEq(
            activeIds.length,
            2,
            "After Deact 1: Active IDs length should be 2"
        );
        assertEq(
            activeIds[0],
            subId3,
            "After Deact 1: ID 3 should be at index 0"
        ); // ID 3 moved to front
        assertEq(
            activeIds[1],
            subId2,
            "After Deact 1: ID 2 should be at index 1"
        );

        // Deactivate ID 2 (now last element)
        params2.isActive = false; // Use existing params struct
        vm.expectEmit();
        emit SubscriptionDeactivated(subId2);
        vm.expectEmit();
        emit SubscriptionUpdated(subId2);
        scheduler.updateSubscription(subId2, params2);

        // Verify state after deactivating ID 2
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(
            totalCount,
            1,
            "After Deact 2 (again): Total count should be 1"
        );
        assertEq(
            activeIds.length,
            1,
            "After Deact 2 (again): Active IDs length should be 1"
        );
        assertEq(
            activeIds[0],
            subId3,
            "After Deact 2 (again): Only ID 3 should be active"
        );

        // Deactivate ID 3 (last remaining element)
        params3.isActive = false; // Use existing params struct
        vm.expectEmit();
        emit SubscriptionDeactivated(subId3);
        vm.expectEmit();
        emit SubscriptionUpdated(subId3);
        scheduler.updateSubscription(subId3, params3);

        // Verify final empty state
        (activeIds, , totalCount) = scheduler.getActiveSubscriptions(0, 10);
        assertEq(totalCount, 0, "Empty: Total count should be 0");
        assertEq(activeIds.length, 0, "Empty: Active IDs length should be 0");
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
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
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
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 3: Cannot withdraw funds
        uint256 extraFunds = 1 ether;
        vm.deal(address(0x123), extraFunds);

        // Anyone can add funds (not just manager)
        vm.prank(address(0x123));
        scheduler.addFunds{value: extraFunds}(subscriptionId);

        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.withdrawFunds(subscriptionId, 0.1 ether);

        // Test 4: Cannot add more price feeds
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

        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Verify price feeds were not added (length should remain the same)
        (storedParams, ) = scheduler.getSubscription(subscriptionId);
        assertEq(
            storedParams.priceIds.length,
            params.priceIds.length, // Verify length hasn't changed
            "Should not be able to add price feeds to permanent subscription"
        );

        // Test 6: Cannot change updateCriteria
        updatedParams = storedParams;
        updatedParams.updateCriteria.heartbeatSeconds =
            storedParams.updateCriteria.heartbeatSeconds +
            60;
        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 7: Cannot change whitelistEnabled
        updatedParams = storedParams;
        updatedParams.whitelistEnabled = !storedParams.whitelistEnabled;
        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 8: Cannot change the set of readers in the whitelist (add one)
        updatedParams = storedParams;
        address[] memory expandedWhitelist = new address[](
            storedParams.readerWhitelist.length + 1
        );
        for (uint i = 0; i < storedParams.readerWhitelist.length; i++) {
            expandedWhitelist[i] = storedParams.readerWhitelist[i];
        }
        expandedWhitelist[storedParams.readerWhitelist.length] = address(0x456);
        updatedParams.readerWhitelist = expandedWhitelist;
        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);

        // Test 9: Cannot change the set of readers in the whitelist (remove one)
        // Requires at least one reader in the initial setup
        if (storedParams.readerWhitelist.length > 0) {
            updatedParams = storedParams;
            address[] memory reducedWhitelist = new address[](
                storedParams.readerWhitelist.length - 1
            );
            for (uint i = 0; i < reducedWhitelist.length; i++) {
                reducedWhitelist[i] = storedParams.readerWhitelist[i];
            }
            updatedParams.readerWhitelist = reducedWhitelist;
            vm.expectRevert(
                abi.encodeWithSelector(
                    CannotUpdatePermanentSubscription.selector
                )
            );
            scheduler.updateSubscription(subscriptionId, updatedParams);
        }

        // Test 10: Cannot deactivate a permanent subscription
        updatedParams = storedParams;
        updatedParams.isActive = false;
        vm.expectRevert(
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
        );
        scheduler.updateSubscription(subscriptionId, updatedParams);
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
            abi.encodeWithSelector(CannotUpdatePermanentSubscription.selector)
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

    function testUpdatePriceFeedsUpdatesPricesCorrectly() public {
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

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds1, slots);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);

        // Perform first update
        vm.expectEmit();
        emit PricesUpdated(subscriptionId, publishTime1);
        vm.prank(pusher);

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
            priceIds.length,
            "Total updates should be equal to the number of price feeds"
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

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds2, slots); // Mock for the second call
        bytes[] memory updateData2 = createMockUpdateData(priceFeeds2);

        // Perform second update
        vm.expectEmit();
        emit PricesUpdated(subscriptionId, publishTime2);
        vm.prank(pusher);

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
            priceIds.length * 2,
            "Total updates should be equal to the number of price feeds * 2 (first + second update)"
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

    function testUpdatePriceFeedsPaysKeeperCorrectly() public {
        // Set gas price
        uint256 gasPrice = 0.1 gwei;
        vm.txGasPrice(gasPrice);

        // Add subscription and funds
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );

        // Prepare update data
        (SchedulerState.SubscriptionParams memory params, ) = scheduler
            .getSubscription(subscriptionId);
        (
            PythStructs.PriceFeed[] memory priceFeeds,
            uint64[] memory slots
        ) = createMockPriceFeedsWithSlots(
                SafeCast.toUint64(block.timestamp),
                params.priceIds.length
            );

        uint256 mockPythFee = MOCK_PYTH_FEE_PER_FEED * params.priceIds.length;
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Get state before
        uint256 pusherBalanceBefore = pusher.balance;
        (, SchedulerState.SubscriptionStatus memory statusBefore) = scheduler
            .getSubscription(subscriptionId);
        console.log(
            "Subscription balance before update:",
            vm.toString(statusBefore.balanceInWei)
        );

        // Perform update
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, params.priceIds);

        // Get state after
        (, SchedulerState.SubscriptionStatus memory statusAfter) = scheduler
            .getSubscription(subscriptionId);

        // Calculate total fee deducted from subscription
        uint256 totalFeeDeducted = statusBefore.balanceInWei -
            statusAfter.balanceInWei;

        // Calculate minimum keeper fee (overhead + feed-specific fee)
        // The real cost is more because of the gas used in the updatePriceFeeds function
        uint256 minKeeperFee = (scheduler.GAS_OVERHEAD() * gasPrice) +
            (uint256(scheduler.getSingleUpdateKeeperFeeInWei()) *
                params.priceIds.length);

        assertGt(
            totalFeeDeducted,
            minKeeperFee + mockPythFee,
            "Total fee deducted should be greater than the sum of keeper fee and Pyth fee (since gas usage of updatePriceFeeds is not accounted for)"
        );
        assertEq(
            statusAfter.totalSpent,
            statusBefore.totalSpent + totalFeeDeducted,
            "Total spent should increase by the total fee deducted"
        );
        assertEq(
            pusher.balance,
            pusherBalanceBefore + totalFeeDeducted - mockPythFee,
            "Pusher balance should increase by the keeper fee"
        );

        // This assertion is self-evident based on the calculations above, but keeping it for clarity
        assertEq(
            statusAfter.balanceInWei,
            statusBefore.balanceInWei - totalFeeDeducted,
            "Subscription balance should decrease by the total fee deducted"
        );
    }

    function testUpdatePriceFeedsRevertsInsufficientBalanceForKeeperFee()
        public
    {
        // Set gas price
        uint256 gasPrice = 0.5 gwei;
        vm.txGasPrice(gasPrice);

        // Mock the minimum balance for the subscription to be
        // zero so that we can test the keeper fee
        vm.mockCall(
            address(scheduler),
            abi.encodeWithSelector(Scheduler.getMinimumBalance.selector),
            abi.encode(0)
        );

        // Add subscription
        uint256 subscriptionId = addTestSubscription(
            scheduler,
            address(reader)
        );
        bytes32[] memory priceIds = createPriceIds();

        // Prepare update data and get Pyth fee
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds;
        uint64[] memory slots;
        (priceFeeds, slots) = createMockPriceFeedsWithSlots(
            publishTime,
            priceIds.length
        );
        uint256 mockPythFee = MOCK_PYTH_FEE_PER_FEED * priceIds.length;
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Calculate minimum keeper fee (overhead + feed-specific fee)
        // The real cost is more because of the gas used in the updatePriceFeeds function
        uint256 minKeeperFee = (scheduler.GAS_OVERHEAD() * gasPrice) +
            (uint256(scheduler.getSingleUpdateKeeperFeeInWei()) *
                priceIds.length);

        // Fund subscription without enough for Pyth fee + keeper fee
        // It won't be enough because of the gas cost of updatePriceFeeds
        uint256 fundAmount = mockPythFee + minKeeperFee;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Get and print the subscription balance before attempting the update
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);
        console.log(
            "Subscription balance before update:",
            vm.toString(status.balanceInWei)
        );
        console.log("Required Pyth fee:", vm.toString(mockPythFee));
        console.log("Minimum keeper fee:", vm.toString(minKeeperFee));
        console.log(
            "Total minimum required:",
            vm.toString(mockPythFee + minKeeperFee)
        );

        // Expect revert due to insufficient balance for total fee
        vm.expectRevert(abi.encodeWithSelector(InsufficientBalance.selector));
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds1, slots1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update within heartbeat interval
        vm.warp(block.timestamp + 30); // Advance time by 30 seconds (less than 60)
        uint64 publishTime2 = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds2;
        uint64[] memory slots2;
        (priceFeeds2, slots2) = createMockPriceFeedsWithSlots(publishTime2, 2);
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds2, slots2);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds1, slots);
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

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds2, slots);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds1, slots1);
        bytes[] memory updateData1 = createMockUpdateData(priceFeeds1);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData1, priceIds);

        // Prepare second update with an older timestamp
        uint64 publishTime2 = publishTime1 - 10; // Timestamp older than the first update
        PythStructs.PriceFeed[] memory priceFeeds2;
        uint64[] memory slots2;
        (priceFeeds2, slots2) = createMockPriceFeedsWithSlots(publishTime2, 2);
        // Mock Pyth response to return feeds with the older timestamp
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds2, slots2);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Expect revert with PriceSlotMismatch error
        vm.expectRevert(abi.encodeWithSelector(PriceSlotMismatch.selector));

        // Attempt to update price feeds
        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);
    }

    function testUpdateSubscriptionEnforcesMinimumBalanceOnAddingFeeds()
        public
    {
        // Setup: Create subscription with 2 feeds, funded exactly to minimum
        uint8 initialNumFeeds = 2;
        uint256 subscriptionId = addTestSubscriptionWithFeeds(
            scheduler,
            initialNumFeeds,
            address(reader)
        );
        (
            SchedulerState.SubscriptionParams memory currentParams,
            SchedulerState.SubscriptionStatus memory initialStatus
        ) = scheduler.getSubscription(subscriptionId);
        uint256 initialMinimumBalance = scheduler.getMinimumBalance(
            initialNumFeeds
        );
        assertEq(
            initialStatus.balanceInWei,
            initialMinimumBalance,
            "Initial balance should be the minimum"
        );

        // Prepare new params with more feeds (4)
        uint8 newNumFeeds = 4;
        SchedulerState.SubscriptionParams memory newParams = currentParams;
        newParams.priceIds = createPriceIds(newNumFeeds); // Increase feeds
        newParams.isActive = true; // Keep it active

        // Action 1: Try to update with insufficient funds
        vm.expectRevert(abi.encodeWithSelector(InsufficientBalance.selector));
        scheduler.updateSubscription(subscriptionId, newParams);

        // Action 2: Supply enough funds to the updateSubscription call to meet the new minimum balance
        uint256 newMinimumBalance = scheduler.getMinimumBalance(newNumFeeds);
        uint256 requiredFunds = newMinimumBalance - initialMinimumBalance;

        scheduler.updateSubscription{value: requiredFunds}(
            subscriptionId,
            newParams
        );

        // Verification 2: Update should now succeed
        (SchedulerState.SubscriptionParams memory updatedParams, ) = scheduler
            .getSubscription(subscriptionId);
        assertEq(
            updatedParams.priceIds.length,
            newNumFeeds,
            "Number of price feeds should be updated"
        );

        // Scenario 3: Deactivating while adding feeds - should NOT check min balance
        // Reset state: create another subscription funded to minimum
        uint8 initialNumFeeds_deact = 2;
        uint256 subId_deact = addTestSubscriptionWithFeeds(
            scheduler,
            initialNumFeeds_deact,
            address(reader)
        );

        // Prepare params to add feeds (4) but also deactivate
        uint8 newNumFeeds_deact = 4;
        (
            SchedulerState.SubscriptionParams memory currentParams_deact,

        ) = scheduler.getSubscription(subId_deact);
        SchedulerState.SubscriptionParams
            memory newParams_deact = currentParams_deact;
        newParams_deact.priceIds = createPriceIds(newNumFeeds_deact);
        newParams_deact.isActive = false; // Deactivate

        // Action 3: Update (should succeed even with insufficient funds for 4 feeds)
        scheduler.updateSubscription(subId_deact, newParams_deact);

        // Verification 3: Subscription should be inactive and have 4 feeds
        (
            SchedulerState.SubscriptionParams memory updatedParams_deact,

        ) = scheduler.getSubscription(subId_deact);
        assertFalse(
            updatedParams_deact.isActive,
            "Subscription should be inactive"
        );
        assertEq(
            updatedParams_deact.priceIds.length,
            newNumFeeds_deact,
            "Number of price feeds should be updated even when deactivating"
        );
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
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
        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
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

        mockParsePriceFeedUpdatesWithSlotsStrict(pyth, priceFeeds, slots);
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

        SchedulerState.SubscriptionParams memory pusherParams = SchedulerState
            .SubscriptionParams({
                priceIds: priceIds,
                readerWhitelist: emptyWhitelist,
                whitelistEnabled: false,
                isActive: true,
                isPermanent: false,
                updateCriteria: updateCriteria
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
