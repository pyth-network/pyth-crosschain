// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";
import "../contracts/pulse/PulseEvents.sol";
import "../contracts/pulse/PulseErrors.sol";

contract MockPulseConsumer is IPulseConsumer {
    uint64 public lastSequenceNumber;
    address public lastProvider;
    uint256 public lastPublishTime;
    bytes32[] public lastPriceIds;

    function pulseCallback(
        uint64 sequenceNumber,
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external override {
        lastSequenceNumber = sequenceNumber;
        lastProvider = provider;
        lastPublishTime = publishTime;
        lastPriceIds = priceIds;
    }
}

contract FailingPulseConsumer is IPulseConsumer {
    function pulseCallback(
        uint64,
        address,
        uint256,
        bytes32[] calldata
    ) external pure override {
        revert("callback failed");
    }
}

contract CustomErrorPulseConsumer is IPulseConsumer {
    error CustomError(string message);

    function pulseCallback(
        uint64,
        address,
        uint256,
        bytes32[] calldata
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
    address public provider;
    address public pyth;

    // Constants
    uint128 constant PYTH_FEE = 1 wei;
    uint128 constant PROVIDER_FEE = 1 wei;
    uint128 constant PROVIDER_FEE_PER_GAS = 1 wei;
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
        provider = address(3);
        pyth = address(4);

        PulseUpgradeable _pulse = new PulseUpgradeable();
        proxy = new ERC1967Proxy(address(_pulse), "");
        pulse = PulseUpgradeable(address(proxy));

        pulse.initialize(owner, admin, PYTH_FEE, provider, pyth, false);
        consumer = new MockPulseConsumer();

        vm.prank(provider);
        pulse.register(
            PROVIDER_FEE,
            PROVIDER_FEE_PER_GAS,
            "https://provider.com"
        );
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
    function calculateTotalFee() internal pure returns (uint128) {
        return
            PYTH_FEE +
            PROVIDER_FEE +
            (PROVIDER_FEE_PER_GAS * uint128(CALLBACK_GAS_LIMIT));
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

        vm.prank(consumerAddress);
        sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: calculateTotalFee()
        }(provider, publishTime, priceIds, CALLBACK_GAS_LIMIT);

        return (sequenceNumber, priceIds, publishTime);
    }

    function testRequestPriceUpdate() public {
        bytes32[] memory priceIds = createPriceIds();
        uint256 publishTime = block.timestamp;

        // Fund the consumer contract
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));

        // Create the event data we expect to see
        PulseState.Request memory expectedRequest = PulseState.Request({
            provider: provider,
            sequenceNumber: 1,
            publishTime: publishTime,
            priceIds: priceIds,
            callbackGasLimit: CALLBACK_GAS_LIMIT,
            requester: address(consumer)
        });

        // Emit event with expected parameters
        vm.expectEmit();
        emit PriceUpdateRequested(expectedRequest);

        // Make the actual call that should emit the event
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            provider,
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Additional assertions to verify event data was stored correctly
        PulseState.Request memory lastRequest = pulse.getRequest(provider, 1);
        assertEq(lastRequest.provider, expectedRequest.provider);
        assertEq(lastRequest.sequenceNumber, expectedRequest.sequenceNumber);
        assertEq(lastRequest.publishTime, expectedRequest.publishTime);
        assertEq(
            keccak256(abi.encode(lastRequest.priceIds)),
            keccak256(abi.encode(expectedRequest.priceIds))
        );
        assertEq(
            lastRequest.callbackGasLimit,
            expectedRequest.callbackGasLimit
        );
        assertEq(lastRequest.requester, expectedRequest.requester);
    }

    function testRequestWithInsufficientFee() public {
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        vm.expectRevert(InsufficientFee.selector);
        pulse.requestPriceUpdatesWithCallback{value: PYTH_FEE}( // Intentionally low fee
            provider,
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

        // Step 1: Make the request as consumer
        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: calculateTotalFee()
        }(provider, publishTime, priceIds, CALLBACK_GAS_LIMIT);

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
        vm.expectEmit(true, true, false, true);
        emit PriceUpdateExecuted(
            sequenceNumber,
            provider,
            publishTime,
            priceIds,
            expectedPrices,
            expectedConf,
            expectedExpos,
            expectedPublishTimes
        );

        // Create mock update data and execute callback
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(provider);
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );

        // Verify callback was executed
        assertEq(consumer.lastSequenceNumber(), sequenceNumber);
        assertEq(consumer.lastProvider(), provider);
        assertEq(consumer.lastPublishTime(), publishTime);
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

        vm.expectEmit(true, true, true, true);
        emit PriceUpdateCallbackFailed(
            sequenceNumber,
            provider,
            publishTime,
            priceIds,
            address(failingConsumer),
            "callback failed"
        );

        vm.prank(provider);
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );
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

        vm.expectEmit(true, true, true, true);
        emit PriceUpdateCallbackFailed(
            sequenceNumber,
            provider,
            publishTime,
            priceIds,
            address(failingConsumer),
            "low-level error (possibly out of gas)"
        );

        vm.prank(provider);
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );
    }

    // Test executing callback with mismatched price IDs
    function testExecuteCallbackWithMismatchedPriceIds() public {
        (
            uint64 sequenceNumber,
            bytes32[] memory originalPriceIds,
            uint256 publishTime
        ) = setupConsumerRequest(address(consumer));

        // Create different price IDs array
        bytes32[] memory differentPriceIds = new bytes32[](1);
        differentPriceIds[0] = bytes32(uint256(1)); // Different price ID

        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            publishTime
        );
        mockParsePriceFeedUpdates(priceFeeds);
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidPriceIds.selector,
                differentPriceIds,
                originalPriceIds
            )
        );
        pulse.executeCallback(
            provider,
            sequenceNumber,
            differentPriceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );
    }

    function testExecuteCallbackWithInsufficientGas() public {
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

        vm.prank(provider);
        vm.expectRevert();
        pulse.executeCallback{gas: 10000}(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );
    }

    function testExecuteCallbackWithInvalidGasLimit() public {
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

        // Try to execute with different gas limit than what was requested
        uint256 differentGasLimit = CALLBACK_GAS_LIMIT + 1000;
        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidCallbackGasLimit.selector,
                differentGasLimit,
                CALLBACK_GAS_LIMIT
            )
        );
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            differentGasLimit
        );
    }

    function testExecuteCallbackWithFutureTimestamp() public {
        // Setup request with future timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint256 futureTime = block.timestamp + 1 days;
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: calculateTotalFee()
        }(provider, futureTime, priceIds, CALLBACK_GAS_LIMIT);

        // Try to execute callback before the requested timestamp
        PythStructs.PriceFeed[] memory priceFeeds = createMockPriceFeeds(
            futureTime // Mock price feeds with future timestamp
        );
        mockParsePriceFeedUpdates(priceFeeds); // This will make parsePriceFeedUpdates return future-dated prices
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(provider);
        // Should succeed because we're simulating receiving future-dated price updates
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );

        // Verify the callback was executed with future timestamp
        assertEq(consumer.lastPublishTime(), futureTime);
    }

    function testExecuteCallbackWithWrongProvider() public {
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

        address wrongProvider = address(0x999);
        vm.prank(wrongProvider);
        vm.expectRevert(NoSuchRequest.selector);
        pulse.executeCallback(
            wrongProvider,
            sequenceNumber,
            priceIds,
            updateData,
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
        vm.prank(provider);
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );

        // Second execution should fail
        vm.prank(provider);
        vm.expectRevert(NoSuchRequest.selector);
        pulse.executeCallback(
            provider,
            sequenceNumber,
            priceIds,
            updateData,
            CALLBACK_GAS_LIMIT
        );
    }

    function testGetFee() public {
        // Test with different gas limits to verify fee calculation
        uint256[] memory gasLimits = new uint256[](3);
        gasLimits[0] = 100_000;
        gasLimits[1] = 500_000;
        gasLimits[2] = 1_000_000;

        for (uint256 i = 0; i < gasLimits.length; i++) {
            uint256 gasLimit = gasLimits[i];
            uint128 expectedFee = PROVIDER_FEE + // Base provider fee
                (PROVIDER_FEE_PER_GAS * uint128(gasLimit)) + // Gas-based fee
                PYTH_FEE; // Pyth oracle fee

            uint128 actualFee = pulse.getFee(provider, gasLimit);

            assertEq(
                actualFee,
                expectedFee,
                "Fee calculation incorrect for gas limit"
            );
        }

        // Test with zero gas limit
        uint128 expectedMinFee = PROVIDER_FEE + PYTH_FEE;
        uint128 actualMinFee = pulse.getFee(provider, 0);
        assertEq(
            actualMinFee,
            expectedMinFee,
            "Minimum fee calculation incorrect"
        );

        // Test with unregistered provider (should return 0 fees)
        address unregisteredProvider = address(0x123);
        uint128 unregisteredFee = pulse.getFee(
            unregisteredProvider,
            gasLimits[0]
        );
        assertEq(
            unregisteredFee,
            PYTH_FEE,
            "Unregistered provider fee should only include Pyth fee"
        );
    }

    function testWithdraw() public {
        // Setup: Request price update to accrue some fees
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            provider,
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Get provider's balance before withdrawal
        uint256 providerBalanceBefore = provider.balance;
        PulseState.ProviderInfo memory infoBefore = pulse.getProviderInfo(
            provider
        );

        // Withdraw fees
        vm.prank(provider);
        pulse.withdraw(infoBefore.accruedFeesInWei);

        // Verify balances
        assertEq(
            provider.balance,
            providerBalanceBefore + infoBefore.accruedFeesInWei
        );

        PulseState.ProviderInfo memory infoAfter = pulse.getProviderInfo(
            provider
        );
        assertEq(infoAfter.accruedFeesInWei, 0);
    }

    function testWithdrawInsufficientBalance() public {
        vm.prank(provider);
        vm.expectRevert("Insufficient balance");
        pulse.withdraw(1 ether);
    }

    function testSetAndWithdrawAsFeeManager() public {
        address feeManager = address(0x789);

        // Set fee manager
        vm.prank(provider);
        pulse.setFeeManager(feeManager);

        // Verify fee manager was set
        PulseState.ProviderInfo memory info = pulse.getProviderInfo(provider);
        assertEq(info.feeManager, feeManager);

        // Setup: Request price update to accrue some fees
        bytes32[] memory priceIds = createPriceIds();
        vm.deal(address(consumer), 1 gwei);

        vm.prank(address(consumer));
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            provider,
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        // Test withdrawal as fee manager
        uint256 managerBalanceBefore = feeManager.balance;
        info = pulse.getProviderInfo(provider);

        vm.prank(feeManager);
        pulse.withdrawAsFeeManager(provider, info.accruedFeesInWei);

        assertEq(
            feeManager.balance,
            managerBalanceBefore + info.accruedFeesInWei
        );
    }

    function testMaxNumPrices() public {
        // Set max number of prices
        vm.prank(provider);
        pulse.setMaxNumPrices(1);

        // Try to request more prices than allowed
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = BTC_PRICE_FEED_ID;
        priceIds[1] = ETH_PRICE_FEED_ID;

        vm.deal(address(consumer), 1 gwei);
        vm.prank(address(consumer));

        vm.expectRevert(
            abi.encodeWithSelector(ExceedsMaxPrices.selector, 2, 1)
        );
        pulse.requestPriceUpdatesWithCallback{value: calculateTotalFee()}(
            provider,
            block.timestamp,
            priceIds,
            CALLBACK_GAS_LIMIT
        );
    }

    function testSetProviderUri() public {
        bytes memory newUri = "https://updated-provider.com";

        vm.prank(provider);
        pulse.setProviderUri(newUri);

        PulseState.ProviderInfo memory info = pulse.getProviderInfo(provider);
        assertEq(info.uri, newUri);
    }
}
