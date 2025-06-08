// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

abstract contract MockPriceFeedTestUtils is Test {
    bytes32 constant BTC_PRICE_FEED_ID =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_PRICE_FEED_ID =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant SOL_PRICE_FEED_ID =
        0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
    bytes32 constant AVAX_PRICE_FEED_ID =
        0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7;
    bytes32 constant MELANIA_PRICE_FEED_ID =
        0x8fef7d52c7f4e3a6258d663f9d27e64a1b6fd95ab5f7d545dbf9a515353d0064;
    bytes32 constant PYTH_PRICE_FEED_ID =
        0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff;
    bytes32 constant UNI_PRICE_FEED_ID =
        0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501;
    bytes32 constant AAVE_PRICE_FEED_ID =
        0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445;
    bytes32 constant DOGE_PRICE_FEED_ID =
        0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c;
    bytes32 constant ADA_PRICE_FEED_ID =
        0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d;

    // Price feed constants
    int8 constant MOCK_PRICE_FEED_EXPO = -8;
    int64 constant MOCK_BTC_PRICE = 5_000_000_000_000; // $50,000
    int64 constant MOCK_ETH_PRICE = 300_000_000_000; // $3,000
    uint64 constant MOCK_BTC_CONF = 10_000_000_000; // $100
    uint64 constant MOCK_ETH_CONF = 5_000_000_000; // $50

    // Fee charged by the Pyth oracle per price feed
    uint constant MOCK_PYTH_FEE_PER_FEED = 10 wei;

    uint32 constant CALLBACK_GAS_LIMIT = 1_000_000;

    // Helper function to create price IDs array with default 2 feeds
    function createPriceIds() internal pure returns (bytes32[] memory) {
        return createPriceIds(2);
    }

    // Helper function to create price IDs array with variable number of feeds
    function createPriceIds(
        uint256 numFeeds
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory priceIds = new bytes32[](numFeeds);

        // First assign our predefined price feed IDs
        uint256 predefinedCount = 10;
        uint256 assignCount = numFeeds < predefinedCount
            ? numFeeds
            : predefinedCount;

        if (assignCount > 0) priceIds[0] = BTC_PRICE_FEED_ID;
        if (assignCount > 1) priceIds[1] = ETH_PRICE_FEED_ID;
        if (assignCount > 2) priceIds[2] = SOL_PRICE_FEED_ID;
        if (assignCount > 3) priceIds[3] = AVAX_PRICE_FEED_ID;
        if (assignCount > 4) priceIds[4] = MELANIA_PRICE_FEED_ID;
        if (assignCount > 5) priceIds[5] = PYTH_PRICE_FEED_ID;
        if (assignCount > 6) priceIds[6] = UNI_PRICE_FEED_ID;
        if (assignCount > 7) priceIds[7] = AAVE_PRICE_FEED_ID;
        if (assignCount > 8) priceIds[8] = DOGE_PRICE_FEED_ID;
        if (assignCount > 9) priceIds[9] = ADA_PRICE_FEED_ID;

        // For any additional feeds beyond our predefined ones, generate derived IDs
        for (uint256 i = predefinedCount; i < numFeeds; i++) {
            // Derive new price IDs by incrementing the last predefined price ID
            priceIds[i] = bytes32(uint256(ADA_PRICE_FEED_ID) + (i - 9));
        }

        return priceIds;
    }

    // Helper function to create a single mock price feed
    function createSingleMockPriceFeed(
        uint256 publishTime
    ) internal pure returns (PythStructs.PriceFeed memory) {
        return createMockPriceFeeds(publishTime, 1)[0];
    }

    // Helper function to create mock price feeds with slots
    function createMockPriceFeedsWithSlots(
        uint256 publishTime,
        uint256 numFeeds
    )
        internal
        pure
        returns (
            PythStructs.PriceFeed[] memory priceFeeds,
            uint64[] memory slots
        )
    {
        priceFeeds = createMockPriceFeeds(publishTime, numFeeds);
        slots = new uint64[](numFeeds);

        // Set all slots to the publishTime as a mock value
        for (uint256 i = 0; i < numFeeds; i++) {
            slots[i] = uint64(publishTime);
        }

        return (priceFeeds, slots);
    }

    // Helper function to create mock price feeds with default 2 feeds
    function createMockPriceFeeds(
        uint256 publishTime
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        return createMockPriceFeeds(publishTime, 2);
    }

    // Helper function to create mock price feeds with variable number of feeds
    function createMockPriceFeeds(
        uint256 publishTime,
        uint256 numFeeds
    ) internal pure returns (PythStructs.PriceFeed[] memory) {
        PythStructs.PriceFeed[] memory priceFeeds = new PythStructs.PriceFeed[](
            numFeeds
        );

        bytes32[] memory priceIds = createPriceIds(numFeeds);

        for (uint256 i = 0; i < numFeeds; i++) {
            priceFeeds[i].id = priceIds[i];

            // Use appropriate price and conf based on the price ID
            if (priceIds[i] == BTC_PRICE_FEED_ID) {
                priceFeeds[i].price.price = MOCK_BTC_PRICE;
                priceFeeds[i].price.conf = MOCK_BTC_CONF;
            } else if (priceIds[i] == ETH_PRICE_FEED_ID) {
                priceFeeds[i].price.price = MOCK_ETH_PRICE;
                priceFeeds[i].price.conf = MOCK_ETH_CONF;
            } else {
                // Default to BTC price for other feeds
                priceFeeds[i].price.price = MOCK_BTC_PRICE;
                priceFeeds[i].price.conf = MOCK_BTC_CONF;
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

    // Helper function to mock Pyth response with slots
    function mockParsePriceFeedUpdatesWithSlotsStrict(
        address pyth,
        PythStructs.PriceFeed[] memory priceFeeds,
        uint64[] memory slots
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
            abi.encodeWithSelector(
                IPyth.parsePriceFeedUpdatesWithConfig.selector
            ),
            abi.encode(priceFeeds, slots)
        );
    }

    // Helper function to create mock update data for variable feeds
    function createMockUpdateData(
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal pure returns (bytes[] memory) {
        uint256 numFeeds = priceFeeds.length;
        bytes[] memory updateData = new bytes[](numFeeds);

        for (uint256 i = 0; i < numFeeds; i++) {
            updateData[i] = abi.encode(priceFeeds[i]);
        }

        return updateData;
    }
}
