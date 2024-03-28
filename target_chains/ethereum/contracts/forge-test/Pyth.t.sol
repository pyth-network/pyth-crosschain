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

        (bytes[] memory updateData, uint updateFee) = createBatchedUpdateDataFromMessagesWithConfig(
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
}
