// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {PackedEvmLib} from "../src/PackedEvmLib.sol";

/// @dev Calls the library through external functions, so reverts can be caught and calldata variants run.
contract PackedEvmLibHarness {
    function validate(bytes memory payload) external pure returns (uint8, uint8, uint64) {
        return PackedEvmLib.validate(payload);
    }

    function validateCalldata(bytes calldata payload) external pure returns (uint8, uint8, uint64) {
        return PackedEvmLib.validateCalldata(payload);
    }

    function getBlock(bytes memory payload, uint256 index) external pure returns (uint128, uint256, uint256) {
        return PackedEvmLib.getBlock(payload, index);
    }

    function getBlockCalldata(bytes calldata payload, uint256 index)
        external
        pure
        returns (uint128, uint256, uint256)
    {
        return PackedEvmLib.getBlockCalldata(payload, index);
    }
}

/// @notice Golden vectors from the reference serializer in pyth-lazer, `sdk/rust/protocol/src/payload/packed_evm`.
contract PackedEvmLibTest is Test {
    bytes constant GOLDEN_ONE_FEED =
        hex"5045564d0101000000010000000000000000000000001c00639b002b000000000000000000000000000000000000064b0615d1774000";
    bytes constant GOLDEN_FOUR_FEEDS =
        hex"5045564d02040000000a000000140000001e0000002810002710006410004e20003210007530002110009c400019064b0615d177401e";
    bytes constant GOLDEN_FIVE_FEEDS =
        hex"5045564d0105000000010000000200000003000000041c00639b002b1000271000641c00639b002b1c00639b002b064b0615d177400c00000005000000000000000000000000100027100064000000000000000000000000000000000000064b0615d1774000";

    uint64 constant TIMESTAMP_US = 1771339368200000;

    PackedEvmLibHarness harness;

    function setUp() public {
        harness = new PackedEvmLibHarness();
    }

    function _validateBoth(bytes memory payload) internal view returns (uint8 channel, uint8 numFeeds, uint64 ts) {
        (channel, numFeeds, ts) = harness.validate(payload);
        (uint8 c2, uint8 n2, uint64 t2) = harness.validateCalldata(payload);
        assertEq(c2, channel);
        assertEq(n2, numFeeds);
        assertEq(t2, ts);
    }

    function _getBlockBoth(bytes memory payload, uint256 index)
        internal
        view
        returns (uint128 ids, uint256 word, uint256 count)
    {
        (ids, word, count) = harness.getBlock(payload, index);
        (uint128 ids2, uint256 word2, uint256 count2) = harness.getBlockCalldata(payload, index);
        assertEq(ids2, ids);
        assertEq(word2, word);
        assertEq(count2, count);
    }

    function _expectRevertBoth(bytes memory payload, bytes4 selector) internal {
        vm.expectRevert(selector);
        harness.validate(payload);
        vm.expectRevert(selector);
        harness.validateCalldata(payload);
    }

    function test_goldenOneFeed() public view {
        (uint8 channel, uint8 numFeeds, uint64 ts) = _validateBoth(GOLDEN_ONE_FEED);
        assertEq(channel, 1);
        assertEq(numFeeds, 1);
        assertEq(ts, TIMESTAMP_US);
        assertEq(PackedEvmLib.numBlocks(numFeeds), 1);

        (uint128 ids, uint256 word, uint256 count) = _getBlockBoth(GOLDEN_ONE_FEED, 0);
        assertEq(count, 1);
        assertEq(PackedEvmLib.blockFeedId(ids, 0), 1);
        assertEq(PackedEvmLib.blockTimestampUs(word), TIMESTAMP_US);

        uint48 lane = PackedEvmLib.blockLane(word, 0);
        assertEq(lane, 0x1c00639b002b);
        assertTrue(PackedEvmLib.laneHasPrice(lane));
        assertEq(PackedEvmLib.laneNegExponent(lane), 3);
        assertEq(PackedEvmLib.laneMantissa(lane), 67134363);
        assertEq(PackedEvmLib.lanePrice(lane, 8), 6713436300000);
        assertEq(PackedEvmLib.lanePrice(lane, 3), 67134363);
        assertEq(PackedEvmLib.lanePrice(lane, 0), 67134);
        (bool available, uint16 conf) = PackedEvmLib.laneConfidence(lane);
        assertTrue(available);
        assertEq(conf, 43);
        assertEq(PackedEvmLib.blockStalenessMarker(word, 0), PackedEvmLib.MARKER_ZERO);
    }

    function test_goldenFourFeeds() public view {
        (uint8 channel, uint8 numFeeds, uint64 ts) = _validateBoth(GOLDEN_FOUR_FEEDS);
        assertEq(channel, 2);
        assertEq(numFeeds, 4);
        assertEq(ts, TIMESTAMP_US);

        (uint128 ids, uint256 word, uint256 count) = _getBlockBoth(GOLDEN_FOUR_FEEDS, 0);
        assertEq(count, 4);
        uint32[4] memory feedIds = [uint32(10), 20, 30, 40];
        uint32[4] memory mantissas = [uint32(10000), 20000, 30000, 40000];
        uint16[4] memory confs = [uint16(100), 50, 33, 25];
        uint8[4] memory markers = [
            PackedEvmLib.MARKER_ZERO,
            PackedEvmLib.MARKER_ONE_SECOND_OR_LESS,
            PackedEvmLib.MARKER_MORE_THAN_FIVE_SECONDS,
            PackedEvmLib.MARKER_FIVE_SECONDS_OR_LESS
        ];
        for (uint256 slot; slot < 4; ++slot) {
            assertEq(PackedEvmLib.blockFeedId(ids, slot), feedIds[slot]);
            uint48 lane = PackedEvmLib.blockLane(word, slot);
            assertEq(PackedEvmLib.laneNegExponent(lane), 2);
            assertEq(PackedEvmLib.laneMantissa(lane), mantissas[slot]);
            (bool available, uint16 conf) = PackedEvmLib.laneConfidence(lane);
            assertTrue(available);
            assertEq(conf, confs[slot]);
            assertEq(PackedEvmLib.blockStalenessMarker(word, slot), markers[slot]);
        }
    }

    function test_goldenFiveFeeds() public view {
        (, uint8 numFeeds, uint64 ts) = _validateBoth(GOLDEN_FIVE_FEEDS);
        assertEq(numFeeds, 5);
        assertEq(ts, TIMESTAMP_US);
        assertEq(PackedEvmLib.numBlocks(numFeeds), 2);

        (uint128 ids0, uint256 word0, uint256 count0) = _getBlockBoth(GOLDEN_FIVE_FEEDS, 0);
        assertEq(count0, 4);
        for (uint256 slot; slot < 4; ++slot) {
            assertEq(PackedEvmLib.blockFeedId(ids0, slot), slot + 1);
        }
        assertEq(PackedEvmLib.blockStalenessMarker(word0, 2), PackedEvmLib.MARKER_MORE_THAN_FIVE_SECONDS);
        assertEq(PackedEvmLib.blockLane(word0, 2), 0x1c00639b002b);

        (uint128 ids1, uint256 word1, uint256 count1) = _getBlockBoth(GOLDEN_FIVE_FEEDS, 1);
        assertEq(count1, 1);
        assertEq(PackedEvmLib.blockFeedId(ids1, 0), 5);
        assertEq(PackedEvmLib.blockLane(word1, 0), 0x100027100064);
        assertEq(PackedEvmLib.blockTimestampUs(word1), TIMESTAMP_US);
    }

    function test_unavailableLane() public pure {
        uint48 lane = type(uint48).max;
        assertFalse(PackedEvmLib.laneHasPrice(lane));
        (bool available, uint16 conf) = PackedEvmLib.laneConfidence(lane);
        assertFalse(available);
        assertEq(conf, 0);
    }

    function test_markerMaxAgeUs() public pure {
        (bool bounded, uint64 maxAge) = PackedEvmLib.markerMaxAgeUs(PackedEvmLib.MARKER_ZERO);
        assertTrue(bounded);
        assertEq(maxAge, 0);
        (bounded, maxAge) = PackedEvmLib.markerMaxAgeUs(PackedEvmLib.MARKER_ONE_SECOND_OR_LESS);
        assertTrue(bounded);
        assertEq(maxAge, 1_000_000);
        (bounded, maxAge) = PackedEvmLib.markerMaxAgeUs(PackedEvmLib.MARKER_FIVE_SECONDS_OR_LESS);
        assertTrue(bounded);
        assertEq(maxAge, 5_000_000);
        (bounded,) = PackedEvmLib.markerMaxAgeUs(PackedEvmLib.MARKER_MORE_THAN_FIVE_SECONDS);
        assertFalse(bounded);
    }

    function test_rejectsBadMagic() public {
        bytes memory payload = GOLDEN_ONE_FEED;
        payload[0] = 0x00;
        _expectRevertBoth(payload, PackedEvmLib.InvalidMagic.selector);
    }

    function test_rejectsZeroFeeds() public {
        bytes memory payload = GOLDEN_ONE_FEED;
        payload[5] = 0x00;
        _expectRevertBoth(payload, PackedEvmLib.NoFeeds.selector);
    }

    function test_rejectsWrongLength() public {
        _expectRevertBoth(hex"5045564d01", PackedEvmLib.InvalidLength.selector);
        _expectRevertBoth(bytes.concat(GOLDEN_ONE_FEED, hex"00"), PackedEvmLib.InvalidLength.selector);
        bytes memory payload = GOLDEN_ONE_FEED;
        payload[5] = 0x05; // five feeds need two blocks
        _expectRevertBoth(payload, PackedEvmLib.InvalidLength.selector);
    }

    function test_rejectsTimestampMismatch() public {
        bytes memory payload = GOLDEN_FIVE_FEEDS;
        payload[100] = 0x41; // block 1's last timestamp byte
        _expectRevertBoth(payload, PackedEvmLib.TimestampMismatch.selector);
    }

    function test_rejectsNonZeroPadding() public {
        // Block 1 of five feeds: an unused feed id, lane and staleness marker.
        uint256[3] memory offsets = [uint256(58), 76, 101];
        for (uint256 i; i < offsets.length; ++i) {
            bytes memory payload = GOLDEN_FIVE_FEEDS;
            payload[offsets[i]] = 0x01;
            _expectRevertBoth(payload, PackedEvmLib.NonZeroPadding.selector);
        }
    }

    function test_getBlockRejectsOutOfRange() public {
        vm.expectRevert(PackedEvmLib.BlockOutOfRange.selector);
        harness.getBlock(GOLDEN_FIVE_FEEDS, 2);
        vm.expectRevert(PackedEvmLib.BlockOutOfRange.selector);
        harness.getBlockCalldata(GOLDEN_FIVE_FEEDS, 2);
        // A feed count the bytes are too short for.
        bytes memory payload = GOLDEN_ONE_FEED;
        payload[5] = 0x05;
        vm.expectRevert(PackedEvmLib.BlockOutOfRange.selector);
        harness.getBlock(payload, 1);
        vm.expectRevert(PackedEvmLib.BlockOutOfRange.selector);
        harness.getBlockCalldata(payload, 1);
    }
}
