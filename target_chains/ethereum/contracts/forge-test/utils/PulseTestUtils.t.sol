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

    uint128 constant CALLBACK_GAS_LIMIT = 1_000_000;

    // Helper function to create price IDs array
    function createPriceIds() internal pure returns (bytes32[] memory) {
        return createPriceIds(2);
    }

    // Helper function to create price IDs array with specified count
    function createPriceIds(uint8 count) internal pure returns (bytes32[] memory) {
        bytes32[] memory priceIds = new bytes32[](count);
        
        // Always use real price feed IDs for the first two if available
        if (count >= 1) {
            priceIds[0] = BTC_PRICE_FEED_ID;
        }
        if (count >= 2) {
            priceIds[1] = ETH_PRICE_FEED_ID;
        }
        
        // For additional IDs, generate synthetic ones based on the index
        for (uint8 i = 2; i < count; i++) {
            priceIds[i] = bytes32(uint256(keccak256(abi.encodePacked(i))));
        }
        
        return priceIds;
    }

    // Helper function to create mock price feeds
    function createMockPriceFeeds(
        uint256 publishTime
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        bytes32[] memory priceIds = createPriceIds();
        return createMockPriceFeeds(publishTime, priceIds);
    }

    // Helper function to create mock price feeds for specific priceIds
    function createMockPriceFeeds(
        uint256 publishTime,
        bytes32[] memory priceIds
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            priceIds.length
        );

        for (uint i = 0; i < priceIds.length; i++) {
            priceFeeds[i].id = priceIds[i];
            // Use BTC price for index 0, ETH price for index 1, and a synthetic price for others
            if (i == 0) {
                priceFeeds[i].price.price = MOCK_BTC_PRICE;
                priceFeeds[i].price.conf = MOCK_BTC_CONF;
            } else if (i == 1) {
                priceFeeds[i].price.price = MOCK_ETH_PRICE;
                priceFeeds[i].price.conf = MOCK_ETH_CONF;
            } else {
                // For additional feeds, use a price derived from the index
                priceFeeds[i].price.price = int64(uint64(1_000_000_000_000 + (i * 100_000_000_000)));
                priceFeeds[i].price.conf = uint64(1_000_000_000 + (i * 100_000_000));
            }
            priceFeeds[i].price.expo = MOCK_PRICE_FEED_EXPO;
            priceFeeds[i].price.publishTime = publishTime;
        }

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
        bytes[] memory updateData = new bytes[](priceFeeds.length);
        for (uint i = 0; i < priceFeeds.length; i++) {
            updateData[i] = abi.encode(priceFeeds[i]);
        }
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

        uint128 totalFee = pulse.getFee(provider, CALLBACK_GAS_LIMIT, priceIds);

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
