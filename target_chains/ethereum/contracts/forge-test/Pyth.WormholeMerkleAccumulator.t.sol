// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

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
    PythTestUtils,
    RandTestUtils
{
    IPyth public pyth;

    // -1 is equal to 0xffffff which is the biggest uint if converted back
    uint64 constant MAX_UINT64 = uint64(int64(-1));

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormhole(1)));
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

    function assertParsedPriceFeed(
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

        pyth.updatePriceFeeds{value: updateFee}(updateData);

        assertPriceFeedMessageStored(priceFeedMessages1[1]);
        assertPriceFeedMessageStored(priceFeedMessages2[0]);
        assertPriceFeedMessageStored(priceFeedMessages2[1]);

        bytes32[] memory priceIds1 = new bytes32[](1);
        priceIds1[0] = priceFeedMessages1[1].priceId;
        bytes[] memory parseUpdateDataInput1 = new bytes[](1);
        parseUpdateDataInput1[0] = updateData[0];

        PythStructs.PriceFeed[] memory priceFeeds1 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(parseUpdateDataInput1, priceIds1, 0, MAX_UINT64);

        for (uint i = 0; i < priceFeeds1.length; i++) {
            assertParsedPriceFeedStored(priceFeeds1[i]);
        }

        bytes32[] memory priceIds2 = new bytes32[](2);
        priceIds2[0] = priceFeedMessages2[0].priceId;
        priceIds2[1] = priceFeedMessages2[1].priceId;
        bytes[] memory parseUpdateDataInput2 = new bytes[](1);
        parseUpdateDataInput2[0] = updateData[1];

        PythStructs.PriceFeed[] memory priceFeeds2 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(parseUpdateDataInput2, priceIds2, 0, MAX_UINT64);
        for (uint i = 0; i < priceFeeds2.length; i++) {
            assertParsedPriceFeedStored(priceFeeds2[i]);
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

        bytes32[] memory priceIds2 = new bytes32[](1);
        priceIds2[0] = priceFeedMessages1[0].priceId;

        PythStructs.PriceFeed[] memory priceFeeds2 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds2, 0, MAX_UINT64);
        assertParsedPriceFeedStored(priceFeeds2[0]);
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
        assertPriceFeedMessageStored(priceFeedMessages1[0]);

        bytes[] memory updateData1 = updateData;

        (updateData, updateFee) = createWormholeMerkleUpdateData(
            priceFeedMessages2
        );
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        // Make sure that the old value is still stored
        assertPriceFeedMessageStored(priceFeedMessages1[0]);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceFeedMessages1[0].priceId;

        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData1, priceIds, 0, MAX_UINT64);
        assertParsedPriceFeedStored(priceFeeds[0]);
    }

    function isNotMatch(
        bytes memory a,
        bytes memory b
    ) public pure returns (bool) {
        return keccak256(a) != keccak256(b);
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

        updateFee = pyth.getUpdateFee(updateData);
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
        bytes32[] memory priceIds2 = new bytes32[](numPriceFeeds);
        for (uint i = 0; i < numPriceFeeds; i++) {
            priceIds2[i] = priceFeedMessages[i].priceId;
        }
        PythStructs.PriceFeed[] memory priceFeeds2 = pyth.parsePriceFeedUpdates{
            value: updateFee
        }(updateData, priceIds2, 0, MAX_UINT64);

        for (uint i = 0; i < priceFeeds2.length; i++) {
            assertParsedPriceFeed(
                priceFeeds2[i],
                priceFeedMessages[i],
                priceIds2[i]
            );
        }

        // update priceFeedMessages
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

        // reparse
        priceFeeds2 = pyth.parsePriceFeedUpdates{value: updateFee}(
            updateData,
            priceIds2,
            0,
            MAX_UINT64
        );

        for (uint i = 0; i < priceFeeds2.length; i++) {
            assertParsedPriceFeed(
                priceFeeds2[i],
                priceFeedMessages[i],
                priceIds2[i]
            );
        }
    }
}
