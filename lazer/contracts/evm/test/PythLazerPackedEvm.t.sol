// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {Codebook256} from "../src/Codebook256.sol";
import {PythLazerPackedEvmLib} from "../src/PythLazerPackedEvmLib.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// Calls the internal library functions externally, so the tests can pass the
/// payload as calldata and expect reverts.
contract PackedEvmHarness {
    function parseHeader(bytes calldata payload) external pure returns (uint8, uint8) {
        return PythLazerPackedEvmLib.parseHeader(payload);
    }

    function getBlockFeedIds(bytes calldata payload, uint256 blockIndex)
        external
        pure
        returns (uint32, uint32, uint32, uint32)
    {
        return PythLazerPackedEvmLib.getBlockFeedIds(payload, blockIndex);
    }

    function getBlockWord(bytes calldata payload, uint256 blockIndex) external pure returns (bytes32) {
        return PythLazerPackedEvmLib.getBlockWord(payload, blockIndex);
    }

    function getFeedId(bytes calldata payload, uint256 feedIndex) external pure returns (uint32) {
        return PythLazerPackedEvmLib.getFeedId(payload, feedIndex);
    }

    function getLane(bytes calldata payload, uint256 feedIndex) external pure returns (uint48) {
        return PythLazerPackedEvmLib.getLane(payload, feedIndex);
    }

    function getTimestamp(bytes calldata payload) external pure returns (uint64) {
        return PythLazerPackedEvmLib.getTimestamp(payload);
    }

    function findFeed(bytes calldata payload, uint32 feedId) external pure returns (bool, uint256) {
        return PythLazerPackedEvmLib.findFeed(payload, feedId);
    }

    function getWordLane(bytes32 word, uint256 slot) external pure returns (uint48) {
        return PythLazerPackedEvmLib.getWordLane(word, slot);
    }

    function getPrice(uint48 lane) external pure returns (uint32, int16) {
        return PythLazerPackedEvmLib.getPrice(lane);
    }

    function getConfidence(uint48 lane) external pure returns (uint16) {
        return PythLazerPackedEvmLib.getConfidence(lane);
    }

    function getSpread(uint48 lane) external pure returns (uint16) {
        return PythLazerPackedEvmLib.getSpread(lane);
    }
}

/// A consumer as the README describes it: verify the update, decode the
/// payload from calldata, store each block's word in one slot.
contract PackedPriceConsumer {
    PythLazer public immutable pythLazer;

    /// Block index => the block's word.
    mapping(uint256 => bytes32) public words;

    constructor(PythLazer _pythLazer) {
        pythLazer = _pythLazer;
    }

    function updatePrices(bytes calldata update) external payable {
        pythLazer.verifyUpdate{value: msg.value}(update);
        bytes calldata payload = PythLazerPackedEvmLib.getPayloadFromUpdate(update);
        (, uint8 numFeeds) = PythLazerPackedEvmLib.parseHeader(payload);
        uint256 blocks = PythLazerPackedEvmLib.numBlocks(numFeeds);
        for (uint256 b = 0; b < blocks; ++b) {
            words[b] = PythLazerPackedEvmLib.getBlockWord(payload, b);
        }
    }

    function getPrice(uint256 feedIndex) external view returns (uint32 mantissa, int16 exponent, uint64 timestamp) {
        bytes32 word = words[feedIndex / 4];
        uint48 lane = PythLazerPackedEvmLib.getWordLane(word, feedIndex % 4);
        (mantissa, exponent) = PythLazerPackedEvmLib.getPrice(lane);
        timestamp = PythLazerPackedEvmLib.getWordTimestamp(word);
    }
}

