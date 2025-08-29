// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/echo/EchoUpgradeable.sol";
import "../contracts/echo/IEcho.sol";
import "../contracts/echo/EchoState.sol";
import "../contracts/echo/EchoEvents.sol";
import "../contracts/echo/EchoErrors.sol";
import "./utils/EchoTestUtils.sol";
contract MockEchoConsumer is IEchoConsumer {
    address private _echo;
    uint64 public lastSequenceNumber;
    PythStructs.PriceFeed[] private _lastPriceFeeds;

    constructor(address echo) {
        _echo = echo;
    }

    function getEcho() internal view override returns (address) {
        return _echo;
    }

    function echoCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal override {
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

contract FailingEchoConsumer is IEchoConsumer {
    address private _echo;

    constructor(address echo) {
        _echo = echo;
    }

    function getEcho() internal view override returns (address) {
        return _echo;
    }

    function echoCallback(
        uint64,
        PythStructs.PriceFeed[] memory
    ) internal pure override {
        revert("callback failed");
    }
}

contract CustomErrorEchoConsumer is IEchoConsumer {
    error CustomError(string message);

    address private _echo;

    constructor(address echo) {
        _echo = echo;
    }

    function getEcho() internal view override returns (address) {
        return _echo;
    }

    function echoCallback(
        uint64,
        PythStructs.PriceFeed[] memory
    ) internal pure override {
        revert CustomError("callback failed");
    }
}

// FIXME: this shouldn't be IPulseConsumer.
contract EchoTest is Test, EchoEvents, IEchoConsumer, EchoTestUtils {
    ERC1967Proxy public proxy;
    EchoUpgradeable public echo;
    MockEchoConsumer public consumer;
    address public owner;
    address public admin;
    address public pyth;
    address public defaultProvider;
    // Constants
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
            false,
            15
        );
        vm.prank(defaultProvider);
        echo.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );
        consumer = new MockEchoConsumer(address(proxy));
    }

    // Helper function to calculate total fee
    // FIXME: I think this helper probably needs to take some arguments.
    function calculateTotalFee() internal view returns (uint96) {
        return
            echo.getFee(defaultProvider, CALLBACK_GAS_LIMIT, createPriceIds());
    }

    function testRequestPriceUpdate() public {
        // Set a realistic gas price
        vm.txGasPrice(30 gwei);

        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);

        // Fund the consumer contract with enough ETH for higher gas price
        vm.deal(address(consumer), 1 ether);
        uint96 totalFee = calculateTotalFee();

        // Create the event data we expect to see
        bytes8[] memory expectedPriceIdPrefixes = new bytes8[](2);
        {
            bytes32 priceId0 = priceIds[0];
            bytes32 priceId1 = priceIds[1];
            bytes8 prefix0;
            bytes8 prefix1;
            assembly {
                prefix0 := priceId0
                prefix1 := priceId1
            }
            expectedPriceIdPrefixes[0] = prefix0;
            expectedPriceIdPrefixes[1] = prefix1;
        }

        EchoState.Request memory expectedRequest = EchoState.Request({
            sequenceNumber: 1,
            publishTime: publishTime,
            priceIdPrefixes: expectedPriceIdPrefixes,
            callbackGasLimit: uint32(CALLBACK_GAS_LIMIT),
            requester: address(consumer),
            provider: defaultProvider,
            fee: totalFee - PYTH_FEE
        });

        vm.expectEmit();
        emit PriceUpdateRequested(expectedRequest, priceIds);

        vm.prank(address(consumer));
        echo.requestPriceUpdatesWithCallback{value: totalFee}(
            defaultProvider,
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Additional assertions to verify event data was stored correctly
        EchoState.Request memory lastRequest = echo.getRequest(1);
        assertEq(lastRequest.sequenceNumber, expectedRequest.sequenceNumber);
        assertEq(lastRequest.publishTime, expectedRequest.publishTime);
        assertEq(
            lastRequest.priceIdPrefixes.length,
            expectedRequest.priceIdPrefixes.length
        );
        for (uint8 i = 0; i < lastRequest.priceIdPrefixes.length; i++) {
            assertEq(
                lastRequest.priceIdPrefixes[i],
                expectedRequest.priceIdPrefixes[i]
            );
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
        echo.requestPriceUpdatesWithCallback{value: PYTH_FEE}( // Intentionally low fee
            defaultProvider,
            SafeCast.toUint64(block.timestamp),
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testExecuteCallback() public {
        bytes32[] memory priceIds = createPriceIds();
        uint64 publishTime = SafeCast.toUint64(block.timestamp);

        // Fund the consumer contract
        vm.deal(address(consumer), 1 gwei);
        uint96 totalFee = calculateTotalFee();

        // Step 1: Make the request as consumer
        vm.prank(address(consumer));
        uint64 sequenceNumber = echo.requestPriceUpdatesWithCallback{
            value: totalFee
        }(defaultProvider, publishTime, priceIds, CALLBACK_GAS_LIMIT);

        // Step 2: Create mock price feeds and setup Pyth response
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        // FIXME: this test doesn't ensure the Pyth fee is paid.
        mockParsePriceFeedUpdates(pyth, priceFeeds);

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

        uint64[] memory expectedPublishTimes = new uint64[](2);
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
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );

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
        FailingEchoConsumer failingConsumer = new FailingEchoConsumer(
            address(proxy)
        );

        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(
                echo,
                defaultProvider,
                address(failingConsumer)
            );

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
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
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testExecuteCallbackCustomErrorFailure() public {
        CustomErrorEchoConsumer failingConsumer = new CustomErrorEchoConsumer(
            address(proxy)
        );

        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(
                echo,
                defaultProvider,
                address(failingConsumer)
            );

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
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
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testExecuteCallbackWithInsufficientGas() public {
        // Setup request with 1M gas limit
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(echo, defaultProvider, address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try executing with only 100K gas when 1M is required
        vm.prank(defaultProvider);
        vm.expectRevert(); // Just expect any revert since it will be an out-of-gas error
        echo.executeCallback{gas: 100000}(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        ); // Will fail because gasleft() < callbackGasLimit
    }

    function testExecuteCallbackWithFutureTimestamp() public {
        // Setup request with future timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint64 futureTime = SafeCast.toUint64(block.timestamp + 10); // 10 seconds in future
        vm.deal(address(consumer), 1 gwei);

        uint96 totalFee = calculateTotalFee();
        vm.prank(address(consumer));
        uint64 sequenceNumber = echo.requestPriceUpdatesWithCallback{
            value: totalFee
        }(defaultProvider, futureTime, priceIds, CALLBACK_GAS_LIMIT);

        // Try to execute callback before the requested timestamp
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            futureTime // Mock price feeds with future timestamp
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds); // This will make parsePriceFeedUpdates return future-dated prices
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(defaultProvider);
        // Should succeed because we're simulating receiving future-dated price updates
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );

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
        uint64 farFutureTime = SafeCast.toUint64(block.timestamp + 61); // Just over 1 minute
        vm.deal(address(consumer), 1 gwei);

        uint96 totalFee = calculateTotalFee();
        vm.prank(address(consumer));

        vm.expectRevert("Too far in future");
        echo.requestPriceUpdatesWithCallback{value: totalFee}(
            defaultProvider,
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
        ) = setupConsumerRequest(echo, defaultProvider, address(consumer));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // First execution
        vm.prank(defaultProvider);
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );

        // Second execution should fail
        vm.prank(defaultProvider);
        vm.expectRevert(NoSuchRequest.selector);
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testGetFee() public {
        // Test with different gas limits to verify fee calculation
        uint32[] memory gasLimits = new uint32[](3);
        gasLimits[0] = 100_000;
        gasLimits[1] = 500_000;
        gasLimits[2] = 1_000_000;

        bytes32[] memory priceIds = createPriceIds();

        for (uint256 i = 0; i < gasLimits.length; i++) {
            uint32 gasLimit = gasLimits[i];
            uint96 expectedFee = SafeCast.toUint96(
                DEFAULT_PROVIDER_BASE_FEE +
                    DEFAULT_PROVIDER_FEE_PER_FEED *
                    priceIds.length +
                    DEFAULT_PROVIDER_FEE_PER_GAS *
                    gasLimit
            ) + PYTH_FEE;
            uint96 actualFee = echo.getFee(defaultProvider, gasLimit, priceIds);
            assertEq(
                actualFee,
                expectedFee,
                "Fee calculation incorrect for gas limit"
            );
        }

        // Test with zero gas limit
        uint96 expectedMinFee = SafeCast.toUint96(
            PYTH_FEE +
                DEFAULT_PROVIDER_BASE_FEE +
                DEFAULT_PROVIDER_FEE_PER_FEED *
                priceIds.length
        );
        uint96 actualMinFee = echo.getFee(defaultProvider, 0, priceIds);
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
        echo.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            defaultProvider,
            SafeCast.toUint64(block.timestamp),
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Get admin's balance before withdrawal
        uint256 adminBalanceBefore = admin.balance;
        uint128 accruedFees = echo.getAccruedPythFees();

        // Withdraw fees as admin
        vm.prank(admin);
        echo.withdrawFees(accruedFees);

        // Verify balances
        assertEq(
            admin.balance,
            adminBalanceBefore + accruedFees,
            "Admin balance should increase by withdrawn amount"
        );
        assertEq(
            echo.getAccruedPythFees(),
            0,
            "Contract should have no fees after withdrawal"
        );
    }

    function testWithdrawFeesUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only admin can withdraw fees");
        echo.withdrawFees(1 ether);
    }

    function testWithdrawFeesInsufficientBalance() public {
        vm.prank(admin);
        vm.expectRevert("Insufficient balance");
        echo.withdrawFees(1 ether);
    }

    function testSetAndWithdrawAsFeeManager() public {
        address feeManager = address(0x789);

        vm.prank(defaultProvider);
        echo.setFeeManager(feeManager);

        // Setup: Request price update to accrue some fees
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        echo.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            defaultProvider,
            SafeCast.toUint64(block.timestamp),
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Get provider's accrued fees instead of total fees
        EchoState.ProviderInfo memory providerInfo = echo.getProviderInfo(
            defaultProvider
        );
        uint128 providerAccruedFees = providerInfo.accruedFeesInWei;

        uint256 managerBalanceBefore = feeManager.balance;

        vm.prank(feeManager);
        echo.withdrawAsFeeManager(defaultProvider, uint96(providerAccruedFees));

        assertEq(
            feeManager.balance,
            managerBalanceBefore + providerAccruedFees,
            "Fee manager balance should increase by withdrawn amount"
        );

        providerInfo = echo.getProviderInfo(defaultProvider);
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
        echo.setFeeManager(feeManager);
    }

    function testWithdrawAsFeeManagerUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only fee manager");
        echo.withdrawAsFeeManager(defaultProvider, 1 ether);
    }

    function testWithdrawAsFeeManagerInsufficientBalance() public {
        // Set up fee manager first
        address feeManager = address(0x789);
        vm.prank(defaultProvider);
        echo.setFeeManager(feeManager);

        vm.prank(feeManager);
        vm.expectRevert("Insufficient balance");
        echo.withdrawAsFeeManager(defaultProvider, 1 ether);
    }

    // Add new test for invalid priceIds
    function testExecuteCallbackWithInvalidPriceIds() public {
        bytes32[] memory priceIds = createPriceIds();
        uint256 publishTime = block.timestamp;

        // Setup request
        (uint64 sequenceNumber, , ) = setupConsumerRequest(
            echo,
            defaultProvider,
            address(consumer)
        );

        // Create different priceIds
        bytes32[] memory wrongPriceIds = new bytes32[](2);
        wrongPriceIds[0] = bytes32(uint256(1)); // Different price IDs
        wrongPriceIds[1] = bytes32(uint256(2));

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Should revert when trying to execute with wrong priceIds
        vm.prank(defaultProvider);
        // Extract first 8 bytes of the price ID for the error expectation
        bytes8 storedPriceIdPrefix;
        assembly {
            storedPriceIdPrefix := mload(add(priceIds, 32))
        }

        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidPriceIds.selector,
                wrongPriceIds[0],
                storedPriceIdPrefix
            )
        );
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            wrongPriceIds
        );
    }

    function testRevertOnTooManyPriceIds() public {
        uint256 maxPriceIds = uint256(echo.MAX_PRICE_IDS());
        // Create array with MAX_PRICE_IDS + 1 price IDs
        bytes32[] memory priceIds = new bytes32[](maxPriceIds + 1);
        for (uint i = 0; i < priceIds.length; i++) {
            priceIds[i] = bytes32(uint256(i + 1));
        }

        vm.deal(address(consumer), 1 gwei);
        uint96 totalFee = calculateTotalFee();

        vm.prank(address(consumer));
        vm.expectRevert(
            abi.encodeWithSelector(
                TooManyPriceIds.selector,
                maxPriceIds + 1,
                maxPriceIds
            )
        );
        echo.requestPriceUpdatesWithCallback{value: totalFee}(
            defaultProvider,
            SafeCast.toUint64(block.timestamp),
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testProviderRegistration() public {
        address provider = address(0x123);
        uint96 providerFee = 1000;

        vm.prank(provider);
        echo.registerProvider(providerFee, providerFee, providerFee);

        EchoState.ProviderInfo memory info = echo.getProviderInfo(provider);
        assertEq(info.feePerGasInWei, providerFee);
        assertTrue(info.isRegistered);
    }

    function testSetProviderFee() public {
        address provider = address(0x123);
        uint96 initialBaseFee = 1000;
        uint96 initialFeePerFeed = 2000;
        uint96 initialFeePerGas = 3000;
        uint96 newFeePerFeed = 4000;
        uint96 newBaseFee = 5000;
        uint96 newFeePerGas = 6000;

        vm.prank(provider);
        echo.registerProvider(
            initialBaseFee,
            initialFeePerFeed,
            initialFeePerGas
        );

        vm.prank(provider);
        echo.setProviderFee(provider, newBaseFee, newFeePerFeed, newFeePerGas);

        EchoState.ProviderInfo memory info = echo.getProviderInfo(provider);
        assertEq(info.baseFeeInWei, newBaseFee);
        assertEq(info.feePerFeedInWei, newFeePerFeed);
        assertEq(info.feePerGasInWei, newFeePerGas);
    }

    function testDefaultProvider() public {
        address provider = address(0x123);
        uint96 providerFee = 1000;

        vm.prank(provider);
        echo.registerProvider(providerFee, providerFee, providerFee);

        vm.prank(admin);
        echo.setDefaultProvider(provider);

        assertEq(echo.getDefaultProvider(), provider);
    }

    function testRequestWithProvider() public {
        address provider = address(0x123);
        uint96 providerFee = 1000;

        vm.prank(provider);
        echo.registerProvider(providerFee, providerFee, providerFee);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        uint128 totalFee = echo.getFee(provider, CALLBACK_GAS_LIMIT, priceIds);

        vm.deal(address(consumer), totalFee);
        vm.prank(address(consumer));
        uint64 sequenceNumber = echo.requestPriceUpdatesWithCallback{
            value: totalFee
        }(
            provider,
            SafeCast.toUint64(block.timestamp),
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        EchoState.Request memory req = echo.getRequest(sequenceNumber);
        assertEq(req.provider, provider);
    }

    function testExclusivityPeriod() public {
        // Test initial value
        assertEq(
            echo.getExclusivityPeriod(),
            15,
            "Initial exclusivity period should be 15 seconds"
        );

        // Test setting new value
        vm.prank(admin);
        vm.expectEmit();
        emit ExclusivityPeriodUpdated(15, 30);
        echo.setExclusivityPeriod(30);

        assertEq(
            echo.getExclusivityPeriod(),
            30,
            "Exclusivity period should be updated"
        );
    }

    function testSetExclusivityPeriodUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only admin can set exclusivity period");
        echo.setExclusivityPeriod(30);
    }

    function testExecuteCallbackDuringExclusivity() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        echo.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(echo, defaultProvider, address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try to execute with second provider during exclusivity period
        vm.expectRevert("Only assigned provider during exclusivity period");
        echo.executeCallback(
            secondProvider,
            sequenceNumber,
            updateData,
            priceIds
        );

        // Original provider should succeed
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testExecuteCallbackAfterExclusivity() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        echo.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(echo, defaultProvider, address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Wait for exclusivity period to end
        vm.warp(block.timestamp + echo.getExclusivityPeriod() + 1);

        // Second provider should now succeed
        vm.prank(secondProvider);
        echo.executeCallback(
            defaultProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testExecuteCallbackWithCustomExclusivityPeriod() public {
        // Register a second provider
        address secondProvider = address(0x456);
        vm.prank(secondProvider);
        echo.registerProvider(
            DEFAULT_PROVIDER_BASE_FEE,
            DEFAULT_PROVIDER_FEE_PER_FEED,
            DEFAULT_PROVIDER_FEE_PER_GAS
        );

        // Set custom exclusivity period
        vm.prank(admin);
        echo.setExclusivityPeriod(30);

        // Setup request
        (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint256 publishTime
        ) = setupConsumerRequest(echo, defaultProvider, address(consumer));

        // Setup mock data
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Try at 29 seconds (should fail for second provider)
        vm.warp(block.timestamp + 29);
        vm.expectRevert("Only assigned provider during exclusivity period");
        echo.executeCallback(
            secondProvider,
            sequenceNumber,
            updateData,
            priceIds
        );

        // Try at 31 seconds (should succeed for second provider)
        vm.warp(block.timestamp + 2);
        echo.executeCallback(
            secondProvider,
            sequenceNumber,
            updateData,
            priceIds
        );
    }

    function testGetFirstActiveRequests() public {
        // Setup test data
        (
            bytes32[] memory priceIds,
            bytes[] memory updateData
        ) = setupTestData();
        createTestRequests(priceIds);
        completeRequests(updateData, priceIds);

        testRequestScenarios(priceIds, updateData);
    }

    function setupTestData()
        private
        pure
        returns (bytes32[] memory, bytes[] memory)
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        bytes[] memory updateData = new bytes[](1);
        return (priceIds, updateData);
    }

    function createTestRequests(bytes32[] memory priceIds) private {
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        for (uint i = 0; i < 5; i++) {
            vm.deal(address(this), 1 ether);
            echo.requestPriceUpdatesWithCallback{value: 1 ether}(
                defaultProvider,
                publishTime,
                priceIds,
                1000000
            );
        }
    }

    function completeRequests(
        bytes[] memory updateData,
        bytes32[] memory priceIds
    ) private {
        // Create mock price feeds and setup Pyth response
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            SafeCast.toUint64(block.timestamp)
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        updateData = createMockUpdateData(priceFeeds);

        vm.deal(defaultProvider, 2 ether); // Increase ETH allocation to prevent OutOfFunds
        vm.startPrank(defaultProvider);
        echo.executeCallback{value: 1 ether}(
            defaultProvider,
            2,
            updateData,
            priceIds
        );
        echo.executeCallback{value: 1 ether}(
            defaultProvider,
            4,
            updateData,
            priceIds
        );
        vm.stopPrank();
    }

    function testRequestScenarios(
        bytes32[] memory priceIds,
        bytes[] memory updateData
    ) private {
        // Test 1: Request more than available
        checkMoreThanAvailable();

        // Test 2: Request exact number
        checkExactNumber();

        // Test 3: Request fewer than available
        checkFewerThanAvailable();

        // Test 4: Request zero
        checkZeroRequest();

        // Test 5: Clear all and check empty
        clearAllRequests(updateData, priceIds);
        checkEmptyState();
    }

    // Split test scenarios into separate functions
    function checkMoreThanAvailable() private {
        (EchoState.Request[] memory requests, uint256 count) = echo
            .getFirstActiveRequests(10);
        assertEq(count, 3, "Should find 3 active requests");
        assertEq(requests.length, 3, "Array should be resized to 3");
        assertEq(
            requests[0].sequenceNumber,
            1,
            "First request should be oldest"
        );
        assertEq(requests[1].sequenceNumber, 3, "Second request should be #3");
        assertEq(requests[2].sequenceNumber, 5, "Third request should be #5");
    }

    function checkExactNumber() private {
        (EchoState.Request[] memory requests, uint256 count) = echo
            .getFirstActiveRequests(3);
        assertEq(count, 3, "Should find 3 active requests");
        assertEq(requests.length, 3, "Array should match requested size");
    }

    function checkFewerThanAvailable() private {
        (EchoState.Request[] memory requests, uint256 count) = echo
            .getFirstActiveRequests(2);
        assertEq(count, 2, "Should find 2 active requests");
        assertEq(requests.length, 2, "Array should match requested size");
        assertEq(
            requests[0].sequenceNumber,
            1,
            "First request should be oldest"
        );
        assertEq(requests[1].sequenceNumber, 3, "Second request should be #3");
    }

    function checkZeroRequest() private {
        (EchoState.Request[] memory requests, uint256 count) = echo
            .getFirstActiveRequests(0);
        assertEq(count, 0, "Should find 0 active requests");
        assertEq(requests.length, 0, "Array should be empty");
    }

    function clearAllRequests(
        bytes[] memory updateData,
        bytes32[] memory priceIds
    ) private {
        vm.deal(defaultProvider, 3 ether); // Increase ETH allocation
        vm.startPrank(defaultProvider);
        echo.executeCallback{value: 1 ether}(
            defaultProvider,
            1,
            updateData,
            priceIds
        );
        echo.executeCallback{value: 1 ether}(
            defaultProvider,
            3,
            updateData,
            priceIds
        );
        echo.executeCallback{value: 1 ether}(
            defaultProvider,
            5,
            updateData,
            priceIds
        );
        vm.stopPrank();
    }

    function checkEmptyState() private {
        (EchoState.Request[] memory requests, uint256 count) = echo
            .getFirstActiveRequests(10);
        assertEq(count, 0, "Should find 0 active requests");
        assertEq(requests.length, 0, "Array should be empty");
    }

    function testGetFirstActiveRequestsGasUsage() public {
        // Setup test data
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));
        uint64 publishTime = SafeCast.toUint64(block.timestamp);
        uint256 callbackGasLimit = 1000000;

        // Create mock price feeds and setup Pyth response
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(pyth, priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        // Create 20 requests with some gaps
        for (uint i = 0; i < 20; i++) {
            vm.deal(address(this), 1 ether);
            echo.requestPriceUpdatesWithCallback{value: 1 ether}(
                defaultProvider,
                publishTime,
                priceIds,
                uint32(callbackGasLimit)
            );

            // Complete every third request to create gaps
            if (i % 3 == 0) {
                vm.deal(defaultProvider, 1 ether);
                vm.prank(defaultProvider);
                echo.executeCallback{value: 1 ether}(
                    defaultProvider,
                    uint64(i + 1),
                    updateData,
                    priceIds
                );
            }
        }

        // Measure gas for different request counts
        uint256 gas1 = gasleft();
        echo.getFirstActiveRequests(5);
        uint256 gas1Used = gas1 - gasleft();

        uint256 gas2 = gasleft();
        echo.getFirstActiveRequests(10);
        uint256 gas2Used = gas2 - gasleft();

        // Log gas usage for analysis
        emit log_named_uint("Gas used for 5 requests", gas1Used);
        emit log_named_uint("Gas used for 10 requests", gas2Used);

        // Verify gas usage scales roughly linearly
        // Allow 10% margin for other factors
        assertApproxEqRel(
            gas2Used,
            gas1Used * 2,
            0.2e18, // 20% tolerance
            "Gas usage should scale roughly linearly"
        );
    }

    function getEcho() internal view override returns (address) {
        return address(echo);
    }

    // Mock implementation of echoCallback
    function echoCallback(
        uint64 sequenceNumber,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal override {
        // Just accept the callback, no need to do anything with the data
        // This prevents the revert we're seeing
    }
}
