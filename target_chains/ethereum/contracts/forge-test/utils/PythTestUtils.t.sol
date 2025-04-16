// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../../contracts/pyth/PythUpgradable.sol";
import "../../contracts/pyth/PythInternalStructs.sol";
import "../../contracts/pyth/PythAccumulator.sol";

import "../../contracts/libraries/MerkleTree.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/IPythEvents.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythUtils.sol";

import "forge-std/Test.sol";
import "./WormholeTestUtils.t.sol";
import "./RandTestUtils.t.sol";

abstract contract PythTestUtils is Test, WormholeTestUtils, RandTestUtils {
    uint16 constant SOURCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant SOURCE_EMITTER_ADDRESS =
        0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b;

    uint16 constant GOVERNANCE_EMITTER_CHAIN_ID = 0x1;
    bytes32 constant GOVERNANCE_EMITTER_ADDRESS =
        0x0000000000000000000000000000000000000000000000000000000000000011;
    uint constant SINGLE_UPDATE_FEE_IN_WEI = 1;

    function setUpPyth(address wormhole) public returns (address) {
        PythUpgradable implementation = new PythUpgradable();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            new bytes(0)
        );
        PythUpgradable pyth = PythUpgradable(address(proxy));

        uint16[] memory emitterChainIds = new uint16[](1);
        emitterChainIds[0] = SOURCE_EMITTER_CHAIN_ID;

        bytes32[] memory emitterAddresses = new bytes32[](1);
        emitterAddresses[0] = SOURCE_EMITTER_ADDRESS;

        pyth.initialize(
            wormhole,
            emitterChainIds,
            emitterAddresses,
            GOVERNANCE_EMITTER_CHAIN_ID,
            GOVERNANCE_EMITTER_ADDRESS,
            0, // Initial governance sequence
            60, // Valid time period in seconds
            SINGLE_UPDATE_FEE_IN_WEI // single update fee in wei
        );

        return address(pyth);
    }

    function singleUpdateFeeInWei() public pure returns (uint) {
        return SINGLE_UPDATE_FEE_IN_WEI;
    }

    /// Utilities to help generating price feed messages and VAAs for them

    struct PriceFeedMessage {
        bytes32 priceId;
        int64 price;
        uint64 conf;
        int32 expo;
        uint64 publishTime;
        uint64 prevPublishTime;
        int64 emaPrice;
        uint64 emaConf;
    }

    struct TwapPriceFeedMessage {
        bytes32 priceId;
        int128 cumulativePrice;
        uint128 cumulativeConf;
        uint64 numDownSlots;
        uint64 publishSlot;
        uint64 publishTime;
        uint64 prevPublishTime;
        int32 expo;
    }

    struct MerkleUpdateConfig {
        uint8 depth;
        uint8 numSigners;
        uint16 source_chain_id;
        bytes32 source_emitter_address;
        bool brokenVaa;
    }

    function encodePriceFeedMessages(
        PriceFeedMessage[] memory priceFeedMessages
    ) internal pure returns (bytes[] memory encodedPriceFeedMessages) {
        encodedPriceFeedMessages = new bytes[](priceFeedMessages.length);

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            encodedPriceFeedMessages[i] = abi.encodePacked(
                uint8(PythAccumulator.MessageType.PriceFeed),
                priceFeedMessages[i].priceId,
                priceFeedMessages[i].price,
                priceFeedMessages[i].conf,
                priceFeedMessages[i].expo,
                priceFeedMessages[i].publishTime,
                priceFeedMessages[i].prevPublishTime,
                priceFeedMessages[i].emaPrice,
                priceFeedMessages[i].emaConf
            );
        }
    }

    function encodeTwapPriceFeedMessages(
        TwapPriceFeedMessage[] memory twapPriceFeedMessages
    ) internal pure returns (bytes[] memory encodedTwapPriceFeedMessages) {
        encodedTwapPriceFeedMessages = new bytes[](
            twapPriceFeedMessages.length
        );

        for (uint i = 0; i < twapPriceFeedMessages.length; i++) {
            encodedTwapPriceFeedMessages[i] = abi.encodePacked(
                uint8(PythAccumulator.MessageType.TwapPriceFeed),
                twapPriceFeedMessages[i].priceId,
                twapPriceFeedMessages[i].cumulativePrice,
                twapPriceFeedMessages[i].cumulativeConf,
                twapPriceFeedMessages[i].numDownSlots,
                twapPriceFeedMessages[i].publishSlot,
                twapPriceFeedMessages[i].publishTime,
                twapPriceFeedMessages[i].prevPublishTime,
                twapPriceFeedMessages[i].expo
            );
        }
    }

    function generateWhMerkleUpdateWithSource(
        PriceFeedMessage[] memory priceFeedMessages,
        MerkleUpdateConfig memory config
    ) internal returns (bytes memory whMerkleUpdateData) {
        bytes[] memory encodedPriceFeedMessages = encodePriceFeedMessages(
            priceFeedMessages
        );

        (bytes20 rootDigest, bytes[] memory proofs) = MerkleTree
            .constructProofs(encodedPriceFeedMessages, config.depth);

        bytes memory wormholePayload = abi.encodePacked(
            uint32(0x41555756), // PythAccumulator.ACCUMULATOR_WORMHOLE_MAGIC
            uint8(PythAccumulator.UpdateType.WormholeMerkle),
            uint64(1), // Slot, not used in target networks
            uint32(0), // Ring size, not used in target networks
            rootDigest
        );

        bytes memory wormholeMerkleVaa = generateVaa(
            0,
            config.source_chain_id,
            config.source_emitter_address,
            0,
            wormholePayload,
            config.numSigners
        );

        if (config.brokenVaa) {
            uint mutPos = getRandUint() % wormholeMerkleVaa.length;

            // mutate the random position by 1 bit
            wormholeMerkleVaa[mutPos] = bytes1(
                uint8(wormholeMerkleVaa[mutPos]) ^ 1
            );
        }

        whMerkleUpdateData = abi.encodePacked(
            uint32(0x504e4155), // PythAccumulator.ACCUMULATOR_MAGIC
            uint8(1), // major version
            uint8(0), // minor version
            uint8(0), // trailing header size
            uint8(PythAccumulator.UpdateType.WormholeMerkle),
            uint16(wormholeMerkleVaa.length),
            wormholeMerkleVaa,
            uint8(priceFeedMessages.length)
        );

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            whMerkleUpdateData = abi.encodePacked(
                whMerkleUpdateData,
                uint16(encodedPriceFeedMessages[i].length),
                encodedPriceFeedMessages[i],
                proofs[i]
            );
        }
    }

    function generateWhMerkleTwapUpdateWithSource(
        TwapPriceFeedMessage[] memory twapPriceFeedMessages,
        MerkleUpdateConfig memory config
    ) internal returns (bytes memory whMerkleTwapUpdateData) {
        bytes[]
            memory encodedTwapPriceFeedMessages = encodeTwapPriceFeedMessages(
                twapPriceFeedMessages
            );

        (bytes20 rootDigest, bytes[] memory proofs) = MerkleTree
            .constructProofs(encodedTwapPriceFeedMessages, config.depth);

        bytes memory wormholePayload = abi.encodePacked(
            uint32(0x41555756), // PythAccumulator.ACCUMULATOR_WORMHOLE_MAGIC
            uint8(PythAccumulator.UpdateType.WormholeMerkle),
            uint64(0), // Slot, not used in target networks
            uint32(0), // Ring size, not used in target networks
            rootDigest
        );

        bytes memory wormholeMerkleVaa = generateVaa(
            0,
            config.source_chain_id,
            config.source_emitter_address,
            0,
            wormholePayload,
            config.numSigners
        );

        if (config.brokenVaa) {
            uint mutPos = getRandUint() % wormholeMerkleVaa.length;

            // mutate the random position by 1 bit
            wormholeMerkleVaa[mutPos] = bytes1(
                uint8(wormholeMerkleVaa[mutPos]) ^ 1
            );
        }

        whMerkleTwapUpdateData = abi.encodePacked(
            uint32(0x504e4155), // PythAccumulator.ACCUMULATOR_MAGIC
            uint8(1), // major version
            uint8(0), // minor version
            uint8(0), // trailing header size
            uint8(PythAccumulator.UpdateType.WormholeMerkle),
            uint16(wormholeMerkleVaa.length),
            wormholeMerkleVaa,
            uint8(twapPriceFeedMessages.length)
        );

        for (uint i = 0; i < twapPriceFeedMessages.length; i++) {
            whMerkleTwapUpdateData = abi.encodePacked(
                whMerkleTwapUpdateData,
                uint16(encodedTwapPriceFeedMessages[i].length),
                encodedTwapPriceFeedMessages[i],
                proofs[i]
            );
        }
    }

    function generateWhMerkleUpdate(
        PriceFeedMessage[] memory priceFeedMessages,
        uint8 depth,
        uint8 numSigners
    ) internal returns (bytes memory whMerkleUpdateData) {
        whMerkleUpdateData = generateWhMerkleUpdateWithSource(
            priceFeedMessages,
            MerkleUpdateConfig(
                depth,
                numSigners,
                SOURCE_EMITTER_CHAIN_ID,
                SOURCE_EMITTER_ADDRESS,
                false
            )
        );
    }

    function generateForwardCompatibleWhMerkleUpdate(
        PriceFeedMessage[] memory priceFeedMessages,
        uint8 depth,
        uint8 numSigners,
        uint8 minorVersion,
        bytes memory trailingHeaderData
    ) internal view returns (bytes memory whMerkleUpdateData) {
        bytes[] memory encodedPriceFeedMessages = encodePriceFeedMessages(
            priceFeedMessages
        );

        (bytes20 rootDigest, bytes[] memory proofs) = MerkleTree
            .constructProofs(encodedPriceFeedMessages, depth);
        // refactoring some of these generateWormhole functions was necessary
        // to workaround the stack too deep limit.
        bytes
            memory wormholeMerkleVaa = generateForwardCompatibleWormholeMerkleVaa(
                rootDigest,
                trailingHeaderData,
                numSigners
            );
        {
            whMerkleUpdateData = abi.encodePacked(
                generateForwardCompatibleWormholeMerkleUpdateHeader(
                    minorVersion,
                    trailingHeaderData
                ),
                uint16(wormholeMerkleVaa.length),
                wormholeMerkleVaa,
                uint8(priceFeedMessages.length)
            );
        }

        for (uint i = 0; i < priceFeedMessages.length; i++) {
            whMerkleUpdateData = abi.encodePacked(
                whMerkleUpdateData,
                uint16(encodedPriceFeedMessages[i].length),
                encodedPriceFeedMessages[i],
                proofs[i]
            );
        }
    }

    function generateForwardCompatibleWormholeMerkleUpdateHeader(
        uint8 minorVersion,
        bytes memory trailingHeaderData
    ) private pure returns (bytes memory whMerkleUpdateHeader) {
        whMerkleUpdateHeader = abi.encodePacked(
            uint32(0x504e4155), // PythAccumulator.ACCUMULATOR_MAGIC
            uint8(1), // major version
            minorVersion,
            uint8(trailingHeaderData.length), // trailing header size
            trailingHeaderData,
            uint8(PythAccumulator.UpdateType.WormholeMerkle)
        );
    }

    function generateForwardCompatibleWormholeMerkleVaa(
        bytes20 rootDigest,
        bytes memory futureData,
        uint8 numSigners
    ) internal view returns (bytes memory wormholeMerkleVaa) {
        wormholeMerkleVaa = generateVaa(
            0,
            SOURCE_EMITTER_CHAIN_ID,
            SOURCE_EMITTER_ADDRESS,
            0,
            abi.encodePacked(
                uint32(0x41555756), // PythAccumulator.ACCUMULATOR_WORMHOLE_MAGIC
                uint8(PythAccumulator.UpdateType.WormholeMerkle),
                uint64(0), // Slot, not used in target networks
                uint32(0), // Ring size, not used in target networks
                rootDigest, // this can have bytes past this for future versions
                futureData
            ),
            numSigners
        );
    }

    function pricesToPriceFeedMessages(
        bytes32[] memory priceIds,
        PythStructs.Price[] memory prices
    ) public returns (PriceFeedMessage[] memory priceFeedMessages) {
        assertGe(priceIds.length, prices.length);
        priceFeedMessages = new PriceFeedMessage[](prices.length);

        for (uint i = 0; i < prices.length; ++i) {
            priceFeedMessages[i].priceId = priceIds[i];
            priceFeedMessages[i].price = prices[i].price;
            priceFeedMessages[i].conf = prices[i].conf;
            priceFeedMessages[i].expo = prices[i].expo;
            priceFeedMessages[i].publishTime = uint64(prices[i].publishTime);
            priceFeedMessages[i].prevPublishTime =
                uint64(prices[i].publishTime) -
                1;
            priceFeedMessages[i].emaPrice = prices[i].price;
            priceFeedMessages[i].emaConf = prices[i].conf;
        }
    }
}

contract PythUtilsTest is Test, WormholeTestUtils, PythTestUtils, IPythEvents {
    function testConvertToUnit() public {
        // Price can't be negative
        vm.expectRevert();
        PythUtils.convertToUint(-100, -5, 18);

        // Exponent can't be positive
        vm.expectRevert();
        PythUtils.convertToUint(100, 5, 18);

        // Price with 18 decimals and exponent -5
        assertEq(
            PythUtils.convertToUint(100, -5, 18),
            1000000000000000 // 100 * 10^13
        );

        // Price with 9 decimals and exponent -2
        assertEq(
            PythUtils.convertToUint(100, -2, 9),
            1000000000 // 100 * 10^7
        );

        // Price with 4 decimals and exponent -5
        assertEq(PythUtils.convertToUint(100, -5, 4), 10);

        // Price with 5 decimals and exponent -2
        // @note: We will lose precision here as price is
        // 0.00001 and we are targetDecimals is 2.
        assertEq(PythUtils.convertToUint(100, -5, 2), 0);
    }
}
