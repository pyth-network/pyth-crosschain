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
    address public lastUpdater;
    uint256 public lastPublishTime;
    bytes32[] public lastPriceIds;

    function pulseCallback(
        uint64 sequenceNumber,
        address updater,
        uint256 publishTime,
        bytes32[] calldata priceIds
    ) external override {
        lastSequenceNumber = sequenceNumber;
        lastUpdater = updater;
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
    address public updater;
    address public pyth;

    // Constants
    uint128 constant PYTH_FEE = 1 wei;
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
        updater = address(3);
        pyth = address(4);

        PulseUpgradeable _pulse = new PulseUpgradeable();
        proxy = new ERC1967Proxy(address(_pulse), "");
        pulse = PulseUpgradeable(address(proxy));

        pulse.initialize(owner, admin, PYTH_FEE, pyth, false);
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
            priceIdsHash: keccak256(abi.encode(priceIds)),
            callbackGasLimit: CALLBACK_GAS_LIMIT,
            requester: address(consumer)
        });

        vm.expectEmit();
        emit PriceUpdateRequested(expectedRequest);

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
        assertEq(lastRequest.priceIdsHash, expectedRequest.priceIdsHash);
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
            updater,
            publishTime,
            priceIds,
            expectedPrices,
            expectedConf,
            expectedExpos,
            expectedPublishTimes
        );

        // Create mock update data and execute callback
        bytes[] memory updateData = createMockUpdateData(priceFeeds);

        vm.prank(updater);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Verify callback was executed
        assertEq(consumer.lastSequenceNumber(), sequenceNumber);
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

        vm.expectEmit();
        emit PriceUpdateCallbackFailed(
            sequenceNumber,
            updater,
            publishTime,
            priceIds,
            address(failingConsumer),
            "callback failed"
        );

        vm.prank(updater);
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
            updater,
            publishTime,
            priceIds,
            address(failingConsumer),
            "low-level error (possibly out of gas)"
        );

        vm.prank(updater);
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

        // Try executing with only 10K gas when 1M is required
        vm.prank(updater);
        vm.expectRevert(InsufficientGas.selector);
        pulse.executeCallback{gas: 10000}(sequenceNumber, updateData, priceIds); // Will fail because gasleft() < callbackGasLimit
    }

    function testExecuteCallbackWithFutureTimestamp() public {
        // Setup request with future timestamp
        bytes32[] memory priceIds = createPriceIds();
        uint256 futureTime = block.timestamp + 1 days;
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

        vm.prank(updater);
        // Should succeed because we're simulating receiving future-dated price updates
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Verify the callback was executed with future timestamp
        assertEq(consumer.lastPublishTime(), futureTime);
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
        vm.prank(updater);
        pulse.executeCallback(sequenceNumber, updateData, priceIds);

        // Second execution should fail
        vm.prank(updater);
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
            uint128 expectedFee = SafeCast.toUint128(tx.gasprice * gasLimit) +
                PYTH_FEE;
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

        // Set fee manager as admin
        vm.prank(admin);
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

        // Test withdrawal as fee manager
        uint256 managerBalanceBefore = feeManager.balance;
        uint128 accruedFees = pulse.getAccruedFees();

        vm.prank(feeManager);
        pulse.withdrawAsFeeManager(accruedFees);

        assertEq(
            feeManager.balance,
            managerBalanceBefore + accruedFees,
            "Fee manager balance should increase by withdrawn amount"
        );
        assertEq(
            pulse.getAccruedFees(),
            0,
            "Contract should have no fees after withdrawal"
        );
    }

    function testSetFeeManagerUnauthorized() public {
        address feeManager = address(0x789);
        vm.prank(address(0xdead));
        vm.expectRevert("Only admin can set fee manager");
        pulse.setFeeManager(feeManager);
    }

    function testWithdrawAsFeeManagerUnauthorized() public {
        vm.prank(address(0xdead));
        vm.expectRevert("Only fee manager");
        pulse.withdrawAsFeeManager(1 ether);
    }

    function testWithdrawAsFeeManagerInsufficientBalance() public {
        // Set up fee manager first
        address feeManager = address(0x789);
        vm.prank(admin);
        pulse.setFeeManager(feeManager);

        vm.prank(feeManager);
        vm.expectRevert("Insufficient balance");
        pulse.withdrawAsFeeManager(1 ether);
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

        // Calculate hashes for both arrays
        bytes32 providedPriceIdsHash = keccak256(abi.encode(wrongPriceIds));
        bytes32 storedPriceIdsHash = keccak256(abi.encode(priceIds));

        // Should revert when trying to execute with wrong priceIds
        vm.prank(updater);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvalidPriceIds.selector,
                providedPriceIdsHash,
                storedPriceIdsHash
            )
        );
        pulse.executeCallback(sequenceNumber, updateData, wrongPriceIds);
    }
}
