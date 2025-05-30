// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";
import "forge-std/console.sol";

contract PythTest is Test, WormholeTestUtils, PythTestUtils {
    IPyth public pyth;

    // -1 is equal to 0xffffff which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We will have less than 512 price for a foreseeable future.
    uint8 constant MERKLE_TREE_DEPTH = 9;

    // Base TWAP messages that will be used as templates for tests
    TwapPriceFeedMessage[2] baseTwapStartMessages;
    TwapPriceFeedMessage[2] baseTwapEndMessages;
    bytes32[2] basePriceIds;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(NUM_GUARDIAN_SIGNERS)));

        // Initialize base TWAP messages for two price feeds
        basePriceIds[0] = bytes32(uint256(1));
        basePriceIds[1] = bytes32(uint256(2));

        // First price feed TWAP messages
        baseTwapStartMessages[0] = TwapPriceFeedMessage({
            priceId: basePriceIds[0],
            cumulativePrice: 100_000, // Base cumulative value
            cumulativeConf: 10_000, // Base cumulative conf
            numDownSlots: 0,
            publishSlot: 1000,
            publishTime: 1000,
            prevPublishTime: 900,
            expo: -8
        });

        baseTwapEndMessages[0] = TwapPriceFeedMessage({
            priceId: basePriceIds[0],
            cumulativePrice: 210_000, // Increased by 110_000
            cumulativeConf: 18_000, // Increased by 8_000
            numDownSlots: 0,
            publishSlot: 1100,
            publishTime: 1100,
            prevPublishTime: 1000,
            expo: -8
        });

        // Second price feed TWAP messages
        baseTwapStartMessages[1] = TwapPriceFeedMessage({
            priceId: basePriceIds[1],
            cumulativePrice: 500_000, // Different base cumulative value
            cumulativeConf: 20_000, // Different base cumulative conf
            numDownSlots: 0,
            publishSlot: 1000,
            publishTime: 1000,
            prevPublishTime: 900,
            expo: -8
        });

        baseTwapEndMessages[1] = TwapPriceFeedMessage({
            priceId: basePriceIds[1],
            cumulativePrice: 800_000, // Increased by 300_000
            cumulativeConf: 40_000, // Increased by 20_000
            numDownSlots: 0,
            publishSlot: 1100,
            publishTime: 1100,
            prevPublishTime: 1000,
            expo: -8
        });
    }

    function generateRandomPriceMessages(
        uint length
    )
        internal
        returns (bytes32[] memory priceIds, PriceFeedMessage[] memory messages)
    {
        messages = new PriceFeedMessage[](length);
        priceIds = new bytes32[](length);

        for (uint i = 0; i < length; i++) {
            messages[i].priceId = bytes32(i + 1); // price ids should be non-zero and unique
            messages[i].price = getRandInt64();
            messages[i].conf = getRandUint64();
            messages[i].expo = getRandInt32();
            messages[i].emaPrice = getRandInt64();
            messages[i].emaConf = getRandUint64();
            messages[i].publishTime = getRandUint64();
            messages[i].prevPublishTime = getRandUint64();

            priceIds[i] = messages[i].priceId;
        }
    }

    // This method divides messages into a couple of batches and creates
    // updateData for them. It returns the updateData and the updateFee
    function createBatchedUpdateDataFromMessagesWithConfig(
        PriceFeedMessage[] memory messages,
        MerkleUpdateConfig memory config
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        uint batchSize = 1 + (getRandUint() % messages.length);
        uint numBatches = (messages.length + batchSize - 1) / batchSize;

        updateData = new bytes[](numBatches);

        for (uint i = 0; i < messages.length; i += batchSize) {
            uint len = batchSize;
            if (messages.length - i < len) {
                len = messages.length - i;
            }

            PriceFeedMessage[] memory batchMessages = new PriceFeedMessage[](
                len
            );
            for (uint j = i; j < i + len; j++) {
                batchMessages[j - i] = messages[j];
            }

            updateData[i / batchSize] = generateWhMerkleUpdateWithSource(
                batchMessages,
                config
            );
        }

        updateFee = pyth.getUpdateFee(updateData);
    }

    function createBatchedUpdateDataFromMessages(
        PriceFeedMessage[] memory messages
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        (updateData, updateFee) = createBatchedUpdateDataFromMessagesWithConfig(
            messages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
    }

    // This method divides messages into a couple of batches and creates
    // twap updateData for them. It returns the updateData and the updateFee
    function createBatchedTwapUpdateDataFromMessagesWithConfig(
        PriceFeedMessage[] memory messages,
        MerkleUpdateConfig memory config
    ) public returns (bytes[] memory updateData, uint updateFee) {
        require(messages.length >= 2, "At least 2 messages required for TWAP");

        // Create arrays to hold the start and end TWAP messages for all price feeds
        TwapPriceFeedMessage[]
            memory startTwapMessages = new TwapPriceFeedMessage[](
                messages.length / 2
            );
        TwapPriceFeedMessage[]
            memory endTwapMessages = new TwapPriceFeedMessage[](
                messages.length / 2
            );

        // Fill the arrays with all price feeds' start and end points
        for (uint i = 0; i < messages.length / 2; i++) {
            // Create start message for this price feed
            startTwapMessages[i].priceId = messages[i * 2].priceId;
            startTwapMessages[i].cumulativePrice =
                int128(messages[i * 2].price) *
                1000;
            startTwapMessages[i].cumulativeConf =
                uint128(messages[i * 2].conf) *
                1000;
            startTwapMessages[i].numDownSlots = 0; // No down slots for testing
            startTwapMessages[i].expo = messages[i * 2].expo;
            startTwapMessages[i].publishTime = messages[i * 2].publishTime;
            startTwapMessages[i].prevPublishTime = messages[i * 2]
                .prevPublishTime;
            startTwapMessages[i].publishSlot = 1000; // Start slot

            // Create end message for this price feed
            endTwapMessages[i].priceId = messages[i * 2 + 1].priceId;
            endTwapMessages[i].cumulativePrice =
                int128(messages[i * 2 + 1].price) *
                1000 +
                startTwapMessages[i].cumulativePrice;
            endTwapMessages[i].cumulativeConf =
                uint128(messages[i * 2 + 1].conf) *
                1000 +
                startTwapMessages[i].cumulativeConf;
            endTwapMessages[i].numDownSlots = 0; // No down slots for testing
            endTwapMessages[i].expo = messages[i * 2 + 1].expo;
            endTwapMessages[i].publishTime = messages[i * 2 + 1].publishTime;
            endTwapMessages[i].prevPublishTime = messages[i * 2 + 1]
                .prevPublishTime;
            endTwapMessages[i].publishSlot = 1100; // End slot (100 slots after start)
        }

        // Create exactly 2 updateData entries as required by parseTwapPriceFeedUpdates
        updateData = new bytes[](2);

        // First update contains all start points
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startTwapMessages,
            config
        );

        // Second update contains all end points
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endTwapMessages,
            config
        );

        // Calculate the update fee
        updateFee = pyth.getUpdateFee(updateData);
    }

    function createBatchedTwapUpdateDataFromMessages(
        PriceFeedMessage[] memory messages
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        (
            updateData,
            updateFee
        ) = createBatchedTwapUpdateDataFromMessagesWithConfig(
            messages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
    }

    function testParsePriceFeedUpdatesWorks(uint seed) public {
        setRandSeed(seed);
        uint numMessages = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        for (uint i = 0; i < numMessages; i++) {
            assertEq(priceFeeds[i].id, priceIds[i]);
            assertEq(priceFeeds[i].price.price, messages[i].price);
            assertEq(priceFeeds[i].price.conf, messages[i].conf);
            assertEq(priceFeeds[i].price.expo, messages[i].expo);
            assertEq(priceFeeds[i].price.publishTime, messages[i].publishTime);
            assertEq(priceFeeds[i].emaPrice.price, messages[i].emaPrice);
            assertEq(priceFeeds[i].emaPrice.conf, messages[i].emaConf);
            assertEq(priceFeeds[i].emaPrice.expo, messages[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                messages[i].publishTime
            );
        }
    }

    function testParsePriceFeedUpdatesWithConfigIfStorageTrue(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numMessages = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        (PythStructs.PriceFeed[] memory priceFeeds, ) = pyth
            .parsePriceFeedUpdatesWithConfig{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64,
            false,
            true,
            true
        );

        for (uint i = 0; i < numMessages; i++) {
            // Validating that returned priceIds are equal
            assertEq(priceFeeds[i].id, priceIds[i]);
            assertEq(priceFeeds[i].price.price, messages[i].price);
            assertEq(priceFeeds[i].price.conf, messages[i].conf);
            assertEq(priceFeeds[i].price.expo, messages[i].expo);
            assertEq(priceFeeds[i].price.publishTime, messages[i].publishTime);
            assertEq(priceFeeds[i].emaPrice.price, messages[i].emaPrice);
            assertEq(priceFeeds[i].emaPrice.conf, messages[i].emaConf);
            assertEq(priceFeeds[i].emaPrice.expo, messages[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                messages[i].publishTime
            );

            // Validating that prices are stored on chain
            PythStructs.Price memory curPrice = pyth.getPriceUnsafe(
                messages[i].priceId
            );

            assertEq(priceFeeds[i].price.price, curPrice.price);
            assertEq(priceFeeds[i].price.conf, curPrice.conf);
            assertEq(priceFeeds[i].price.expo, curPrice.expo);
            assertEq(priceFeeds[i].price.publishTime, curPrice.publishTime);
        }
    }

    function testParsePriceFeedUpdatesWithConfigIfStorageFalse(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numMessages = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        pyth.parsePriceFeedUpdatesWithConfig{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64,
            false,
            true,
            false
        );

        // validate that stored prices of each priceId are still unpopulated
        for (uint i = 0; i < numMessages; i++) {
            vm.expectRevert(PythErrors.PriceFeedNotFound.selector);
            pyth.getPriceUnsafe(priceIds[i]);
        }
    }

    function testParsePriceFeedUpdatesWithConfigWorks(uint seed) public {
        setRandSeed(seed);
        uint numMessages = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);
        (
            PythStructs.PriceFeed[] memory priceFeeds,
            uint64[] memory slots
        ) = pyth.parsePriceFeedUpdatesWithConfig{value: updateFee}(
                updateData,
                priceIds,
                0,
                MAX_UINT64,
                false,
                true,
                false
            );

        assertEq(priceFeeds.length, numMessages);
        assertEq(slots.length, numMessages);

        for (uint i = 0; i < numMessages; i++) {
            assertEq(priceFeeds[i].id, priceIds[i]);
            assertEq(priceFeeds[i].price.price, messages[i].price);
            assertEq(priceFeeds[i].price.conf, messages[i].conf);
            assertEq(priceFeeds[i].price.expo, messages[i].expo);
            assertEq(priceFeeds[i].price.publishTime, messages[i].publishTime);
            assertEq(priceFeeds[i].emaPrice.price, messages[i].emaPrice);
            assertEq(priceFeeds[i].emaPrice.conf, messages[i].emaConf);
            assertEq(priceFeeds[i].emaPrice.expo, messages[i].expo);
            assertEq(
                priceFeeds[i].emaPrice.publishTime,
                messages[i].publishTime
            );
            // Check that the slot returned is 1, as set in generateWhMerkleUpdateWithSource
            assertEq(slots[i], 1);
        }
    }

    function testParsePriceFeedUpdatesWorksWithOverlappingWithinTimeRangeUpdates()
        public
    {
        PriceFeedMessage[] memory messages = new PriceFeedMessage[](2);

        messages[0].priceId = bytes32(uint(1));
        messages[0].price = 1000;
        messages[0].publishTime = 10;

        messages[1].priceId = bytes32(uint(1));
        messages[1].price = 2000;
        messages[1].publishTime = 20;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(1));

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, 20);

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));

        assertTrue(
            (priceFeeds[0].price.price == 1000 &&
                priceFeeds[0].price.publishTime == 10) ||
                (priceFeeds[0].price.price == 2000 &&
                    priceFeeds[0].price.publishTime == 20)
        );
    }

    function testParsePriceFeedUpdatesWorksWithOverlappingMixedTimeRangeUpdates()
        public
    {
        PriceFeedMessage[] memory messages = new PriceFeedMessage[](2);

        messages[0].priceId = bytes32(uint(1));
        messages[0].price = 1000;
        messages[0].publishTime = 10;

        messages[1].priceId = bytes32(uint(1));
        messages[1].price = 2000;
        messages[1].publishTime = 20;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(1));

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 5, 15);

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));
        assertEq(priceFeeds[0].price.price, 1000);
        assertEq(priceFeeds[0].price.publishTime, 10);

        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            15,
            25
        );

        assertEq(priceFeeds.length, 1);
        assertEq(priceFeeds[0].id, bytes32(uint(1)));
        assertEq(priceFeeds[0].price.price, 2000);
        assertEq(priceFeeds[0].price.publishTime, 20);
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateVAAIsInvalid(
        uint seed
    ) public {
        setRandSeed(seed);
        uint numMessages = 1 + (getRandUint() % 10);
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessagesWithConfig(
                messages,
                MerkleUpdateConfig(
                    MERKLE_TREE_DEPTH,
                    NUM_GUARDIAN_SIGNERS,
                    SOURCE_EMITTER_CHAIN_ID,
                    SOURCE_EMITTER_ADDRESS,
                    true
                )
            );

        // It might revert due to different wormhole errors
        vm.expectRevert();
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesWithConfigRevertsWithExcessUpdateData()
        public
    {
        // Create a price update with more price updates than requested price IDs
        uint numPriceIds = 2;
        uint numMessages = numPriceIds + 1; // One more than the number of price IDs

        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        // Only use a subset of the price IDs to trigger the strict check
        bytes32[] memory requestedPriceIds = new bytes32[](numPriceIds);
        for (uint i = 0; i < numPriceIds; i++) {
            requestedPriceIds[i] = priceIds[i];
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        // Should revert in strict mode
        vm.expectRevert(PythErrors.InvalidArgument.selector);
        pyth.parsePriceFeedUpdatesWithConfig{value: updateFee}(
            updateData,
            requestedPriceIds,
            0,
            MAX_UINT64,
            false,
            true,
            false
        );
    }

    function testParsePriceFeedUpdatesWithConfigRevertsWithFewerUpdateData()
        public
    {
        // Create a price update with fewer price updates than requested price IDs
        uint numPriceIds = 3;
        uint numMessages = numPriceIds - 1; // One less than the number of price IDs

        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        // Create a larger array of requested price IDs to trigger the strict check
        bytes32[] memory requestedPriceIds = new bytes32[](numPriceIds);
        for (uint i = 0; i < numMessages; i++) {
            requestedPriceIds[i] = priceIds[i];
        }
        // Add an extra price ID that won't be in the updates
        requestedPriceIds[numMessages] = bytes32(
            uint256(keccak256(abi.encodePacked("extra_id")))
        );

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessages(messages);

        // Should revert in strict mode because we have fewer updates than price IDs
        vm.expectRevert(PythErrors.InvalidArgument.selector);
        pyth.parsePriceFeedUpdatesWithConfig{value: updateFee}(
            updateData,
            requestedPriceIds,
            0,
            MAX_UINT64,
            false,
            true,
            false
        );
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateSourceChainIsInvalid()
        public
    {
        uint numMessages = 10;
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessagesWithConfig(
                messages,
                MerkleUpdateConfig(
                    MERKLE_TREE_DEPTH,
                    NUM_GUARDIAN_SIGNERS,
                    SOURCE_EMITTER_CHAIN_ID + 1,
                    SOURCE_EMITTER_ADDRESS,
                    false
                )
            );

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdatesRevertsIfUpdateSourceAddressIsInvalid()
        public
    {
        uint numMessages = 10;
        (
            bytes32[] memory priceIds,
            PriceFeedMessage[] memory messages
        ) = generateRandomPriceMessages(numMessages);

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createBatchedUpdateDataFromMessagesWithConfig(
                messages,
                MerkleUpdateConfig(
                    MERKLE_TREE_DEPTH,
                    NUM_GUARDIAN_SIGNERS,
                    SOURCE_EMITTER_CHAIN_ID,
                    0x00000000000000000000000000000000000000000000000000000000000000aa, // Random wrong source address
                    false
                )
            );

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParseTwapPriceFeedUpdates() public {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = basePriceIds[0];

        // Create update data directly from base TWAP messages
        bytes[] memory updateData = new bytes[](2);
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        // Parse the TWAP updates
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds = pyth
            .parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);

        // Validate results
        assertEq(twapPriceFeeds[0].id, basePriceIds[0]);
        assertEq(
            twapPriceFeeds[0].startTime,
            baseTwapStartMessages[0].publishTime
        );
        assertEq(twapPriceFeeds[0].endTime, baseTwapEndMessages[0].publishTime);
        assertEq(twapPriceFeeds[0].twap.expo, baseTwapStartMessages[0].expo);

        // Expected TWAP price: (210_000 - 100_000) / (1100 - 1000) = 1100
        assertEq(twapPriceFeeds[0].twap.price, int64(1100));

        // Expected TWAP conf: (18_000 - 10_000) / (1100 - 1000) = 80
        assertEq(twapPriceFeeds[0].twap.conf, uint64(80));

        // Validate the downSlotsRatio is 0 in our test implementation
        assertEq(twapPriceFeeds[0].downSlotsRatio, uint32(0));
    }

    function testParseTwapPriceFeedUpdatesRevertsWithInvalidUpdateDataLength()
        public
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Create invalid update data with wrong length
        bytes[] memory updateData = new bytes[](1); // Should be 2
        updateData[0] = new bytes(1);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parseTwapPriceFeedUpdates{value: 0}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesRevertsWithMismatchedPriceIds()
        public
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Copy base messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        // Change end message priceId to create mismatch
        endMessages[0].priceId = bytes32(uint256(2));

        // Create update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidTwapUpdateDataSet.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesRevertsWithInvalidTimeOrdering()
        public
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Copy base messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        // Modify times to create invalid ordering
        startMessages[0].publishTime = 1100;
        startMessages[0].publishSlot = 1100;
        endMessages[0].publishTime = 1000;
        endMessages[0].publishSlot = 1000;
        endMessages[0].prevPublishTime = 900;

        // Create update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidTwapUpdateDataSet.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesRevertsWithMismatchedExponents()
        public
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Copy base messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        // Change end message expo to create mismatch
        endMessages[0].expo = -6;

        // Create update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidTwapUpdateDataSet.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesRevertsWithInvalidPrevPublishTime()
        public
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Copy base messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        // Set invalid prevPublishTime (greater than publishTime)
        startMessages[0].prevPublishTime = 1100;

        // Create update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidTwapUpdateData.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesRevertsWithInsufficientFee() public {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint256(1));

        // Copy base messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        // Create update data
        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            MerkleUpdateConfig(
                MERKLE_TREE_DEPTH,
                NUM_GUARDIAN_SIGNERS,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee - 1}(
            updateData,
            priceIds
        );
    }

    function testParseTwapPriceFeedUpdatesMultipleFeeds() public {
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = basePriceIds[0];
        priceIds[1] = basePriceIds[1];

        // Create update data with both price feeds in the same updates
        bytes[] memory updateData = new bytes[](2); // Just 2 updates (start/end) for both price feeds

        // Combine both price feeds in the same messages
        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](2);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            2
        );

        // Add both price feeds to the start and end messages
        startMessages[0] = baseTwapStartMessages[0];
        startMessages[1] = baseTwapStartMessages[1];
        endMessages[0] = baseTwapEndMessages[0];
        endMessages[1] = baseTwapEndMessages[1];

        // Generate Merkle updates with both price feeds included
        MerkleUpdateConfig memory config = MerkleUpdateConfig(
            MERKLE_TREE_DEPTH,
            NUM_GUARDIAN_SIGNERS,
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            false
        );

        // Create just 2 updates that contain both price feeds
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            config
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            config
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        // Parse the TWAP updates
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds = pyth
            .parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);

        // Validate results for first price feed
        assertEq(twapPriceFeeds[0].id, basePriceIds[0]);
        assertEq(
            twapPriceFeeds[0].startTime,
            baseTwapStartMessages[0].publishTime
        );
        assertEq(twapPriceFeeds[0].endTime, baseTwapEndMessages[0].publishTime);
        assertEq(twapPriceFeeds[0].twap.expo, baseTwapStartMessages[0].expo);
        // Expected TWAP price: (210_000 - 100_000) / (1100 - 1000) = 1100
        assertEq(twapPriceFeeds[0].twap.price, int64(1100));
        // Expected TWAP conf: (18_000 - 10_000) / (1100 - 1000) = 80
        assertEq(twapPriceFeeds[0].twap.conf, uint64(80));
        assertEq(twapPriceFeeds[0].downSlotsRatio, uint32(0));

        // Validate results for second price feed
        assertEq(twapPriceFeeds[1].id, basePriceIds[1]);
        assertEq(
            twapPriceFeeds[1].startTime,
            baseTwapStartMessages[1].publishTime
        );
        assertEq(twapPriceFeeds[1].endTime, baseTwapEndMessages[1].publishTime);
        assertEq(twapPriceFeeds[1].twap.expo, baseTwapStartMessages[1].expo);
        // Expected TWAP price: (800_000 - 500_000) / (1100 - 1000) = 3000
        assertEq(twapPriceFeeds[1].twap.price, int64(3000));
        // Expected TWAP conf: (40_000 - 20_000) / (1100 - 1000) = 200
        assertEq(twapPriceFeeds[1].twap.conf, uint64(200));
        assertEq(twapPriceFeeds[1].downSlotsRatio, uint32(0));
    }

    function testParseTwapPriceFeedUpdatesRevertsWithMismatchedArrayLengths()
        public
    {
        // Case 1: Too many updates (more than 2)
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = basePriceIds[0];

        // Create 3 updates (should only be 2)
        bytes[] memory updateData = new bytes[](3);

        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0];
        endMessages[0] = baseTwapEndMessages[0];

        MerkleUpdateConfig memory config = MerkleUpdateConfig(
            MERKLE_TREE_DEPTH,
            NUM_GUARDIAN_SIGNERS,
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            false
        );

        // Fill with valid updates, but too many of them
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            config
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            config
        );
        updateData[2] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            config
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);

        // Case 2: Too few updates (less than 2)
        updateData = new bytes[](1); // Only 1 update (should be 2)
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            config
        );

        updateFee = pyth.getUpdateFee(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }

    function testParseTwapPriceFeedUpdatesWithRequestedButNotFoundPriceId()
        public
    {
        // Create price IDs, including one that's not in the updates
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = basePriceIds[0]; // This one exists in our updates
        priceIds[1] = bytes32(uint256(999)); // This one doesn't exist in our updates

        TwapPriceFeedMessage[]
            memory startMessages = new TwapPriceFeedMessage[](1);
        TwapPriceFeedMessage[] memory endMessages = new TwapPriceFeedMessage[](
            1
        );
        startMessages[0] = baseTwapStartMessages[0]; // Only includes priceIds[0]
        endMessages[0] = baseTwapEndMessages[0]; // Only includes priceIds[0]

        MerkleUpdateConfig memory config = MerkleUpdateConfig(
            MERKLE_TREE_DEPTH,
            NUM_GUARDIAN_SIGNERS,
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            false
        );

        bytes[] memory updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startMessages,
            config
        );
        updateData[1] = generateWhMerkleTwapUpdateWithSource(
            endMessages,
            config
        );

        uint updateFee = pyth.getTwapUpdateFee(updateData);

        // Should revert because one of the requested price IDs is not found in the updates
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);
    }
}
