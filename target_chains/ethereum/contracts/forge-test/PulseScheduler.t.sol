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

    function getLatestPrices(
        uint256 subscriptionId,
        bytes32[] memory priceIds
    ) external view returns (PythStructs.PriceFeed[] memory) {
        return IScheduler(_scheduler).getLatestPrices(subscriptionId, priceIds);
    }

    function verifyPriceFeeds(
        uint256 subscriptionId,
        bytes32[] memory priceIds,
        PythStructs.PriceFeed[] memory expectedFeeds
    ) external view returns (bool) {
        PythStructs.PriceFeed[] memory actualFeeds = IScheduler(_scheduler)
            .getLatestPrices(subscriptionId, priceIds);

        if (actualFeeds.length != expectedFeeds.length) {
            return false;
        }

        for (uint i = 0; i < actualFeeds.length; i++) {
            if (
                actualFeeds[i].id != expectedFeeds[i].id ||
                actualFeeds[i].price.price != expectedFeeds[i].price.price ||
                actualFeeds[i].price.conf != expectedFeeds[i].price.conf ||
                actualFeeds[i].price.publishTime !=
                expectedFeeds[i].price.publishTime
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
            maxGasPrice: 100 gwei,
            maxGasLimit: 1_000_000
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
            storedParams.gasConfig.maxGasPrice,
            100 gwei,
            "Max gas price mismatch"
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
                maxGasPrice: 200 gwei, // Changed from 100 gwei
                maxGasLimit: 2_000_000 // Changed from 1_000_000
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
            storedParams.gasConfig.maxGasPrice,
            200 gwei,
            "Max gas price mismatch"
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

    function testUpdatePriceFeeds() public {
        // First add a subscription and funds
        uint256 subscriptionId = addTestSubscription();
        uint256 fundAmount = 1 ether;
        scheduler.addFunds{value: fundAmount}(subscriptionId);

        // Create price feeds and mock Pyth response
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Update price feeds
        vm.expectEmit();
        emit PricesUpdated(subscriptionId, publishTime);

        vm.prank(pusher);
        scheduler.updatePriceFeeds(subscriptionId, updateData, priceIds);

        // Verify price feeds were updated
        (, SchedulerState.SubscriptionStatus memory status) = scheduler
            .getSubscription(subscriptionId);

        assertEq(
            status.priceLastUpdatedAt,
            publishTime,
            "Last updated timestamp incorrect"
        );
        assertEq(status.totalUpdates, 1, "Total updates should be 1");
        assertTrue(
            status.totalSpent > 0,
            "Total spent should be greater than 0"
        );
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

    function testGetLatestPricesAllFeeds() public {
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
        PythStructs.PriceFeed[] memory latestPrices = scheduler.getLatestPrices(
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

    function testGetLatestPricesSelectiveFeeds() public {
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

        PythStructs.PriceFeed[] memory latestPrices = scheduler.getLatestPrices(
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
            maxGasPrice: 100 gwei,
            maxGasLimit: 1_000_000
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
        scheduler.getLatestPrices(subscriptionId, emptyPriceIds);
        vm.stopPrank();

        // Verify the data is correct
        assertTrue(
            reader.verifyPriceFeeds(subscriptionId, emptyPriceIds, priceFeeds),
            "Price feeds verification failed"
        );
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
            maxGasPrice: 100 gwei,
            maxGasLimit: 1_000_000
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
            SchedulerState.SubscriptionParams[] memory activeParams
        ) = scheduler.getActiveSubscriptions();

        // Verify active subscriptions
        assertEq(activeIds.length, 3, "Should have 3 active subscriptions");
        assertEq(
            activeParams.length,
            3,
            "Should have 3 active subscription params"
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
            maxGasPrice: 100 gwei,
            maxGasLimit: 1_000_000
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
            maxGasPrice: 100 gwei,
            maxGasLimit: 1_000_000
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

    // Required to receive ETH when withdrawing funds
    receive() external payable {}
}
