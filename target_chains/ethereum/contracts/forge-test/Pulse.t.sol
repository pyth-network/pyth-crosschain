// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";
import "../contracts/pulse/PulseEvents.sol";
import "../contracts/pulse/PulseErrors.sol";

contract MockPulseConsumer is IPulseConsumer {
    uint64 public lastSequenceNumber;
    PythStructs.PriceFeed[] private _lastPriceFeeds;

    function pulseCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) external override {
        lastSequenceNumber = sequenceNumber;
        for (uint i = 0; i < priceFeeds.length; i++) {
            _lastPriceFeeds.push(priceFeeds[i]);
        }
    }

    function lastPriceFeeds()
        external
        view
        returns (PythStructs.PriceFeed[] memory)
    {
        return _lastPriceFeeds;
    }
}

contract FailingPulseConsumer is IPulseConsumer {
    function pulseCallback(
        uint64,
        PythStructs.PriceFeed[] memory
    ) external pure override {
        revert("callback failed");
    }
}

contract CustomErrorPulseConsumer is IPulseConsumer {
    error CustomError(string message);

    function pulseCallback(
        uint64,
        PythStructs.PriceFeed[] memory
    ) external pure override {
        revert CustomError("callback failed");
    }
}

contract PulseTest is Test, PulseEvents {
    ERC1967Proxy public proxy;
    PulseUpgradeable public pulse;
    MockPulseConsumer public consumer;
    address public owner;
    address public admin;
    address public pyth;
    address public defaultProvider;
    // Constants
    uint128 constant PYTH_FEE = 1 wei;
    uint128 constant DEFAULT_PROVIDER_FEE = 1 wei;
    uint128 constant CALLBACK_GAS_LIMIT = 1_000_000;
    bytes32 constant BTC_PRICE_FEED_ID =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_PRICE_FEED_ID =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    // Price feed constants
    int8 constant MOCK_PRICE_FEED_EXPO = -8;
    int64 constant MOCK_BTC_PRICE = 5_000_000_000_000; // $50,000
    int64 constant MOCK_ETH_PRICE = 300_000_000_000; // $3,000
    uint64 constant MOCK_BTC_CONF = 10_000_000_000; // $100
    uint64 constant MOCK_ETH_CONF = 5_000_000_000; // $50

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
            false,
            15
        );
        vm.prank(defaultProvider);
        pulse.registerProvider(DEFAULT_PROVIDER_FEE);
        consumer = new MockPulseConsumer();
    }

    // Helper function to create price IDs array
    function createPriceIds() internal pure returns (bytes32[] memory) {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = BTC_PRICE_FEED_ID;
        priceIds[1] = ETH_PRICE_FEED_ID;
        return priceIds;
    }

    // Helper function to create mock price feeds
    function createMockPriceFeeds(
        uint256 publishTime
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            2
        );

        priceFeeds[0].id = BTC_PRICE_FEED_ID;
        priceFeeds[0].price.price = MOCK_BTC_PRICE;
        priceFeeds[0].price.conf = MOCK_BTC_CONF;
        priceFeeds[0].price.expo = MOCK_PRICE_FEED_EXPO;
        priceFeeds[0].price.publishTime = publishTime;

        priceFeeds[1].id = ETH_PRICE_FEED_ID;
        priceFeeds[1].price.price = MOCK_ETH_PRICE;
        priceFeeds[1].price.conf = MOCK_ETH_CONF;
        priceFeeds[1].price.expo = MOCK_PRICE_FEED_EXPO;
        priceFeeds[1].price.publishTime = publishTime;

        return priceFeeds;
    }

    // Helper function to mock Pyth response
    function mockParsePriceFeedUpdates(
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal {
        vm.mockCall(
            address(pyth),
            abi.encodeWithSelector(IPyth.parsePriceFeedUpdates.selector),
            abi.encode(priceFeeds)
        );
    }

    // Helper function to create mock update data
    function createMockUpdateData(
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal pure returns (bytes[] memory) {
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = abi.encode(priceFeeds[0]);
        updateData[1] = abi.encode(priceFeeds[1]);
        return updateData;
    }

    // Helper function to calculate total fee
    function calculateTotalFee() internal view returns (uint128) {
        return pulse.getFee(CALLBACK_GAS_LIMIT);
    }

    // Helper function to setup consumer request
    function setupConsumerRequest(
        address consumerAddress
    )
        internal
        returns (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        )
    {
        priceIds = createPriceIds();
        publishTime = block.timestamp;
        vm.deal(consumerAddress, 1 gwei);

        uint128 totalFee = calculateTotalFee();

        vm.prank(consumerAddress);
        sequenceNumber = pulse.requestPriceUpdatesWithCallback{value: totalFee}(
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        return (sequenceNumber, priceIds, publishTime);
    }

    function testRequestPriceUpdate() public {
        // Set a realistic gas price
        vm.txGasPrice(30 gwei);

        bytes32[] memory priceIds = createPriceIds();
        uint256 publishTime = block.timestamp;

        // Fund the consumer contract with enough ETH for higher gas price
        vm.deal(address(consumer), 1 ether);
        uint128 totalFee = calculateTotalFee();

        // Create the event data we expect to see
        PulseState.Request memory expectedRequest = PulseState.Request({
            sequenceNumber: 1,
            publishTime: publishTime,
            priceIds: [
                priceIds[0],
                priceIds[1],
                bytes32(0), // Fill remaining slots with zero
                bytes32(0),
                bytes32(0),
                bytes32(0),
                bytes32(0),
                bytes32(0),
                bytes32(0),
                bytes32(0)
            ],
            numPriceIds: 2,
            callbackGasLimit: CALLBACK_GAS_LIMIT,
            requester: address(consumer),
            provider: defaultProvider
        });

        vm.expectEmit();
        emit PriceUpdateRequested(expectedRequest, priceIds);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: totalFee}(
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Additional assertions to verify event data was stored correctly
        PulseState.Request memory lastRequest = pulse.getRequest(1);
        assertEq(lastRequest.sequenceNumber, expectedRequest.sequenceNumber);
        assertEq(lastRequest.publishTime, expectedRequest.publishTime);
        assertEq(lastRequest.numPriceIds, expectedRequest.numPriceIds);
        for (uint8 i = 0; i < lastRequest.numPriceIds; i++) {
            assertEq(lastRequest.priceIds[i], expectedRequest.priceIds[i]);
        }
        assertEq(
            lastRequest.callbackGasLimit,
            expectedRequest.callbackGasLimit
        );
        assertEq(
            lastRequest.requester,
            expectedRequest.requester,
            "Requester mismatch"
        );
    }

    function testRequestWithInsufficientFee() public {
        // Set a realistic gas price
        vm.txGasPrice(30 gwei);

        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 ether);
        vm.prank(address(consumer));
        vm.expectRevert(InsufficientFee.selector);
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE}( // Intentionally low fee
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testExecuteCallback() public {
        bytes32[] memory priceIds = createPriceIds();
        uint256 publishTime = block.timestamp;

        // Fund the consumer contract
        vm.deal(address(consumer), 1 gwei);
        uint128 totalFee = calculateTotalFee();

        // Step 1: Make the request as consumer
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(publishTime, priceIds, CALLBACK_GAS_LIMIT);

        // Step 2: Create mock price feeds and setup Pyth response
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);

        // Create arrays for expected event data
        int64[] memory expectedPrices = new int64[](2);
        expectedPrices[0] = MOCK_BTC_PRICE;
        expectedPrices[1] = MOCK_ETH_PRICE;

        uint64[] memory expectedConf = new uint64[](2);
        expectedConf[0] = MOCK_BTC_CONF;
        expectedConf[1] = MOCK_ETH_CONF;

        int32[] memory expectedExpos = new int32[](2);
        expectedExpos[0] = MOCK_PRICE_FEED_EXPO;
        expectedExpos[1] = MOCK_PRICE_FEED_EXPO;

        uint256[] memory expectedPublishTimes = new uint256[](2);
        expectedPublishTimes[0] = publishTime;
        expectedPublishTimes[1] = publishTime;

        // Expect the PriceUpdateExecuted event with all price data
        vm.expectEmit();
        emit PriceUpdateExecuted(
            sequenceNumber,
            defaultProvider,
            priceIds,
            expectedPrices,
            expectedConf,
            expectedExpos,
            expectedPublishTimes
        );

        // Create mock update data and execute callback
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(defaultProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Verify callback was executed
        assertEq(consumer.lastSequenceNumber(), sequenceNumber);

        // Compare price feeds array length
        PythStructs.PriceFeed[] memory lastFeeds = consumer.lastPriceFeeds();
        assertEq(lastFeeds.length, priceFeeds.length);

        // Compare each price feed
        for (uint i = 0; i < priceFeeds.length; i++) {
            assertEq(lastFeeds[i].id, priceFeeds[i].id);
            assertEq(lastFeeds[i].price.price, priceFeeds[i].price.price);
            assertEq(lastFeeds[i].price.conf, priceFeeds[i].price.conf);
            assertEq(lastFeeds[i].price.expo, priceFeeds[i].price.expo);
            assertEq(
                lastFeeds[i].price.publishTime,
                priceFeeds[i].price.publishTime
            );
        }
    }

    function testExecuteCallbackFailure() public {
        FailingPulseConsumer failingConsumer = new FailingPulseConsumer();

        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(failingConsumer));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.expectEmit();
        emit PriceUpdateCallbackFailed(
            sequenceNumber,
            defaultProvider,
            priceIds,
            address(failingConsumer),
            "callback failed"
        );

        vm.prank(defaultProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }

    function testExecuteCallbackCustomErrorFailure() public {
        CustomErrorPulseConsumer failingConsumer = new CustomErrorPulseConsumer();

        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(failingConsumer));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.expectEmit();
        emit PriceUpdateCallbackFailed(
            sequenceNumber,
            defaultProvider,
            priceIds,
            address(failingConsumer),
            "low-level error (possibly out of gas)"
        );

        vm.prank(defaultProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }

    function testExecuteCallbackWithInsufficientGas() public {
        // Setup request with 1M gas limit
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try executing with only 100K gas when 1M is required
        vm.prank(defaultProvider);
        vm.expectRevert(); // Just expect any revert since it will be an out-of-gas error
        pulse.executeCallback{gas: 100000}(
            sequenceNumber,
            updateData,
            priceIds
        ); // Will fail because gasleft() < callbackGasLimit
    }

    function testExecuteCallbackWithFutureTimestamp() public {
        // Setup request with future timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint256 futureTime = block.timestamp + 10; // 10 seconds in future
        vm.deal(address(consumer), 1 gwei);

        uint128 totalFee = calculateTotalFee();
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(futureTime, priceIds, CALLBACK_GAS_LIMIT);

        // Try to execute callback before the requested timestamp
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            futureTime // Mock price feeds with future timestamp
        );
        mockParsePriceFeedUpdates(priceFeeds); // This will make parsePriceFeedUpdates return future-dated prices
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(defaultProvider);
        // Should succeed because we're simulating receiving future-dated price updates
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Compare price feeds array length
        PythStructs.PriceFeed[] memory lastFeeds = consumer.lastPriceFeeds();
        assertEq(lastFeeds.length, priceFeeds.length);

        // Compare each price feed publish time
        for (uint i = 0; i < priceFeeds.length; i++) {
            assertEq(
                lastFeeds[i].price.publishTime,
                priceFeeds[i].price.publishTime
            );
        }
    }

    function testRevertOnTooFarFutureTimestamp() public {
        bytes32[] memory priceIds = createPriceIds();
        uint256 farFutureTime = block.timestamp + 61; // Just over 1 minute
        vm.deal(address(consumer), 1 gwei);

        uint128 totalFee = calculateTotalFee();
        vm.prank(address(consumer));

        vm.expectRevert("Too far in future");
        pulse.requestPriceUpdatesWithCallback{value: totalFee}(
            farFutureTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testDoubleExecuteCallback() public {
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // First execution
        vm.prank(defaultProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Second execution should fail
        vm.prank(defaultProvider);
        vm.expectRevert(NoSuchRequest.selector);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }

    function testGetFee() public {
        // Test with different gas limits to verify fee calculation
        uint256[] memory gasLimits = new uint256[](3);
        gasLimits[0] = 100_000;
        gasLimits[1] = 500_000;
        gasLimits[2] = 1_000_000;

        for (uint256 i = 0; i < gasLimits.length; i++) {
            uint256 gasLimit = gasLimits[i];
            uint128 expectedFee = SafeCast.toUint128(
                DEFAULT_PROVIDER_FEE * gasLimit
            ) + PYTH_FEE;
            uint128 actualFee = pulse.getFee(gasLimit);
            assertEq(
                actualFee,
                expectedFee,
                "Fee calculation incorrect for gas limit"
            );
        }

        // Test with zero gas limit
        uint128 expectedMinFee = PYTH_FEE;
        uint128 actualMinFee = pulse.getFee(0);
        assertEq(
            actualMinFee,
            expectedMinFee,
            "Minimum fee calculation incorrect"
        );
    }

    function testWithdrawFees() public {
        // Setup: Request price update to accrue some fees
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Get admin's balance before withdrawal
        uint256 adminBalanceBefore = admin.balance;
        uint128 accruedFees = pulse.getAccruedFees();

        // Withdraw fees as admin
        vm.prank(admin);
        pulse.withdrawFees(accruedFees);

        // Verify balances
        assertEq(
            admin.balance,
            adminBalanceBefore + accruedFees,
            "Admin balance should increase by withdrawn amount"
        );
        assertEq(
            pulse.getAccruedFees(),
            0,
            "Contract should have no fees after withdrawal"
        );
    }

    function testWithdrawFeesUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only admin can withdraw fees");
        pulse.withdrawFees(1 ether);
    }

    function testWithdrawFeesInsufficientBalance() public {
        vm.prank(admin);
        vm.expectRevert("Insufficient balance");
        pulse.withdrawFees(1 ether);
    }

    function testSetAndWithdrawAsFeeManager() public {
        address feeManager = address(0x789);

        vm.prank(defaultProvider);
        pulse.setFeeManager(feeManager);

        // Setup: Request price update to accrue some fees
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Get provider's accrued fees instead of total fees
        PulseState.ProviderInfo memory providerInfo = pulse.getProviderInfo(
            defaultProvider
        );
        uint128 providerAccruedFees = providerInfo.accruedFeesInWei;

        uint256 managerBalanceBefore = feeManager.balance;

        vm.prank(feeManager);
        pulse.withdrawAsFeeManager(defaultProvider, providerAccruedFees);

        assertEq(
            feeManager.balance,
            managerBalanceBefore + providerAccruedFees,
            "Fee manager balance should increase by withdrawn amount"
        );

        providerInfo = pulse.getProviderInfo(defaultProvider);
        assertEq(
            providerInfo.accruedFeesInWei,
            0,
            "Provider should have no fees after withdrawal"
        );
    }

    function testSetFeeManagerUnauthorized() public {
        address feeManager = address(0x789);
        vm.prank(address(0xdead));
        vm.expectRevert("Provider not registered");
        pulse.setFeeManager(feeManager);
    }

    function testWithdrawAsFeeManagerUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only fee manager");
        pulse.withdrawAsFeeManager(defaultProvider, 1 ether);
    }

    function testWithdrawAsFeeManagerInsufficientBalance() public {
        // Set up fee manager first
        address feeManager = address(0x789);
        vm.prank(defaultProvider);
        pulse.setFeeManager(feeManager);

        vm.prank(feeManager);
        vm.expectRevert("Insufficient balance");
        pulse.withdrawAsFeeManager(defaultProvider, 1 ether);
    }

    // Add new test for invalid priceIds
    function testExecuteCallbackWithInvalidPriceIds() public {
        bytes32[] memory priceIds = createPriceIds();
        uint256 publishTime = block.timestamp;

        // Setup request
        (uint64 sequenceNumber, , ) = setupConsumerRequest(address(consumer));

        // Create different priceIds
        bytes32[] memory wrongPriceIds = new bytes32[](2);
        wrongPriceIds[0] = bytes32(uint256(1)); // Different price IDs
        wrongPriceIds[1] = bytes32(uint256(2));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Should revert when trying to execute with wrong priceIds
        vm.prank(defaultProvider);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidPriceIds.selector,
                wrongPriceIds[0],
                priceIds[0]
            )
        );
        pulse.executeCallback(sequenceNumber, updateData, wrongPriceIds);
    }

    function testRevertOnTooManyPriceIds() public {
        uint256 maxPriceIds = uint256(pulse.MAX_PRICE_IDS());
        // Create array with MAX_PRICE_IDS + 1 price IDs
        bytes32[] memory priceIds = new bytes32[](maxPriceIds + 1);
        for (uint i = 0; i < priceIds.length; i++) {
            priceIds[i] = bytes32(uint256(i + 1));
        }

        vm.deal(address(consumer), 1 gwei);
        uint128 totalFee = calculateTotalFee();

        vm.prank(address(consumer));
        vm.expectRevert(
            abi.encodeWithSelector(
                TooManyPriceIds.selector,
                maxPriceIds + 1,
                maxPriceIds
            )
        );
        pulse.requestPriceUpdatesWithCallback{value: totalFee}(
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testProviderRegistration() public {
        address provider = address(0x123);
        uint128 providerFee = 1000;

        vm.prank(provider);
        pulse.registerProvider(providerFee);

        PulseState.ProviderInfo memory info = pulse.getProviderInfo(provider);
        assertEq(info.feeInWei, providerFee);
        assertTrue(info.isRegistered);
    }

    function testSetProviderFee() public {
        address provider = address(0x123);
        uint128 initialFee = 1000;
        uint128 newFee = 2000;

        vm.prank(provider);
        pulse.registerProvider(initialFee);

        vm.prank(provider);
        pulse.setProviderFee(newFee);

        PulseState.ProviderInfo memory info = pulse.getProviderInfo(provider);
        assertEq(info.feeInWei, newFee);
    }

    function testDefaultProvider() public {
        address provider = address(0x123);
        uint128 providerFee = 1000;

        vm.prank(provider);
        pulse.registerProvider(providerFee);

        vm.prank(admin);
        pulse.setDefaultProvider(provider);

        assertEq(pulse.getDefaultProvider(), provider);
    }

    function testRequestWithProvider() public {
        address provider = address(0x123);
        uint128 providerFee = 1000;

        vm.prank(provider);
        pulse.registerProvider(providerFee);

        vm.prank(admin);
        pulse.setDefaultProvider(provider);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        uint128 totalFee = pulse.getFee(CALLBACK_GAS_LIMIT);

        vm.deal(address(consumer), totalFee);
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(block.timestamp, priceIds, CALLBACK_GAS_LIMIT);

        PulseState.Request memory req = pulse.getRequest(sequenceNumber);
        assertEq(req.provider, provider);
    }

    function testExclusivityPeriod() public {
        // Test initial value
        assertEq(
            pulse.getExclusivityPeriod(),
            15,
            "Initial exclusivity period should be 15 seconds"
        );

        // Test setting new value
        vm.prank(admin);
        vm.expectEmit();
        emit ExclusivityPeriodUpdated(15, 30);
        pulse.setExclusivityPeriod(30);

        assertEq(
            pulse.getExclusivityPeriod(),
            30,
            "Exclusivity period should be updated"
        );
    }

    function testSetExclusivityPeriodUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only admin can set exclusivity period");
        pulse.setExclusivityPeriod(30);
    }

    function testExecuteCallbackDuringExclusivity() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        pulse.registerProvider(DEFAULT_PROVIDER_FEE);

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try to execute with second provider during exclusivity period
        vm.prank(secondProvider);
        vm.expectRevert("Only assigned provider during exclusivity period");
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Original provider should succeed
        vm.prank(defaultProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }

    function testExecuteCallbackAfterExclusivity() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        pulse.registerProvider(DEFAULT_PROVIDER_FEE);

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Wait for exclusivity period to end
        vm.warp(block.timestamp + pulse.getExclusivityPeriod() + 1);

        // Second provider should now succeed
        vm.prank(secondProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }

    function testExecuteCallbackWithCustomExclusivityPeriod() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        pulse.registerProvider(DEFAULT_PROVIDER_FEE);

        // Set custom exclusivity period
        vm.prank(admin);
        pulse.setExclusivityPeriod(30);

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try at 29 seconds (should fail for second provider)
        vm.warp(block.timestamp + 29);
        vm.prank(secondProvider);
        vm.expectRevert("Only assigned provider during exclusivity period");
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Try at 31 seconds (should succeed for second provider)
        vm.warp(block.timestamp + 2);
        vm.prank(secondProvider);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);
    }
}
