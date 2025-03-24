// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../contracts/pulse/IPulse.sol";

abstract contract PulseTestUtils is Test {
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

    // Fee charged by the Pyth oracle per price feed
    uint constant MOCK_PYTH_FEE_PER_FEED = 10 wei;

    uint32 constant CALLBACK_GAS_LIMIT = 1_000_000;

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
        address pyth,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal {
        uint expectedFee = MOCK_PYTH_FEE_PER_FEED * priceFeeds.length;

        vm.mockCall(
            pyth,
            abi.encodeWithSelector(IPyth.getUpdateFee.selector),
            abi.encode(expectedFee)
        );

        vm.mockCall(
            pyth,
            expectedFee,
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

    // Helper function to setup consumer request
    function setupConsumerRequest(
        IPulse pulse,
        address provider,
        address consumerAddress
    )
        internal
        returns (
            uint64 sequenceNumber,
            bytes32[] memory priceIds,
            uint64 publishTime
        )
    {
        priceIds = createPriceIds();
        publishTime = SafeCast.toUint64(block.timestamp);
        vm.deal(consumerAddress, 1 gwei);

        uint96 totalFee = pulse.getFee(provider, CALLBACK_GAS_LIMIT, priceIds);

        vm.prank(consumerAddress);
        sequenceNumber = pulse.requestPriceUpdatesWithCallback{value: totalFee}(
            provider,
            publishTime,
            priceIds,
            CALLBACK_GAS_LIMIT
        );

        return (sequenceNumber, priceIds, publishTime);
    }
}
