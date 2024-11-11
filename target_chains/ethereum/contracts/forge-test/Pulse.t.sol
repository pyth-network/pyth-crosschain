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

    // Price feed constants
    int8 constant MOCK_PRICE_FEED_EXPO = -8;

    // Mock price values (already scaled according to Pyth's format)
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

        // Create mock price feed for BTC with specific values
        priceFeeds[0].id = BTC_PRICE_FEED_ID;
        priceFeeds[0].price.price = MOCK_BTC_PRICE;
        priceFeeds[0].price.conf = MOCK_BTC_CONF;
        priceFeeds[0].price.expo = MOCK_PRICE_FEED_EXPO;
        priceFeeds[0].price.publishTime = publishTime;

        // Create mock price feed for ETH with specific values
        priceFeeds[1].id = ETH_PRICE_FEED_ID;
        priceFeeds[1].price.price = MOCK_ETH_PRICE;
        priceFeeds[1].price.conf = MOCK_ETH_CONF;
        priceFeeds[1].price.expo = MOCK_PRICE_FEED_EXPO;
        priceFeeds[1].price.publishTime = publishTime;

        // Mock Pyth's parsePriceFeedUpdates to return our price feeds
        vm.mockCall(
            address(pyth),
            abi.encodeWithSelector(IPyth.parsePriceFeedUpdates.selector),
            abi.encode(priceFeeds)
        );

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
