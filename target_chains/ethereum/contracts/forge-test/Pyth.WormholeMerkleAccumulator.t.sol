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

import "../contracts/libraries/MerkleTree.sol";

contract PythWormholeMerkleAccumulatorTest is
    Test,
    WormholeTestUtils,
    PythTestUtils
{
    IPyth public pyth;

    // -1 is equal to 0xffffff which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    function setUp() public virtual {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(1)));
    }

    function assertPriceFeedMessageStored(
        PriceFeedMessage memory priceFeedMessage
    ) internal {
        PythStructs.Price memory aggregatePrice = pyth.getPriceUnsafe(
            priceFeedMessage.priceId
        );
        assertEq(aggregatePrice.price, priceFeedMessage.price);
        assertEq(aggregatePrice.conf, priceFeedMessage.conf);
        assertEq(aggregatePrice.expo, priceFeedMessage.expo);
        assertEq(aggregatePrice.publishTime, priceFeedMessage.publishTime);

        PythStructs.Price memory emaPrice = pyth.getEmaPriceUnsafe(
            priceFeedMessage.priceId
        );
        assertEq(emaPrice.price, priceFeedMessage.emaPrice);
        assertEq(emaPrice.conf, priceFeedMessage.emaConf);
        assertEq(emaPrice.expo, priceFeedMessage.expo);
        assertEq(emaPrice.publishTime, priceFeedMessage.publishTime);
    }

    function assertParsedPriceFeedEqualsMessage(
        PythStructs.PriceFeed memory priceFeed,
        PriceFeedMessage memory priceFeedMessage,
        bytes32 priceId
    ) internal {
        assertEq(priceFeed.id, priceId);
        assertEq(priceFeed.price.price, priceFeedMessage.price);
        assertEq(priceFeed.price.conf, priceFeedMessage.conf);
        assertEq(priceFeed.price.expo, priceFeedMessage.expo);
        assertEq(priceFeed.price.publishTime, priceFeedMessage.publishTime);
        assertEq(priceFeed.emaPrice.price, priceFeedMessage.emaPrice);
        assertEq(priceFeed.emaPrice.conf, priceFeedMessage.emaConf);
        assertEq(priceFeed.emaPrice.expo, priceFeedMessage.expo);
        assertEq(priceFeed.emaPrice.publishTime, priceFeedMessage.publishTime);
    }

    function assertParsedPriceFeedStored(
        PythStructs.PriceFeed memory priceFeed
    ) internal {
        PythStructs.Price memory aggregatePrice = pyth.getPriceUnsafe(
            priceFeed.id
        );
        assertEq(aggregatePrice.price, priceFeed.price.price);
        assertEq(aggregatePrice.conf, priceFeed.price.conf);
        assertEq(aggregatePrice.expo, priceFeed.price.expo);
        assertEq(aggregatePrice.publishTime, priceFeed.price.publishTime);

        PythStructs.Price memory emaPrice = pyth.getEmaPriceUnsafe(
            priceFeed.id
        );
        assertEq(emaPrice.price, priceFeed.emaPrice.price);
        assertEq(emaPrice.conf, priceFeed.emaPrice.conf);
        assertEq(emaPrice.expo, priceFeed.emaPrice.expo);
        assertEq(emaPrice.publishTime, priceFeed.emaPrice.publishTime);
    }

    function assertPriceFeedEqual(
        PythStructs.PriceFeed memory priceFeed1,
        PythStructs.PriceFeed memory priceFeed2
    ) internal {
        assertEq(priceFeed1.id, priceFeed2.id);
        assertEq(priceFeed1.price.price, priceFeed2.price.price);
        assertEq(priceFeed1.price.conf, priceFeed2.price.conf);
        assertEq(priceFeed1.price.expo, priceFeed2.price.expo);
        assertEq(priceFeed1.price.publishTime, priceFeed2.price.publishTime);
        assertEq(priceFeed1.emaPrice.price, priceFeed2.emaPrice.price);
        assertEq(priceFeed1.emaPrice.conf, priceFeed2.emaPrice.conf);
        assertEq(priceFeed1.emaPrice.expo, priceFeed2.emaPrice.expo);
        assertEq(
            priceFeed1.emaPrice.publishTime,
            priceFeed2.emaPrice.publishTime
        );
    }

    function generateRandomPriceFeedMessage(
        uint numPriceFeeds
    ) internal returns (PriceFeedMessage[] memory priceFeedMessages) {
        priceFeedMessages = new PriceFeedMessage[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i] = PriceFeedMessage({
                priceId: getRandBytes32(),
                price: getRandInt64(),
                conf: getRandUint64(),
                expo: getRandInt32(),
                publishTime: getRandUint64(),
                prevPublishTime: getRandUint64(),
                emaPrice: getRandInt64(),
                emaConf: getRandUint64()
            });
        }
    }

    /**
     * @notice Returns `numPriceFeeds` random price feed messages with price & expo bounded
     * to realistic values and publishTime set to 1.
     */
    function generateRandomBoundedPriceFeedMessage(
        uint numPriceFeeds
    ) internal returns (PriceFeedMessage[] memory priceFeedMessages) {
        priceFeedMessages = new PriceFeedMessage[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i] = PriceFeedMessage({
                priceId: getRandBytes32(),
                price: int64(getRandUint64() / 10), // assuming price should always be positive
                conf: getRandUint64(),
                expo: int32(getRandInt8() % 13), // pyth contract guarantees that expo between [-12, 12]
                publishTime: uint64(1),
                prevPublishTime: getRandUint64(),
                emaPrice: getRandInt64(),
                emaConf: getRandUint64()
            });
        }
    }

    function createWormholeMerkleUpdateData(
        PriceFeedMessage[] memory priceFeedMessages
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        updateData = new bytes[](1);

        uint8 depth = 0;
        while ((1 << depth) < priceFeedMessages.length) {
            depth++;
        }

        depth += getRandUint8() % 3;

        updateData[0] = generateWhMerkleUpdate(priceFeedMessages, depth, 1);

        updateFee = pyth.getUpdateFee(updateData);
    }

    /// @notice This method creates a forward compatible wormhole update data by using a newer minor version,
    /// setting a trailing header size and generating additional trailing header data of size `trailingHeaderSize`
    function createFowardCompatibleWormholeMerkleUpdateData(
        PriceFeedMessage[] memory priceFeedMessages,
        uint8 minorVersion,
        uint8 trailingHeaderSize
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        updateData = new bytes[](1);

        uint8 depth = 0;
        while ((1 << depth) < priceFeedMessages.length) {
            depth++;
        }

        depth += getRandUint8() % 3;
        bytes memory trailingHeaderData = new bytes(uint8(0));
        for (uint i = 0; i < trailingHeaderSize; i++) {
            trailingHeaderData = abi.encodePacked(trailingHeaderData, uint8(i));
        }
        updateData[0] = generateForwardCompatibleWhMerkleUpdate(
            priceFeedMessages,
            depth,
            1,
            minorVersion,
            trailingHeaderData
        );

        updateFee = pyth.getUpdateFee(updateData);
    }

    /// Testing update price feeds method using wormhole merkle update type.
    function testUpdatePriceFeedWithWormholeMerkleWorks(uint seed) public {
        setRandSeed(seed);

        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        for (uint i = 0; i < numPriceFeeds; i++) {
            assertPriceFeedMessageStored(priceFeedMessages[i]);
        }

        // Update the prices again with the same data should work
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        for (uint i = 0; i < numPriceFeeds; i++) {
            assertPriceFeedMessageStored(priceFeedMessages[i]);
        }

        // Update the prices again with updated data should update the prices
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i].price = getRandInt64();
            priceFeedMessages[i].conf = getRandUint64();
            priceFeedMessages[i].expo = getRandInt32();

            // Increase the publish time if it is not causing an overflow
            if (priceFeedMessages[i].publishTime != type(uint64).max) {
                priceFeedMessages[i].publishTime += 1;
            }
            priceFeedMessages[i].emaPrice = getRandInt64();
            priceFeedMessages[i].emaConf = getRandUint64();
        }

        (updateData, updateFee) = createWormholeMerkleUpdateData(
            priceFeedMessages
        );

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        for (uint i = 0; i < numPriceFeeds; i++) {
            assertPriceFeedMessageStored(priceFeedMessages[i]);
        }
    }

    function testUpdatePriceFeedWithWormholeMerkleWorksOnMultiUpdate() public {
        PriceFeedMessage[]
            memory priceFeedMessages1 = generateRandomPriceFeedMessage(2);
        PriceFeedMessage[]
            memory priceFeedMessages2 = generateRandomPriceFeedMessage(2);

        // Make the 2nd message of the second update the same as the 1st message of the first update
        priceFeedMessages2[1].priceId = priceFeedMessages1[0].priceId;
        // Adjust the timestamps so the second timestamp is greater than the first
        priceFeedMessages1[0].publishTime = 5;
        priceFeedMessages2[1].publishTime = 10;

        bytes[] memory updateData = new bytes[](2);

        uint8 depth = 1; // 2 messages
        uint8 numSigners = 1;
        updateData[0] = generateWhMerkleUpdate(
            priceFeedMessages1,
            depth,
            numSigners
        );
        updateData[1] = generateWhMerkleUpdate(
            priceFeedMessages2,
            depth,
            numSigners
        );

        uint updateFee = pyth.getUpdateFee(updateData);

        bytes32[] memory priceIds = new bytes32[](3);
        priceIds[0] = priceFeedMessages1[0].priceId;
        priceIds[1] = priceFeedMessages1[1].priceId;
        priceIds[2] = priceFeedMessages2[0].priceId;
        // parse price feeds before updating since parsing price feeds should be independent
        // of whatever is currently stored in the contract.
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        PriceFeedMessage[]
            memory expectedPriceFeedMessages = new PriceFeedMessage[](3);
        // Only the first occurrence of a valid priceFeedMessage for a paritcular priceFeed.id
        // within an updateData will be parsed which is why we exclude priceFeedMessages2[1]
        // since it has the same priceFeed.id as priceFeedMessages1[0] even though it has a later publishTime.
        // This is different than how updatePriceFeed behaves which will always update using the data
        // of the priceFeedMessage with the latest publishTime for a particular priceFeed.id
        expectedPriceFeedMessages[0] = priceFeedMessages1[0];
        expectedPriceFeedMessages[1] = priceFeedMessages1[1];
        expectedPriceFeedMessages[2] = priceFeedMessages2[0];
        for (uint i = 0; i < expectedPriceFeedMessages.length; i++) {
            assertParsedPriceFeedEqualsMessage(
                priceFeeds[i],
                expectedPriceFeedMessages[i],
                priceIds[i]
            );
        }

        // parse updateData[1] for priceFeedMessages1[0].priceId since this has the latest publishTime
        // for that priceId and should be the one that is stored.
        bytes32[] memory priceIds1 = new bytes32[](1);
        priceIds1[0] = priceFeedMessages1[0].priceId;
        bytes[] memory parseUpdateDataInput1 = new bytes[](1);
        parseUpdateDataInput1[0] = updateData[1];

        PythStructs.PriceFeed[] memory priceFeeds1 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(parseUpdateDataInput1, priceIds1, 0, MAX_UINT64);

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        // check stored price feed information matches updateData
        assertPriceFeedMessageStored(priceFeedMessages1[1]);
        assertPriceFeedMessageStored(priceFeedMessages2[0]);
        assertPriceFeedMessageStored(priceFeedMessages2[1]);

        PythStructs.PriceFeed[]
            memory expectedPriceFeeds = new PythStructs.PriceFeed[](3);
        expectedPriceFeeds[0] = priceFeeds1[0];
        expectedPriceFeeds[1] = priceFeeds[1];
        expectedPriceFeeds[2] = priceFeeds[2];

        // check stored price feed information matches parsed price feeds
        for (uint i = 0; i < expectedPriceFeeds.length; i++) {
            assertParsedPriceFeedStored(expectedPriceFeeds[i]);
        }
    }

    function testUpdatePriceFeedWithWormholeMerkleIgnoresOutOfOrderUpdateSingleCall()
        public
    {
        PriceFeedMessage[]
            memory priceFeedMessages1 = generateRandomPriceFeedMessage(1);
        PriceFeedMessage[]
            memory priceFeedMessages2 = generateRandomPriceFeedMessage(1);

        // Make the price ids the same
        priceFeedMessages2[0].priceId = priceFeedMessages1[0].priceId;
        // Adjust the timestamps so the second timestamp is smaller than the first
        // so it doesn't get stored.
        priceFeedMessages1[0].publishTime = 10;
        priceFeedMessages2[0].publishTime = 5;

        bytes[] memory updateData = new bytes[](2);

        uint8 depth = 0; // 1 messages
        uint8 numSigners = 1;

        updateData[0] = generateWhMerkleUpdate(
            priceFeedMessages1,
            depth,
            numSigners
        );
        updateData[1] = generateWhMerkleUpdate(
            priceFeedMessages2,
            depth,
            numSigners
        );

        uint updateFee = pyth.getUpdateFee(updateData);

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        assertPriceFeedMessageStored(priceFeedMessages1[0]);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessages1[0].priceId;

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);
        assertEq(priceFeeds.length, 1);
        assertParsedPriceFeedStored(priceFeeds[0]);

        // parsePriceFeedUpdates should return the first priceFeed in the case
        // that the updateData contains multiple feeds with the same id.
        // Swap the order of updates in updateData to verify that the other priceFeed is returned
        bytes[] memory updateData1 = new bytes[](2);
        updateData1[0] = updateData[1];
        updateData1[1] = updateData[0];

        PythStructs.PriceFeed[] memory priceFeeds1 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData1, priceIds, 0, MAX_UINT64);
        assertEq(priceFeeds1.length, 1);
        assertEq(priceFeeds1[0].price.publishTime, 5);
    }

    function testUpdatePriceFeedWithWormholeMerkleIgnoresOutOfOrderUpdateMultiCall()
        public
    {
        PriceFeedMessage[]
            memory priceFeedMessages1 = generateRandomPriceFeedMessage(1);
        PriceFeedMessage[]
            memory priceFeedMessages2 = generateRandomPriceFeedMessage(1);

        // Make the price ids the same
        priceFeedMessages2[0].priceId = priceFeedMessages1[0].priceId;
        // Adjust the timestamps so the second timestamp is smaller than the first
        // so it doesn't get stored.
        priceFeedMessages1[0].publishTime = 10;
        priceFeedMessages2[0].publishTime = 5;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages1);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        (updateData, updateFee) = createWormholeMerkleUpdateData(
            priceFeedMessages2
        );
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        // Make sure that the old value is still stored
        assertPriceFeedMessageStored(priceFeedMessages1[0]);
    }

    function testParsePriceFeedUpdatesWithWormholeMerkleWorksWithOutOfOrderUpdateMultiCall()
        public
    {
        PriceFeedMessage[]
            memory priceFeedMessages1 = generateRandomPriceFeedMessage(1);
        PriceFeedMessage[]
            memory priceFeedMessages2 = generateRandomPriceFeedMessage(1);

        // Make the price ids the same
        priceFeedMessages2[0].priceId = priceFeedMessages1[0].priceId;
        // Adjust the timestamps so the second timestamp is smaller than the first
        // Parse should work regardless of what's stored on chain.
        priceFeedMessages1[0].publishTime = 10;
        priceFeedMessages2[0].publishTime = 5;

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages1);
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessages1[0].priceId;
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        // Parse should always return the same value regardless of what's stored on chain.
        assertEq(priceFeeds.length, 1);
        assertParsedPriceFeedEqualsMessage(
            priceFeeds[0],
            priceFeedMessages1[0],
            priceIds[0]
        );
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
        assertEq(priceFeeds.length, 1);
        assertParsedPriceFeedEqualsMessage(
            priceFeeds[0],
            priceFeedMessages1[0],
            priceIds[0]
        );

        (
            bytes[] memory updateData1,
            uint updateFee1
        ) = createWormholeMerkleUpdateData(priceFeedMessages2);
        pyth.updatePriceFeeds{value: updateFee1}(updateData1);
        // reparse the original updateData should still return the same thing
        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
        assertEq(priceFeeds.length, 1);
        assertParsedPriceFeedEqualsMessage(
            priceFeeds[0],
            priceFeedMessages1[0],
            priceIds[0]
        );

        // parsing the second message should return the data based on the second messagef
        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee1}(
            updateData1,
            priceIds,
            0,
            MAX_UINT64
        );
        assertEq(priceFeeds.length, 1);
        assertParsedPriceFeedEqualsMessage(
            priceFeeds[0],
            priceFeedMessages2[0],
            priceIds[0]
        );
    }

    /// @notice This method creates a forged invalid wormhole update data.
    /// The caller should pass the forgeItem as string and if it matches the
    /// expected value, that item will be forged to be invalid.
    function createAndForgeWormholeMerkleUpdateData(
        bytes memory forgeItem
    )
        public
        returns (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        )
    {
        uint numPriceFeeds = 10;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }

        bytes[] memory encodedPriceFeedMessages = encodePriceFeedMessages(
            priceFeedMessages
        );

        (bytes20 rootDigest, bytes[] memory proofs) = MerkleTree
            .constructProofs(encodedPriceFeedMessages, 4); // 4 is the depth of the tree (enough for 16 messages)

        bytes memory wormholePayload;
        unchecked {
            wormholePayload = abi.encodePacked(
                isNotMatch(forgeItem, "whMagic")
                    ? uint32(0x41555756)
                    : uint32(0x41555750),
                isNotMatch(forgeItem, "whUpdateType")
                    ? uint8(PythAccumulator.UpdateType.WormholeMerkle)
                    : uint8(PythAccumulator.UpdateType.WormholeMerkle) + 1,
                uint64(0), // Slot, not used in target networks
                uint32(0), // Storage index, not used in target networks
                isNotMatch(forgeItem, "rootDigest")
                    ? rootDigest
                    : bytes20(uint160(rootDigest) + 1)
            );
        }

        bytes memory wormholeMerkleVaa = generateVaa(
            0,
            isNotMatch(forgeItem, "whSourceChain")
                ? SOURCE_EMITTER_CHAIN_ID
                : SOURCE_EMITTER_CHAIN_ID + 1,
            isNotMatch(forgeItem, "whSourceAddress")
                ? SOURCE_EMITTER_ADDRESS
                : bytes32(
                    0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa00
                ),
            0,
            wormholePayload,
            1 // num signers
        );

        updateData = new bytes[](1);

        updateData[0] = abi.encodePacked(
            isNotMatch(forgeItem, "headerMagic")
                ? uint32(0x504e4155)
                : uint32(0x504e4150), // PythAccumulator.ACCUMULATOR_MAGIC
            isNotMatch(forgeItem, "headerMajorVersion") ? uint8(1) : uint8(2), // major version
            uint8(0), // minor version
            uint8(0), // trailing header size
            uint8(PythAccumulator.UpdateType.WormholeMerkle),
            uint16(wormholeMerkleVaa.length),
            wormholeMerkleVaa,
            uint8(priceFeedMessages.length)
        );

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            updateData[0] = abi.encodePacked(
                updateData[0],
                uint16(encodedPriceFeedMessages[i].length),
                encodedPriceFeedMessages[i],
                isNotMatch(forgeItem, "proofItem") ? proofs[i] : proofs[0]
            );
        }

        // manually calculate the fee
        // so this helper method doesn't trigger the error.
        // updateFee = pyth.getUpdateFee(numPriceFeeds);
        updateFee = singleUpdateFeeInWei() * numPriceFeeds;
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAAPayloadMagic()
        public
    {
        // In this test the Wormhole accumulator magic is wrong and the update gets reverted.
        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("whMagic");

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);

        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleWorksWithoutForging() public {
        // In this test we make sure the structure returned by createAndForgeWormholeMerkleUpdateData
        // is valid if no particular forge flag is set
        (
            bytes[] memory updateData,
            uint updateFee,

        ) = createAndForgeWormholeMerkleUpdateData("");

        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAAPayloadUpdateType()
        public
    {
        // In this test the Wormhole accumulator magic is wrong and the update gets
        // reverted.

        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("whUpdateType");
        vm.expectRevert(); // Reason: Conversion into non-existent enum type. However it
        // was not possible to check the revert reason in the test.
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert();
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAASource()
        public
    {
        // In this test the Wormhole message source is wrong.
        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("whSourceAddress");
        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );

        (
            updateData,
            updateFee,
            priceIds
        ) = createAndForgeWormholeMerkleUpdateData("whSourceChain");
        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongRootDigest()
        public
    {
        // In this test the Wormhole merkle proof digest is wrong
        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("rootDigest");
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongProofItem()
        public
    {
        // In this test all Wormhole merkle proof items are the first item proof
        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("proofItem");
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongHeader()
        public
    {
        // In this test the message headers are wrong
        (
            bytes[] memory updateData,
            uint updateFee,
            bytes32[] memory priceIds
        ) = createAndForgeWormholeMerkleUpdateData("headerMagic");
        vm.expectRevert(); // The revert reason is not deterministic because when it doesn't match it goes through
        // the old approach.
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        vm.expectRevert();
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );

        (
            updateData,
            updateFee,
            priceIds
        ) = createAndForgeWormholeMerkleUpdateData("headerMajorVersion");
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsIfUpdateFeeIsNotPaid()
        public
    {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        (bytes[] memory updateData, ) = createWormholeMerkleUpdateData(
            priceFeedMessages
        );

        bytes32[] memory priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }
        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.updatePriceFeeds{value: 0}(updateData);

        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.parsePriceFeedUpdates{value: 0}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedWithWormholeMerkleWorks(uint seed) public {
        setRandSeed(seed);

        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        bytes32[] memory priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);

        for (uint i = 0; i < priceFeeds.length; i++) {
            assertParsedPriceFeedEqualsMessage(
                priceFeeds[i],
                priceFeedMessages[i],
                priceIds[i]
            );
        }

        // update priceFeedMessages
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i].price = getRandInt64();
            priceFeedMessages[i].conf = getRandUint64();
            priceFeedMessages[i].expo = getRandInt32();
            priceFeedMessages[i].publishTime = getRandUint64();
            priceFeedMessages[i].emaPrice = getRandInt64();
            priceFeedMessages[i].emaConf = getRandUint64();
        }

        (updateData, updateFee) = createWormholeMerkleUpdateData(
            priceFeedMessages
        );

        // reparse
        priceFeeds = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );

        for (uint i = 0; i < priceFeeds.length; i++) {
            assertParsedPriceFeedEqualsMessage(
                priceFeeds[i],
                priceFeedMessages[i],
                priceIds[i]
            );
        }
    }

    function testParsePriceFeedUniqueWithWormholeMerkleWorks(uint seed) public {
        setRandSeed(seed);

        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        uint64 publishTime = getRandUint64();
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessages[0].priceId;
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i].priceId = priceFeedMessages[0].priceId;
            priceFeedMessages[i].publishTime = publishTime;
            priceFeedMessages[i].prevPublishTime = publishTime;
        }
        uint firstUpdate = (getRandUint() % numPriceFeeds);
        priceFeedMessages[firstUpdate].prevPublishTime = publishTime - 1;
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        PythStructs.PriceFeed[] memory priceFeeds = pyth
            .parsePriceFeedUpdatesUnique{value: updateFee}(
            updateData,
            priceIds,
            publishTime - 1,
            MAX_UINT64
        );

        priceFeeds = pyth.parsePriceFeedUpdatesUnique{value: updateFee}(
            updateData,
            priceIds,
            publishTime,
            MAX_UINT64
        );
        assertEq(priceFeeds.length, 1);

        assertParsedPriceFeedEqualsMessage(
            priceFeeds[0],
            priceFeedMessages[firstUpdate],
            priceIds[0]
        );
    }

    function testParsePriceFeedWithWormholeMerkleWorksRandomDistinctUpdatesInput(
        uint seed
    ) public {
        setRandSeed(seed);

        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        bytes32[] memory priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }

        // Shuffle the priceFeedMessages
        for (uint i = 1; i < numPriceFeeds; i++) {
            uint swapWith = getRandUint() % (i + 1);
            (priceFeedMessages[i], priceFeedMessages[swapWith]) = (
                priceFeedMessages[swapWith],
                priceFeedMessages[i]
            );
            (priceIds[i], priceIds[swapWith]) = (
                priceIds[swapWith],
                priceIds[i]
            );
        }

        // Select only first numSelectedPriceFeeds. numSelectedPriceFeeds will be in [0, numPriceFeeds]
        uint numSelectedPriceFeeds = getRandUint() % (numPriceFeeds + 1);

        PriceFeedMessage[]
            memory selectedPriceFeedsMessages = new PriceFeedMessage[](
                numSelectedPriceFeeds
            );
        bytes32[] memory selectedPriceIds = new bytes32[](
            numSelectedPriceFeeds
        );

        for (uint i = 0; i < numSelectedPriceFeeds; i++) {
            selectedPriceFeedsMessages[i] = priceFeedMessages[i];
            selectedPriceIds[i] = priceIds[i];
        }

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, selectedPriceIds, 0, MAX_UINT64);
        for (uint i = 0; i < numSelectedPriceFeeds; i++) {
            assertParsedPriceFeedEqualsMessage(
                priceFeeds[i],
                selectedPriceFeedsMessages[i],
                selectedPriceIds[i]
            );
        }
    }

    function testParsePriceFeedWithWormholeMerkleRevertsIfPriceIdNotIncluded()
        public
    {
        PriceFeedMessage[] memory priceFeedMessages = new PriceFeedMessage[](1);
        priceFeedMessages[0] = PriceFeedMessage({
            priceId: bytes32(uint(1)),
            price: getRandInt64(),
            conf: getRandUint64(),
            expo: getRandInt32(),
            publishTime: getRandUint64(),
            prevPublishTime: getRandUint64(),
            emaPrice: getRandInt64(),
            emaConf: getRandUint64()
        });

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = bytes32(uint(2));

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            MAX_UINT64
        );
    }

    function testParsePriceFeedUpdateRevertsIfPricesOutOfTimeRange() public {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceFeedMessages[i].publishTime = uint64(
                100 + (getRandUint() % 101)
            ); // All between [100, 200]
        }

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);

        bytes32[] memory priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }

        // Request for parse within the given time range should work
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            100,
            200
        );

        // Request for parse after the time range should revert.
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            300,
            MAX_UINT64
        );

        // Request for parse before the time range should revert.
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds,
            0,
            99
        );
    }

    function testGetUpdateFeeWorksForWhMerkle() public {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        (bytes[] memory updateData, ) = createWormholeMerkleUpdateData(
            priceFeedMessages
        );

        uint updateFee = pyth.getUpdateFee(updateData);
        assertEq(updateFee, SINGLE_UPDATE_FEE_IN_WEI * numPriceFeeds);
    }

    function testGetUpdateFeeWorksForWhMerkleBasedOnNumUpdates() public {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        // Set the priceId of the second message to be the same as the first.
        priceFeedMessages[1].priceId = priceFeedMessages[0].priceId;
        (bytes[] memory updateData, ) = createWormholeMerkleUpdateData(
            priceFeedMessages
        );

        uint updateFee = pyth.getUpdateFee(updateData);
        // updateFee should still be based on numUpdates not distinct number of priceIds
        assertEq(updateFee, SINGLE_UPDATE_FEE_IN_WEI * numPriceFeeds);
    }

    function testParsePriceFeedUpdatesWithWhMerkleUpdateWorksForForwardCompatibility()
        public
    {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createWormholeMerkleUpdateData(priceFeedMessages);

        bytes32[] memory priceIds = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds[i] = priceFeedMessages[i].priceId;
        }
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds, 0, MAX_UINT64);
        uint8 futureMinorVersion = uint8(2);
        uint8 futureTrailingHeaderSize = uint8(20);
        (
            bytes[] memory updateDataFromFuture,
            uint updateFeeFromFuture
        ) = createFowardCompatibleWormholeMerkleUpdateData(
                priceFeedMessages,
                futureMinorVersion,
                futureTrailingHeaderSize
            );

        PythStructs.PriceFeed[] memory priceFeedsFromFutureUpdateData = pyth
            .parsePriceFeedUpdates{value: updateFeeFromFuture}(
            updateDataFromFuture,
            priceIds,
            0,
            MAX_UINT64
        );
        assertEq(updateFee, updateFeeFromFuture);

        for (uint i = 0; i < priceFeeds.length; i++) {
            assertPriceFeedEqual(
                priceFeeds[i],
                priceFeedsFromFutureUpdateData[i]
            );
        }
    }

    function testUpdatePriceFeedUpdatesWithWhMerkleUpdateWorksForForwardCompatibility()
        public
    {
        uint numPriceFeeds = (getRandUint() % 10) + 1;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );
        uint8 futureMinorVersion = uint8(2);
        uint8 futureTrailingHeaderSize = uint8(20);
        (
            bytes[] memory forwardCompatibleUpdateData,
            uint updateFee
        ) = createFowardCompatibleWormholeMerkleUpdateData(
                priceFeedMessages,
                futureMinorVersion,
                futureTrailingHeaderSize
            );

        pyth.updatePriceFeeds{value: updateFee}(forwardCompatibleUpdateData);

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            assertPriceFeedMessageStored(priceFeedMessages[i]);
        }
    }
}
