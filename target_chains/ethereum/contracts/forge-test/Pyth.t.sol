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
    TwapPriceFeedMessage[1] baseTwapStartMessages;
    TwapPriceFeedMessage[1] baseTwapEndMessages;
    bytes32[1] basePriceIds;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(NUM_GUARDIAN_SIGNERS)));

        // Initialize base TWAP messages
        basePriceIds[0] = bytes32(uint256(1));

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

        // Create TWAP messages from regular price feed messages
        // For TWAP calculation, we need cumulative values that increase over time
        TwapPriceFeedMessage[]
            memory startTwapMessages = new TwapPriceFeedMessage[](1);
        startTwapMessages[0].priceId = messages[0].priceId;
        // For test purposes, we'll set cumulative values for start message
        startTwapMessages[0].cumulativePrice = int128(messages[0].price) * 1000;
        startTwapMessages[0].cumulativeConf = uint128(messages[0].conf) * 1000;
        startTwapMessages[0].numDownSlots = 0; // No down slots for testing
        startTwapMessages[0].expo = messages[0].expo;
        startTwapMessages[0].publishTime = messages[0].publishTime;
        startTwapMessages[0].prevPublishTime = messages[0].prevPublishTime;
        startTwapMessages[0].publishSlot = 1000; // Start slot

        TwapPriceFeedMessage[]
            memory endTwapMessages = new TwapPriceFeedMessage[](1);
        endTwapMessages[0].priceId = messages[1].priceId;
        // For end message, make sure cumulative values are higher than start
        endTwapMessages[0].cumulativePrice =
            int128(messages[1].price) *
            1000 +
            startTwapMessages[0].cumulativePrice;
        endTwapMessages[0].cumulativeConf =
            uint128(messages[1].conf) *
            1000 +
            startTwapMessages[0].cumulativeConf;
        endTwapMessages[0].numDownSlots = 0; // No down slots for testing
        endTwapMessages[0].expo = messages[1].expo;
        endTwapMessages[0].publishTime = messages[1].publishTime;
        endTwapMessages[0].prevPublishTime = messages[1].prevPublishTime;
        endTwapMessages[0].publishSlot = 1100; // End slot (100 slots after start)

        // Create the updateData array with exactly 2 elements as required by parseTwapPriceFeedUpdates
        updateData = new bytes[](2);
        updateData[0] = generateWhMerkleTwapUpdateWithSource(
            startTwapMessages,
            config
        );
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

    /// Testing parsePriceFeedUpdates method.
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

        uint updateFee = pyth.getUpdateFee(updateData);

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

        uint updateFee = pyth.getUpdateFee(updateData);

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

        uint updateFee = pyth.getUpdateFee(updateData);

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

        uint updateFee = pyth.getUpdateFee(updateData);

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

        uint updateFee = pyth.getUpdateFee(updateData);

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

        uint updateFee = pyth.getUpdateFee(updateData);

        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.parseTwapPriceFeedUpdates{value: updateFee - 1}(
            updateData,
            priceIds
        );
    }
}
