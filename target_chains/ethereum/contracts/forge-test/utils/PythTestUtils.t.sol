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
    function assertCrossRateEquals(
        int64 price1,
        int32 expo1,
        int64 price2,
        int32 expo2,
        int32 targetExpo,
        uint256 expectedPrice
    ) internal {
        uint256 price = PythUtils.deriveCrossRate(
            price1,
            expo1,
            price2,
            expo2,
            targetExpo
        );
        assertEq(price, expectedPrice);
    }

    function assertCrossRateReverts(
        int64 price1,
        int32 expo1,
        int64 price2,
        int32 expo2,
        int32 targetExpo,
        bytes4 expectedError
    ) internal {
        vm.expectRevert(expectedError);
        PythUtils.deriveCrossRate(price1, expo1, price2, expo2, targetExpo);
    }

    function testConvertToUnit() public {
        // Test 1: Price can't be negative
        vm.expectRevert(PythErrors.NegativeInputPrice.selector);
        PythUtils.convertToUint(-100, -5, 18);

        // Test 2: Exponent can't be less than -255
        vm.expectRevert(PythErrors.InvalidInputExpo.selector);
        PythUtils.convertToUint(100, -256, 18);

        // Test 3: This test will fail as the 10 ** 237 is too large for a uint256
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(100, -255, 18), 0);

        // Test 4: Combined Exponent can't be greater than 58 and less than -58
        // See the calculation how we came up with 58 in PythUtils.sol
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(100, 50, 9), 0); // 50 + 9 = 59 > 58
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(100, -96, 37), 0); // -96 + 37 = -59 < -58

        // Test 5: Negative Exponent Tests
        // Price with 18 decimals and exponent -5
        assertEq(
            PythUtils.convertToUint(100, -5, 18),
            100_0_000_000_000_000 // 100 * 10^13
        );
        // Price with 9 decimals and exponent -2
        assertEq(
            PythUtils.convertToUint(100, -2, 9),
            100_0_000_000 // 100 * 10^7
        );

        // Test 6: Price with 4 decimals and exponent -5
        assertEq(PythUtils.convertToUint(100, -5, 4), 10);

        // Test 7: Price with 5 decimals and exponent -2
        // @note: We will lose precision here as price is
        // 0.00001 and we are targetDecimals is 2.
        assertEq(PythUtils.convertToUint(100, -5, 2), 0);
        assertEq(PythUtils.convertToUint(123, -8, 5), 0);

        // Test 8: Positive Exponent Tests
        // Price with 18 decimals and exponent 5
        assertEq(
            PythUtils.convertToUint(100, 5, 18),
            100_00_000_000_000_000_000_000_000
        ); // 100 with 23 zeros
        // Test 9: Price with 9 decimals and exponent 2
        assertEq(PythUtils.convertToUint(100, 2, 9), 100_00_000_000_000); // 100 with 11 zeros

        // Test 10: Price with 2 decimals and exponent 1
        assertEq(PythUtils.convertToUint(100, 1, 2), 100_000); // 100 with 3 zeros

        // Special Cases
        // Test 11: price = 0, any expo/decimals returns 0
        assertEq(PythUtils.convertToUint(0, -58, 0), 0);
        assertEq(PythUtils.convertToUint(0, 0, 0), 0);
        assertEq(PythUtils.convertToUint(0, 58, 0), 0);
        assertEq(PythUtils.convertToUint(0, -58, 58), 0);

        // Test 12: smallest positive price, maximum downward exponent (should round to zero)
        assertEq(PythUtils.convertToUint(1, -58, 0), 0);
        assertEq(PythUtils.convertToUint(1, -58, 58), 1);

        // Test 13: deltaExponent == 0 (should be identical to price)
        assertEq(PythUtils.convertToUint(123456, 0, 0), 123456);
        assertEq(PythUtils.convertToUint(123456, -5, 5), 123456); // -5 + 5 == 0

        // Test 14: deltaExponent > 0 (should shift price up)
        assertEq(PythUtils.convertToUint(123456, 5, 0), 12345600000);
        assertEq(PythUtils.convertToUint(123456, 5, 2), 1234560000000);

        // Test 15: deltaExponent < 0 (should shift price down)
        assertEq(PythUtils.convertToUint(123456, -5, 0), 1);
        assertEq(PythUtils.convertToUint(123456, -5, 2), 123);

        // Test 16: division with truncation
        assertEq(PythUtils.convertToUint(999, -2, 0), 9); // 999/100 = 9 (truncated)
        assertEq(PythUtils.convertToUint(199, -2, 0), 1); // 199/100 = 1 (truncated)
        assertEq(PythUtils.convertToUint(99, -2, 0), 0); // 99/100 = 0 (truncated)

        // Test 17: Big price and scaling, but outside of bounds
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(100_000_000, 10, 50), 0);

        // Test 18: Big price and scaling
        assertEq(PythUtils.convertToUint(100_000_000, -50, 10), 0); // -50 + 10 = -40 > -58
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(100_000_000, 10, 50), 0); // 10 + 50 = 60 > 58

        // Test 19: Decimals just save from truncation
        assertEq(PythUtils.convertToUint(5, -1, 1), 5); // 5/10*10 = 5
        assertEq(PythUtils.convertToUint(5, -1, 2), 50); // 5/10*100 = 50

        // 10. Test: Big price and scaling, should be inside the bounds
        // We have to convert int64 -> int256 -> uint256 before multiplying by 10 ** 58
        assertEq(
            PythUtils.convertToUint(type(int64).max, 50, 8),
            uint256(int256(type(int64).max)) * 10 ** 58
        ); // 50 + 8 = 58
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(type(int64).max, 50, 9), 0);
        assertEq(PythUtils.convertToUint(type(int64).max, -64, 8), 0); // -64 + 8 = -56 > -58
        assertEq(PythUtils.convertToUint(type(int64).max, -50, 1), 0); // -50 + 1 = -49 > -58

        // 11. Test: Big price and scaling, should be inside the bounds
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(type(int64).max, 50, 9), 0); // 50 + 9 = 59 > 58
        vm.expectRevert(PythErrors.ExponentOverflow.selector);
        assertEq(PythUtils.convertToUint(type(int64).max, -60, 1), 0); // -60 + 1 = -59 < -58
    }

    function testDeriveCrossRate() public {
        // Test 1: Prices can't be negative
        assertCrossRateReverts(
            -100,
            -2,
            100,
            -2,
            5,
            PythErrors.NegativeInputPrice.selector
        );
        assertCrossRateReverts(
            100,
            -2,
            -100,
            -2,
            5,
            PythErrors.NegativeInputPrice.selector
        );
        assertCrossRateReverts(
            -100,
            -2,
            -100,
            -2,
            5,
            PythErrors.NegativeInputPrice.selector
        );

        // Test 2: Exponent can't be less than -255
        assertCrossRateReverts(
            100,
            -256,
            100,
            -2,
            5,
            PythErrors.InvalidInputExpo.selector
        );
        assertCrossRateReverts(
            100,
            -2,
            100,
            -256,
            5,
            PythErrors.InvalidInputExpo.selector
        );
        assertCrossRateReverts(
            100,
            -256,
            100,
            -256,
            5,
            PythErrors.InvalidInputExpo.selector
        );
        // Target exponent can't be less than -255
        assertCrossRateReverts(
            100,
            -2,
            100,
            -2,
            -256,
            PythErrors.InvalidInputExpo.selector
        );

        // Test 3: Basic Tests with negative exponents
        assertCrossRateEquals(500, -8, 500, -8, -5, 100000);
        assertCrossRateEquals(10_000, -8, 100, -2, -5, 10);
        assertCrossRateEquals(10_000, -2, 100, -8, -5, 100_00_000_000_000);

        // Test 4: Basic Tests with positive exponents
        assertCrossRateEquals(100, 2, 100, 2, -5, 100000); // 100 * 10^2 / 100 * 10^2 = 10000 / 10000 = 1 == 100000 * 10^-5
        // We will loose preistion as the the target exponent is 5 making the price 0.00001
        assertCrossRateEquals(100, 8, 100, 8, 5, 0);

        // Test 5: Different Exponent Tests
        assertCrossRateEquals(10_000, -2, 100, -4, 0, 10_000); // 10_000 / 100 = 100 * 10(-2 - -4) = 10_000 with 0 decimals = 10_000
        assertCrossRateEquals(10_000, -2, 100, -4, 5, 0); // 10_000 / 100 = 100 * 10(-2 - -4) = 10_000 with 5 decimals = 0
        assertCrossRateEquals(10_000, -2, 10_000, -1, 5, 0); // It will truncate to 0
        assertCrossRateEquals(10_000, -10, 10_000, -2, 0, 0); // It will truncate to 0
        assertCrossRateEquals(
            100_000_000,
            -2,
            100,
            -8,
            -8,
            100_000_000_000_000_000_000
        ); // 100_000_000 / 100 = 1_000_000 * 10(-2 - -8) = 1000000 * 10^6 = 1000000000000

        // Test 6: Exponent Edge Tests
        assertCrossRateEquals(10_000, 0, 100, 0, 0, 100);
        assertCrossRateReverts(
            10_000,
            0,
            100,
            0,
            -255,
            PythErrors.ExponentOverflow.selector
        );
        assertCrossRateReverts(
            10_000,
            0,
            100,
            -255,
            -255,
            PythErrors.ExponentOverflow.selector
        );
        assertCrossRateReverts(
            10_000,
            -255,
            100,
            0,
            0,
            PythErrors.ExponentOverflow.selector
        );
        assertCrossRateReverts(
            10_000,
            -255,
            100,
            -178,
            -5,
            PythErrors.ExponentOverflow.selector
        );

        // Test 7: Max int64 price and scaling
        assertCrossRateEquals(
            type(int64).max,
            0,
            1,
            0,
            0,
            uint256(int256(type(int64).max))
        );
        assertCrossRateEquals(1, 0, type(int64).max, 0, 0, 0);
        assertCrossRateEquals(type(int64).max, 0, type(int64).max, 0, 0, 1);
        // type(int64).max is approx 9.223e18
        assertCrossRateEquals(type(int64).max, 0, 1, 0, 18, 9);
        // 1 / type(int64).max is approx 1.085e-19
        assertCrossRateEquals(1, 0, type(int64).max, 0, -19, 1);
        // type(int64).max * 10 ** 58 / 1
        assertCrossRateEquals(
            type(int64).max,
            50,
            1,
            -8,
            0,
            uint256(int256(type(int64).max)) * 10 ** 58
        );
        // 1 / (type(int64).max * 10 ** 58)
        assertCrossRateEquals(1, 0, type(int64).max, 50, 8, 0);

        // type(int64).max * 10 ** 59 / 1
        assertCrossRateReverts(
            type(int64).max,
            50,
            1,
            -9,
            0,
            PythErrors.ExponentOverflow.selector
        );
        // 1 / (type(int64).max * 10 ** 59)
        assertCrossRateReverts(
            1,
            0,
            type(int64).max,
            50,
            9,
            PythErrors.ExponentOverflow.selector
        );

        // Realistic Tests
        // Test case 1:  (StEth/Eth / Eth/USD = ETH/BTC)
        uint256 price = PythUtils.deriveCrossRate(
            206487956502,
            -8,
            206741615681,
            -8,
            -8
        );
        assertApproxEqRel(price, 100000000, 9e17); // $1

        // Test case 2:
        price = PythUtils.deriveCrossRate(520010, -8, 38591, -8, -8);
        assertApproxEqRel(price, 1347490347, 9e17); // $13.47

        // Test case 3:
        price = PythUtils.deriveCrossRate(520010, -8, 38591, -8, -12);
        assertApproxEqRel(price, 13474903475432, 9e17); // $13.47
    }
}
