// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/PulseUpgradeable.sol";
import "../contracts/pulse/IPulse.sol";
import "../contracts/pulse/PulseState.sol";
import "../contracts/pulse/PulseEvents.sol";

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

contract PulseTest is Test, PulseEvents {
    ERC1967Proxy public proxy;
    PulseUpgradeable public pulse;
    MockPulseConsumer public consumer;
    address public owner;
    address public admin;
    address public provider;
    address public pyth;
    uint128 constant PYTH_FEE = 1 wei;
    uint128 constant PROVIDER_FEE = 1 wei;
    uint128 constant PROVIDER_FEE_PER_GAS = 1 wei;
    uint128 constant CALLBACK_GAS_LIMIT = 1_000_000;
    bytes32 constant BTC_PRICE_FEED_ID =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_PRICE_FEED_ID =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    function setUp() public {
        owner = address(1);
        admin = address(2);
        provider = address(3);
        pyth = address(4);

        PulseUpgradeable _pulse = new PulseUpgradeable();
        proxy = new ERC1967Proxy(address(_pulse), "");
        // wrap in ABI to support easier calls
        pulse = PulseUpgradeable(address(proxy));

        pulse.initialize(owner, admin, PYTH_FEE, provider, pyth, false);
        consumer = new MockPulseConsumer();

        // Register provider
        vm.prank(provider);
        pulse.register(
            PROVIDER_FEE,
            PROVIDER_FEE_PER_GAS,
            "https://provider.com"
        );
    }

    function testRequestPriceUpdate() public {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = BTC_PRICE_FEED_ID;
        priceIds[1] = ETH_PRICE_FEED_ID;

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

        // Calculate total fee including gas component
        uint128 totalFee = PYTH_FEE +
            PROVIDER_FEE +
            (PROVIDER_FEE_PER_GAS * uint128(CALLBACK_GAS_LIMIT));

        // Make the actual call that should emit the event
        pulse.requestPriceUpdatesWithCallback{value: totalFee}(
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
            lastRequest.callbackGasLimit,
            expectedRequest.callbackGasLimit
        );
        assertEq(lastRequest.requester, expectedRequest.requester);
    }

    function testExecuteCallback() public {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = BTC_PRICE_FEED_ID;
        priceIds[1] = ETH_PRICE_FEED_ID;

        uint256 publishTime = block.timestamp;

        // Fund the consumer contract
        vm.deal(address(consumer), 1 gwei);

        // Step 1: Make the request as consumer
        vm.prank(address(consumer));

        // Calculate total fee including gas component
        uint128 totalFee = PYTH_FEE +
            PROVIDER_FEE +
            (PROVIDER_FEE_PER_GAS * uint128(CALLBACK_GAS_LIMIT));

        uint64 sequenceNumber = pulse.requestPriceUpdatesWithCallback{
            value: totalFee
        }(provider, publishTime, priceIds, CALLBACK_GAS_LIMIT);

        // Step 2: Create mock price feeds that match the expected publish time
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            2
        );

        // Create mock price feed for BTC
        priceFeeds[0].price.publishTime = publishTime;
        priceFeeds[0].id = BTC_PRICE_FEED_ID;

        // Create mock price feed for ETH
        priceFeeds[1].price.publishTime = publishTime;
        priceFeeds[1].id = ETH_PRICE_FEED_ID;

        // Mock Pyth's parsePriceFeedUpdates to return our price feeds
        vm.mockCall(
            address(pyth),
            abi.encodeWithSelector(IPyth.parsePriceFeedUpdates.selector),
            abi.encode(priceFeeds)
        );

        // Mock Pyth's updatePriceFeeds
        vm.mockCall(
            address(pyth),
            abi.encodeWithSelector(IPyth.updatePriceFeeds.selector),
            abi.encode()
        );

        // Create mock update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = abi.encode(priceFeeds[0]);
        updateData[1] = abi.encode(priceFeeds[1]);

        // Execute callback as provider
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
}