contract PythLazerPackedEvmTest is Test {
    PackedEvmHarness harness;

    // Golden vectors from `pyth-lazer/sdk/rust/protocol/src/payload/packed_evm/mod.rs`.
    bytes constant GOLDEN_ONE_FEED =
        hex"5045564d0101000000010000000000000000000000001c00639b1a2f000000000000000000000000000000000000064b0615d1774000";
    bytes constant GOLDEN_FOUR_FEEDS =
        hex"5045564d02040000000a000000140000001e0000002810002710364f10004e201db7ffffffffffff10009c401100064b0615d1774000";
    bytes constant GOLDEN_FIVE_FEEDS =
        hex"5045564d0105000000010000000200000003000000041c00639b1a2f10002710364fffffffffffff1c00639b1a2f064b0615d1774000"
        hex"0000000500000000000000000000000010002710364f000000000000000000000000000000000000064b0615d1774000";

    uint64 constant GOLDEN_TIMESTAMP_US = 1_771_339_368_200_000;

    /// A standard-format (`solana`/`evm` properties) payload, from the signed
    /// update in `PythLazer.t.sol`.
    bytes constant STANDARD_PAYLOAD =
        hex"93c7d37500062cf28659c1e801010000000605000000000005f5e10002000000000000000001000000000000000003000104fff8";

    /// The first 255 entries of `CANONICAL_TABLE_HEX` in
    /// `pyth-lazer/sdk/rust/protocol/src/payload/packed_evm/lane/codebook_256.rs`.
    /// That blob carries a 256th entry, `2710`, for the reserved byte; the
    /// table does not hold it, so it is left out here.
    bytes constant CANONICAL_TABLE =
        hex"0000000100020003000400050006000700080009000c000e00100012001400160018001a001c001e0020002200240026"
        hex"0028002a002c002e00300032003400360038003a003c003e00400042004400460048004a004c004e0050005200540056"
        hex"0058005a005c005e00600062006400660068006a006c006e0070007200740076007b00800085008a008f00940099009e"
        hex"00a300a800ad00b200b700bc00c100c600cb00d000d500da00df00e400e900ee00f300f800fd01020107010c01110116"
        hex"011b01200125012a012f01340139013e01430148014d01520157015c01610166016b01700175017a017f01840189018e"
        hex"01930198019d01a201a701ac01b101b601c001ca01d401de01e801f201fc02060210021a0224022e02380242024c0256"
        hex"0260026a0274027e02880292029c02a602b002ba02c402ce02d802e202ec02f60300030a0314031e03280332033c0346"
        hex"0350035a0364036e03780382038c039603a003aa03b403be03c803d203dc03e603f003fa0404040e04180422042c0436"
        hex"04cc056205f8068e072407ba085008e6097c0a120aa80b3e0bd40c6a0d000d960e2c0ec20f580fee1084111a11b01246"
        hex"12dc13721408149e153415ca166016f6178c182218b8194e19e41a7a1b101ba61c3c1cd21d681dfe1e941f2a1fc02056"
        hex"20ec2182221822ae234423da24702506259c263226c8275e27f4288a2920";

    function setUp() public {
        harness = new PackedEvmHarness();
    }

    function assertPrice(uint48 lane, uint32 mantissa, int16 exponent) internal view {
        assertTrue(PythLazerPackedEvmLib.hasPrice(lane), "price available");
        (uint32 m, int16 e) = harness.getPrice(lane);
        assertEq(m, mantissa, "mantissa");
        assertEq(e, exponent, "exponent");
    }

    function assertCodes(uint48 lane, uint16 confidence, uint16 spread) internal view {
        assertTrue(PythLazerPackedEvmLib.hasConfidence(lane), "confidence available");
        assertTrue(PythLazerPackedEvmLib.hasSpread(lane), "spread available");
        assertEq(harness.getConfidence(lane), confidence, "confidence");
        assertEq(harness.getSpread(lane), spread, "spread");
    }

    function assertUnavailable(uint48 lane) internal {
        assertEq(lane, PythLazerPackedEvmLib.LANE_UNAVAILABLE);
        assertFalse(PythLazerPackedEvmLib.hasPrice(lane));
        assertFalse(PythLazerPackedEvmLib.hasConfidence(lane));
        assertFalse(PythLazerPackedEvmLib.hasSpread(lane));
        vm.expectRevert(PythLazerPackedEvmLib.PriceUnavailable.selector);
        harness.getPrice(lane);
        vm.expectRevert(PythLazerPackedEvmLib.ConfidenceUnavailable.selector);
        harness.getConfidence(lane);
        vm.expectRevert(PythLazerPackedEvmLib.SpreadUnavailable.selector);
        harness.getSpread(lane);
    }

    // ------------------------------------------------------------------------
    // Codebook256
    // ------------------------------------------------------------------------

    function test_codebook_matches_rust_table() public pure {
        assertEq(CANONICAL_TABLE.length, 2 * Codebook256.TABLE_LEN);
        for (uint256 i = 0; i < Codebook256.TABLE_LEN; i++) {
            uint16 expected = uint16(uint8(CANONICAL_TABLE[2 * i])) << 8 | uint16(uint8(CANONICAL_TABLE[2 * i + 1]));
            (uint16 value, bool available) = Codebook256.decode(uint8(i));
            assertTrue(available);
            assertEq(value, expected);
        }
    }

    function test_codebook_reserved_byte_is_unavailable() public pure {
        (uint16 value, bool available) = Codebook256.decode(Codebook256.UNAVAILABLE);
        assertFalse(available);
        assertEq(value, 0);
        assertEq(Codebook256.UNAVAILABLE, 255);
    }

    function test_codebook_is_strictly_increasing_from_zero_to_max_value() public pure {
        (uint16 previous,) = Codebook256.decode(0);
        assertEq(previous, 0);
        for (uint256 i = 1; i < Codebook256.TABLE_LEN; i++) {
            (uint16 value,) = Codebook256.decode(uint8(i));
            assertGt(value, previous);
            previous = value;
        }
        assertEq(previous, Codebook256.MAX_VALUE);
        assertEq(Codebook256.MAX_VALUE, 10_528);
    }

    // ------------------------------------------------------------------------
    // Golden vectors
    // ------------------------------------------------------------------------

    function test_golden_one_feed() public view {
        bytes memory payload = GOLDEN_ONE_FEED;
        (uint8 channelId, uint8 numFeeds) = harness.parseHeader(payload);
        assertEq(channelId, 1);
        assertEq(numFeeds, 1);
        assertEq(PythLazerPackedEvmLib.numBlocks(numFeeds), 1);

        (uint32 id0, uint32 id1, uint32 id2, uint32 id3) = harness.getBlockFeedIds(payload, 0);
        assertEq(id0, 1);
        assertEq(id1, 0);
        assertEq(id2, 0);
        assertEq(id3, 0);
        assertEq(harness.getFeedId(payload, 0), 1);

        bytes32 word = harness.getBlockWord(payload, 0);
        assertEq(word, hex"1c00639b1a2f000000000000000000000000000000000000064b0615d1774000");
        assertEq(PythLazerPackedEvmLib.getWordTimestamp(word), GOLDEN_TIMESTAMP_US);
        assertEq(harness.getTimestamp(payload), GOLDEN_TIMESTAMP_US);

        uint48 lane = harness.getLane(payload, 0);
        assertEq(lane, 0x1c00639b1a2f);
        assertEq(harness.getWordLane(word, 0), lane);
        assertPrice(lane, 67_134_363, -3);
        assertCodes(lane, 44, 86);

        // The three unused slots hold a zero lane.
        for (uint256 slot = 1; slot < 4; slot++) {
            assertEq(harness.getWordLane(word, slot), 0);
        }
    }

    function test_golden_four_feeds() public {
        bytes memory payload = GOLDEN_FOUR_FEEDS;
        (uint8 channelId, uint8 numFeeds) = harness.parseHeader(payload);
        assertEq(channelId, 2);
        assertEq(numFeeds, 4);
        assertEq(PythLazerPackedEvmLib.numBlocks(numFeeds), 1);

        (uint32 id0, uint32 id1, uint32 id2, uint32 id3) = harness.getBlockFeedIds(payload, 0);
        assertEq(id0, 10);
        assertEq(id1, 20);
        assertEq(id2, 30);
        assertEq(id3, 40);

        assertEq(harness.getTimestamp(payload), GOLDEN_TIMESTAMP_US);

        // Feed 10: $100.00 quoted 99.99 / 100.01.
        uint48 lane = harness.getLane(payload, 0);
        assertEq(lane, 0x10002710364f);
        assertPrice(lane, 10_000, -2);
        assertCodes(lane, 100, 198);

        // Feed 20: $200.00 quoted 199.90 / 200.10.
        lane = harness.getLane(payload, 1);
        assertEq(lane, 0x10004e201db7);
        assertPrice(lane, 20_000, -2);
        assertCodes(lane, 50, 998);

        // Feed 30: stale, so the sentinel.
        assertUnavailable(harness.getLane(payload, 2));

        // Feed 40: $400.00 with bid and ask on the price.
        lane = harness.getLane(payload, 3);
        assertEq(lane, 0x10009c401100);
        assertPrice(lane, 40_000, -2);
        assertCodes(lane, 26, 0);
    }

    function test_golden_five_feeds() public {
        bytes memory payload = GOLDEN_FIVE_FEEDS;
        (uint8 channelId, uint8 numFeeds) = harness.parseHeader(payload);
        assertEq(channelId, 1);
        assertEq(numFeeds, 5);
        assertEq(PythLazerPackedEvmLib.numBlocks(numFeeds), 2);

        for (uint256 i = 0; i < numFeeds; i++) {
            assertEq(harness.getFeedId(payload, i), i + 1);
        }
        (uint32 id0, uint32 id1, uint32 id2, uint32 id3) = harness.getBlockFeedIds(payload, 1);
        assertEq(id0, 5);
        assertEq(id1, 0);
        assertEq(id2, 0);
        assertEq(id3, 0);

        // Both blocks carry the payload timestamp.
        assertEq(PythLazerPackedEvmLib.getWordTimestamp(harness.getBlockWord(payload, 0)), GOLDEN_TIMESTAMP_US);
        assertEq(PythLazerPackedEvmLib.getWordTimestamp(harness.getBlockWord(payload, 1)), GOLDEN_TIMESTAMP_US);

        uint48 lane = harness.getLane(payload, 0);
        assertEq(lane, 0x1c00639b1a2f);
        assertPrice(lane, 67_134_363, -3);
        assertCodes(lane, 44, 86);

        lane = harness.getLane(payload, 1);
        assertEq(lane, 0x10002710364f);
        assertPrice(lane, 10_000, -2);
        assertCodes(lane, 100, 198);

        assertUnavailable(harness.getLane(payload, 2));

        lane = harness.getLane(payload, 3);
        assertEq(lane, 0x1c00639b1a2f);
        assertPrice(lane, 67_134_363, -3);
        assertCodes(lane, 44, 86);

        // Feed 5 is in the second block.
        lane = harness.getLane(payload, 4);
        assertEq(lane, 0x10002710364f);
        assertPrice(lane, 10_000, -2);
        assertCodes(lane, 100, 198);
        bytes32 word = harness.getBlockWord(payload, 1);
        assertEq(harness.getWordLane(word, 0), lane);
        for (uint256 slot = 1; slot < 4; slot++) {
            assertEq(harness.getWordLane(word, slot), 0);
        }
    }

    function test_find_feed() public view {
        bytes memory payload = GOLDEN_FIVE_FEEDS;
        for (uint32 feedId = 1; feedId <= 5; feedId++) {
            (bool found, uint256 feedIndex) = harness.findFeed(payload, feedId);
            assertTrue(found);
            assertEq(feedIndex, feedId - 1);
        }
        (bool found6,) = harness.findFeed(payload, 6);
        assertFalse(found6);
        // Feed id 0 fills the unused slots, which the scan does not reach.
        (bool found0,) = harness.findFeed(payload, 0);
        assertFalse(found0);

        (bool found40, uint256 index40) = harness.findFeed(GOLDEN_FOUR_FEEDS, 40);
        assertTrue(found40);
        assertEq(index40, 3);
    }

    // ------------------------------------------------------------------------
    // Lane cases
    // ------------------------------------------------------------------------

    function test_lane_price_with_both_codes_unavailable_is_readable() public {
        uint48 lane = 0x1c00639bffff;
        assertPrice(lane, 67_134_363, -3);
        assertFalse(PythLazerPackedEvmLib.hasConfidence(lane));
        assertFalse(PythLazerPackedEvmLib.hasSpread(lane));
        vm.expectRevert(PythLazerPackedEvmLib.ConfidenceUnavailable.selector);
        harness.getConfidence(lane);
        vm.expectRevert(PythLazerPackedEvmLib.SpreadUnavailable.selector);
        harness.getSpread(lane);
    }

    function test_lane_price_unavailable_with_codes_present() public {
        uint48 lane = 0xffffffff1a2f;
        assertFalse(PythLazerPackedEvmLib.hasPrice(lane));
        vm.expectRevert(PythLazerPackedEvmLib.PriceUnavailable.selector);
        harness.getPrice(lane);
        assertCodes(lane, 44, 86);
    }

    function test_lane_all_0xff_is_unavailable() public {
        assertUnavailable(0xffffffffffff);
    }

    function test_lane_one_code_unavailable_leaves_the_other() public view {
        uint48 lane = 0x1c00639bff2f;
        assertFalse(PythLazerPackedEvmLib.hasConfidence(lane));
        assertEq(harness.getSpread(lane), 86);
        lane = 0x1c00639b1aff;
        assertEq(harness.getConfidence(lane), 44);
        assertFalse(PythLazerPackedEvmLib.hasSpread(lane));
    }

    function test_lane_neg_exponent_zero_with_largest_mantissa() public view {
        // neg_exponent 0, mantissa 2^27 - 1.
        assertPrice(0x07ffffff0000, 134_217_727, 0);
    }

    function test_lane_neg_exponent_31() public view {
        assertPrice(0xf80000010000, 1, -31);
    }

    function test_lane_largest_mantissa_that_is_still_a_price() public view {
        // One below the all-ones price: neg_exponent 31, mantissa 2^27 - 2.
        assertPrice(0xfffffffe0000, 134_217_726, -31);
        // At any other exponent, mantissa 2^27 - 1 is a real price.
        assertPrice(0xf7ffffff0000, 134_217_727, -30);
    }

    function test_lane_largest_code_is_max_value() public view {
        // Index 254 is the last entry.
        assertCodes(0x07fffffffefe, Codebook256.MAX_VALUE, Codebook256.MAX_VALUE);
    }

    function test_index_past_any_payload_reverts() public {
        // No payload holds feed 256 or block 64, whatever its length.
        bytes memory payload = new bytes(6 + 64 * 48 + 32);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getFeedId(payload, 256);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getLane(payload, 256);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getBlockWord(payload, 64);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getBlockWord(payload, type(uint256).max);
        assertEq(harness.getFeedId(payload, 255), 0);
        assertEq(harness.getBlockWord(payload, 63), 0);
    }

    function test_word_lane_slot_out_of_range_reverts() public {
        vm.expectRevert(PythLazerPackedEvmLib.LaneSlotOutOfRange.selector);
        harness.getWordLane(bytes32(0), 4);
    }

    // ------------------------------------------------------------------------
    // Rejection
    // ------------------------------------------------------------------------

    function test_standard_payload_reverts_on_magic() public {
        vm.expectRevert(PythLazerPackedEvmLib.InvalidPackedEvmMagic.selector);
        harness.parseHeader(STANDARD_PAYLOAD);
        vm.expectRevert(PythLazerPackedEvmLib.InvalidPackedEvmMagic.selector);
        harness.findFeed(STANDARD_PAYLOAD, 6);
    }

    function test_short_payload_reverts() public {
        // The five-feed payload without its second block.
        bytes memory truncated = new bytes(54);
        bytes memory full = GOLDEN_FIVE_FEEDS;
        for (uint256 i = 0; i < truncated.length; i++) {
            truncated[i] = full[i];
        }
        assertEq(harness.getLane(truncated, 3), 0x1c00639b1a2f);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getLane(truncated, 4);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getFeedId(truncated, 4);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getBlockWord(truncated, 1);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.getBlockFeedIds(truncated, 1);
        // num_feeds says 5, so the scan runs past the end.
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.findFeed(truncated, 5);
        vm.expectRevert(PythLazerPackedEvmLib.ReadOutOfBounds.selector);
        harness.parseHeader(hex"5045564d01");
    }
}

