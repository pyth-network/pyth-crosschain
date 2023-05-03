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
    PythTestUtils,
    RandTestUtils
{
    IPyth public pyth;

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

        (updateData, updateFee) = createWormholeMerkleUpdateData(
            priceFeedMessages2
        );
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        // Make sure that the old value is still stored
        assertPriceFeedMessageStored(priceFeedMessages1[0]);
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
    ) public returns (bytes[] memory updateData, uint updateFee) {
        uint numPriceFeeds = 10;
        PriceFeedMessage[]
            memory priceFeedMessages = generateRandomPriceFeedMessage(
                numPriceFeeds
            );

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
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("whMagic");

        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAAPayloadUpdateType()
        public
    {
        // In this test the Wormhole accumulator magic is wrong and the update gets
        // reverted.

        (
            bytes[] memory updateData,
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("whUpdateType");
        vm.expectRevert(); // Reason: Conversion into non-existent enum type. However it
        // was not possible to check the revert reason in the test.
        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongVAASource()
        public
    {
        // In this test the Wormhole message source is wrong.
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("whSourceAddress");
        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
        (updateData, updateFee) = createAndForgeWormholeMerkleUpdateData(
            "whSourceChain"
        );
        vm.expectRevert(PythErrors.InvalidUpdateDataSource.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongRootDigest()
        public
    {
        // In this test the Wormhole merkle proof digest is wrong
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("rootDigest");
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongProofItem()
        public
    {
        // In this test all Wormhole merkle proof items are the first item proof
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("proofItem");
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
    }

    function testUpdatePriceFeedWithWormholeMerkleRevertsOnWrongHeader()
        public
    {
        // In this test the message headers are wrong
        (
            bytes[] memory updateData,
            uint updateFee
        ) = createAndForgeWormholeMerkleUpdateData("headerMagic");
        vm.expectRevert(); // The revert reason is not deterministic because when it doesn't match it goes through
        // the old approach.
        pyth.updatePriceFeeds{value: updateFee}(updateData);

        (updateData, updateFee) = createAndForgeWormholeMerkleUpdateData(
            "headerMajorVersion"
        );
        vm.expectRevert(PythErrors.InvalidUpdateData.selector);
        pyth.updatePriceFeeds{value: updateFee}(updateData);
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

        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.updatePriceFeeds{value: 0}(updateData);
    }
}
