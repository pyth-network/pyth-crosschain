// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {PythLazerPackedEvmLib} from "../src/PythLazerPackedEvmLib.sol";

/// Decodes lanes, words and payloads, and reports the gas each one costs
/// inside the call.
contract PackedEvmGasHarness {
    /// Decodes every field of one lane.
    function decodeLane(uint48 lane) external view returns (uint256 gasUsed) {
        uint256 start = gasleft();
        (uint32 mantissa, int16 exponent) = PythLazerPackedEvmLib.getPrice(lane);
        uint16 confidence = PythLazerPackedEvmLib.getConfidence(lane);
        uint16 spread = PythLazerPackedEvmLib.getSpread(lane);
        gasUsed = start - gasleft();
        require(mantissa + uint32(uint16(exponent)) + confidence + spread != 0);
    }

    /// Decodes every field of the four lanes of one word, and its timestamp.
    function decodeWord(bytes32 word) external view returns (uint256 gasUsed) {
        uint256 start = gasleft();
        uint256 sum = PythLazerPackedEvmLib.getWordTimestamp(word);
        for (uint256 slot = 0; slot < 4; ++slot) {
            uint48 lane = PythLazerPackedEvmLib.getWordLane(word, slot);
            if (PythLazerPackedEvmLib.hasPrice(lane)) {
                (uint32 mantissa,) = PythLazerPackedEvmLib.getPrice(lane);
                sum += mantissa;
            }
            if (PythLazerPackedEvmLib.hasConfidence(lane)) {
                sum += PythLazerPackedEvmLib.getConfidence(lane);
            }
            if (PythLazerPackedEvmLib.hasSpread(lane)) {
                sum += PythLazerPackedEvmLib.getSpread(lane);
            }
        }
        gasUsed = start - gasleft();
        require(sum != 0);
    }

    /// Reads the header, then every feed id and every field of every lane.
    function decodePayload(bytes calldata payload) external view returns (uint256 gasUsed) {
        uint256 start = gasleft();
        (, uint8 numFeeds) = PythLazerPackedEvmLib.parseHeader(payload);
        uint256 sum = PythLazerPackedEvmLib.getTimestamp(payload);
        for (uint256 i = 0; i < numFeeds; ++i) {
            sum += PythLazerPackedEvmLib.getFeedId(payload, i);
            uint48 lane = PythLazerPackedEvmLib.getLane(payload, i);
            if (PythLazerPackedEvmLib.hasPrice(lane)) {
                (uint32 mantissa,) = PythLazerPackedEvmLib.getPrice(lane);
                sum += mantissa;
            }
            if (PythLazerPackedEvmLib.hasConfidence(lane)) {
                sum += PythLazerPackedEvmLib.getConfidence(lane);
            }
            if (PythLazerPackedEvmLib.hasSpread(lane)) {
                sum += PythLazerPackedEvmLib.getSpread(lane);
            }
        }
        gasUsed = start - gasleft();
        require(sum != 0);
    }

    /// Finds the last feed of the payload.
    function findLastFeed(bytes calldata payload, uint32 feedId) external view returns (uint256 gasUsed) {
        uint256 start = gasleft();
        (bool found,) = PythLazerPackedEvmLib.findFeed(payload, feedId);
        gasUsed = start - gasleft();
        require(found);
    }
}

/// `forge snapshot --match-contract PythLazerPackedEvmGasTest` records these.
contract PythLazerPackedEvmGasTest is Test {
    PackedEvmGasHarness harness;

    bytes constant GOLDEN_FIVE_FEEDS =
        hex"5045564d0105000000010000000200000003000000041c00639b1a2f10002710364fffffffffffff1c00639b1a2f064b0615d1774000"
        hex"0000000500000000000000000000000010002710364f000000000000000000000000000000000000064b0615d1774000";

    function setUp() public {
        harness = new PackedEvmGasHarness();
    }

    function test_gas_decode_one_lane() public view {
        console.log("decode one lane:", harness.decodeLane(0x1c00639b1a2f));
    }

    function test_gas_decode_one_word() public view {
        console.log(
            "decode one word:",
            harness.decodeWord(hex"1c00639b1a2f10002710364fffffffffffff1c00639b1a2f064b0615d1774000")
        );
    }

    function test_gas_decode_five_feed_payload() public view {
        console.log("decode five-feed payload:", harness.decodePayload(GOLDEN_FIVE_FEEDS));
    }

    function test_gas_find_fifth_feed() public view {
        console.log("find feed 5 of 5:", harness.findLastFeed(GOLDEN_FIVE_FEEDS, 5));
    }
}