/// Decodes a packed payload returned by `PythLazer.verifyUpdate`.
contract PythLazerPackedEvmVerifyTest is Test {
    PythLazer pythLazer;
    PackedPriceConsumer consumer;
    uint256 constant SIGNER_KEY = 0xa11ce;

    bytes constant GOLDEN_FIVE_FEEDS =
        hex"5045564d0105000000010000000200000003000000041c00639b1a2f10002710364fffffffffffff1c00639b1a2f064b0615d1774000"
        hex"0000000500000000000000000000000010002710364f000000000000000000000000000000000000064b0615d1774000";

    function setUp() public {
        address owner = address(1);
        PythLazer pythLazerImpl = new PythLazer();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(pythLazerImpl), owner, abi.encodeWithSelector(PythLazer.initialize.selector, owner)
        );
        pythLazer = PythLazer(address(proxy));
        vm.prank(owner);
        pythLazer.updateTrustedSigner(vm.addr(SIGNER_KEY), block.timestamp + 1000);
        consumer = new PackedPriceConsumer(pythLazer);
    }

    /// Wraps `payload` in the `PythLazer` EVM envelope, signed by `key`.
    function signUpdate(uint256 key, bytes memory payload) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(payload));
        return abi.encodePacked(uint32(706910618), r, s, uint8(v - 27), uint16(payload.length), payload);
    }

    function test_decode_through_verify_update() public {
        bytes memory update = signUpdate(SIGNER_KEY, GOLDEN_FIVE_FEEDS);
        consumer.updatePrices{value: pythLazer.verification_fee()}(update);

        (uint32 mantissa, int16 exponent, uint64 timestamp) = consumer.getPrice(0);
        assertEq(mantissa, 67_134_363);
        assertEq(exponent, -3);
        assertEq(timestamp, 1_771_339_368_200_000);

        (mantissa, exponent, timestamp) = consumer.getPrice(4);
        assertEq(mantissa, 10_000);
        assertEq(exponent, -2);
        assertEq(timestamp, 1_771_339_368_200_000);

        vm.expectRevert(PythLazerPackedEvmLib.PriceUnavailable.selector);
        consumer.getPrice(2);
    }

    function test_decode_ignores_bytes_after_the_payload() public {
        bytes memory update = abi.encodePacked(signUpdate(SIGNER_KEY, GOLDEN_FIVE_FEEDS), hex"deadbeef");
        consumer.updatePrices{value: pythLazer.verification_fee()}(update);
        (uint32 mantissa,,) = consumer.getPrice(4);
        assertEq(mantissa, 10_000);
    }

    function test_untrusted_signer_reverts() public {
        bytes memory update = signUpdate(0xb0b, GOLDEN_FIVE_FEEDS);
        uint256 fee = pythLazer.verification_fee();
        vm.expectRevert("invalid signer");
        consumer.updatePrices{value: fee}(update);
    }
}
