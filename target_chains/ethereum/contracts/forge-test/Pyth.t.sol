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

contract PythTest is Test, WormholeTestUtils, PythTestUtils {
    IPyth public pyth;

    // -1 is equal to 0xffffff which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We will have less than 512 price for a foreseeable future.
    uint8 constant MERKLE_TREE_DEPTH = 9;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(NUM_GUARDIAN_SIGNERS)));
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
    ) public returns (bytes[][] memory updateData, uint updateFee) {
        require(messages.length >= 2, "At least 2 messages required for TWAP");

        // Select first two messages for TWAP calculation
        PriceFeedMessage[] memory startMessages = new PriceFeedMessage[](1);
        startMessages[0] = messages[0];

        PriceFeedMessage[] memory endMessages = new PriceFeedMessage[](1);
        endMessages[0] = messages[1];

        // Generate the update data for start and end
        bytes[] memory startUpdateData = new bytes[](1);
        startUpdateData[0] = generateWhMerkleUpdateWithSource(
            startMessages,
            config
        );

        bytes[] memory endUpdateData = new bytes[](1);
        endUpdateData[0] = generateWhMerkleUpdateWithSource(
            endMessages,
            config
        );

        // Create the updateData array with exactly 2 elements as required by parseTwapPriceFeedUpdates
        updateData = new bytes[][](2);
        updateData[0] = startUpdateData;
        updateData[1] = endUpdateData;

        // Calculate the update fee
        updateFee = pyth.getUpdateFee(updateData[0]);
    }

    function createBatchedTwapUpdateDataFromMessages(
        PriceFeedMessage[] memory messages
    ) internal returns (bytes[][] memory updateData, uint updateFee) {
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
        // Define a single price ID we'll use for the test
        uint numMessages = 1;
        bytes32[] memory priceIds = new bytes32[](numMessages);
        priceIds[0] = bytes32(uint256(1));

        // Create two PriceFeedMessage instances for the start and end points
        PriceFeedMessage[] memory messages = new PriceFeedMessage[](2);

        // Start message
        messages[0].priceId = priceIds[0];
        messages[0].price = 100;
        messages[0].conf = 10;
        messages[0].expo = -8;
        messages[0].publishTime = 1000;
        messages[0].prevPublishTime = 900;
        messages[0].emaPrice = 100;
        messages[0].emaConf = 10;

        // End message
        messages[1].priceId = priceIds[0];
        messages[1].price = 110;
        messages[1].conf = 8;
        messages[1].expo = -8;
        messages[1].publishTime = 1100;
        messages[1].prevPublishTime = 1000;
        messages[1].emaPrice = 110;
        messages[1].emaConf = 8;

        // Create update data for TWAP calculation
        (
            bytes[][] memory updateData,
            uint updateFee
        ) = createBatchedTwapUpdateDataFromMessages(messages);

        // log the updateData
        console.logBytes(updateData[0][0]);
        console.logBytes(updateData[1][0]);

        // Parse the TWAP updates
        PythStructs.TwapPriceFeed[] memory twapPriceFeeds = pyth
            .parseTwapPriceFeedUpdates{value: updateFee}(updateData, priceIds);

        // Validate basic properties
        assertEq(twapPriceFeeds[0].id, priceIds[0]);
        assertEq(twapPriceFeeds[0].startTime, uint64(1000)); // publishTime start
        assertEq(twapPriceFeeds[0].endTime, uint64(1100)); // publishTime end
        assertEq(twapPriceFeeds[0].twap.expo, int32(-8)); // expo

        // The TWAP price should be the difference in cumulative price divided by the slot difference
        assertEq(twapPriceFeeds[0].twap.price, int64(105));

        // The TWAP conf should be the difference in cumulative conf divided by the slot difference
        assertEq(twapPriceFeeds[0].twap.conf, uint64(9));

        // Validate the downSlotsRatio is 0 in our test implementation
        assertEq(twapPriceFeeds[0].downSlotsRatio, uint32(0));
    }
}
