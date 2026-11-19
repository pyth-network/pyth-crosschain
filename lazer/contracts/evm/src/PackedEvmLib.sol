// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title PackedEvmLib
/// @notice Zero-allocation decoder for Pyth Lazer's `PackedEvm` payload, the `packedEvmEcdsa` format.
///         Reference: pyth-network/pyth-lazer-public, `sdk/rust/protocol/src/payload/packed_evm`; the
///         checks here are the reference deserializer's. This library decodes, it does not verify:
///         decode the bytes `PythLazer.verifyUpdate` verified, or check that the bytes decoded are those.
///
///         Payload, big-endian:
///             magic "PEVM" (4) | channel (1) | feed count N, 1..255 (1) | ceil(N / 4) blocks of 48 bytes
///         Block: four uint32 feed ids (16) | word (32). Feeds keep the subscription's order, four per
///         block; in the last block, slots past N are zero.
///         Word: four 48-bit lanes in bits 255..64, slot 0 highest | uint56 timestamp in microseconds in
///         bits 63..8, the same in every block | four 2-bit staleness markers in bits 7..0, slot 0's in
///         bits 7..6.
///         Lane: 5-bit negated decimal exponent | 27-bit price mantissa | uint16 confidence.
///         - Price: `mantissa × 10^(−negExponent)`; all 32 price bits set mean no price.
///         - Confidence: `confidence / price` in hundredths of a basis point (1e-6 of the price),
///           rounded to nearest; 0xFFFF means unavailable.
///         - Staleness marker: how long before the payload timestamp the feed last updated — 0: at that
///           timestamp, 1: up to 1 s, 2: up to 5 s, 3: more than 5 s or unknown. The lane keeps its
///           price whatever the marker.
///
///         Typical use, after verification:
///             (, uint8 numFeeds, uint64 timestampUs) = PackedEvmLib.validate(payload);
///             for (uint256 b; b < PackedEvmLib.numBlocks(numFeeds); ++b) {
///                 (uint128 ids, uint256 word, uint256 count) = PackedEvmLib.getBlock(payload, b);
///                 for (uint256 slot; slot < count; ++slot) {
///                     uint32 feedId = PackedEvmLib.blockFeedId(ids, slot);
///                     uint48 lane = PackedEvmLib.blockLane(word, slot);
///                     ...
///                 }
///             }
///         A consumer that stores words can store `word` as it is and decode lanes on read.
library PackedEvmLib {
    uint32 internal constant MAGIC = 0x5045564d; // "PEVM"
    uint256 internal constant HEADER_SIZE = 6;
    uint256 internal constant BLOCK_SIZE = 48;
    uint256 internal constant FEEDS_PER_BLOCK = 4;

    uint8 internal constant MARKER_ZERO = 0;
    uint8 internal constant MARKER_ONE_SECOND_OR_LESS = 1;
    uint8 internal constant MARKER_FIVE_SECONDS_OR_LESS = 2;
    uint8 internal constant MARKER_MORE_THAN_FIVE_SECONDS = 3;

    uint256 internal constant PRICE_UNAVAILABLE = 0xFFFFFFFF;
    uint16 internal constant CONFIDENCE_UNAVAILABLE = 0xFFFF;

    uint256 private constant X56 = 0xFFFFFFFFFFFFFF;

    /// @notice The payload does not start with "PEVM".
    error InvalidMagic();
    /// @notice The payload's feed count is zero.
    error NoFeeds();
    /// @notice The payload is not exactly a header and ceil(N / 4) blocks long.
    error InvalidLength();
    /// @notice A block index past the payload's last block.
    error BlockOutOfRange();
    /// @notice A feed id, lane or staleness marker past the feed count is not zero.
    error NonZeroPadding();
    /// @notice A block's timestamp differs from the payload's.
    error TimestampMismatch();

    /*
     * Payload
     */

    function numBlocks(uint256 numFeeds) internal pure returns (uint256) {
        return (numFeeds + FEEDS_PER_BLOCK - 1) / FEEDS_PER_BLOCK;
    }

    /// @notice Reads the header and checks it: the magic, at least one feed, and a length of exactly
    ///         ceil(N / 4) blocks. Returns the payload timestamp, read from block 0; `validate` also
    ///         checks every block against it.
    function parseHeader(bytes memory payload)
        internal
        pure
        returns (uint8 channel, uint8 numFeeds, uint64 timestampUs)
    {
        uint256 length = payload.length;
        if (length < HEADER_SIZE) revert InvalidLength();
        uint256 head;
        assembly ("memory-safe") {
            head := mload(add(payload, 0x20))
        }
        (channel, numFeeds) = _checkHeader(head, length);
        uint256 word;
        assembly ("memory-safe") {
            word := mload(add(payload, 0x36)) // block 0's word: payload byte 22
        }
        timestampUs = blockTimestampUs(word);
    }

    /// @notice `parseHeader` for a payload in calldata.
    function parseHeaderCalldata(bytes calldata payload)
        internal
        pure
        returns (uint8 channel, uint8 numFeeds, uint64 timestampUs)
    {
        uint256 length = payload.length;
        if (length < HEADER_SIZE) revert InvalidLength();
        uint256 head;
        uint256 word;
        assembly {
            head := calldataload(payload.offset)
        }
        (channel, numFeeds) = _checkHeader(head, length);
        assembly {
            word := calldataload(add(payload.offset, 22))
        }
        timestampUs = blockTimestampUs(word);
    }

    /// @notice Block `index`: its four feed ids, slot 0 in bits 127..96; its word; and how many of its
    ///         slots hold feeds. Bounds-checked against the payload's own feed count and length only:
    ///         `parseHeader` checks the magic, `checkBlock` the block's padding and timestamp, and
    ///         `validate` all of it.
    function getBlock(bytes memory payload, uint256 index)
        internal
        pure
        returns (uint128 ids, uint256 word, uint256 count)
    {
        uint256 head;
        assembly ("memory-safe") {
            head := mload(add(payload, 0x20))
        }
        uint256 at;
        (at, count) = _locateBlock(head, index, payload.length);
        assembly ("memory-safe") {
            let start := add(add(payload, 0x20), at)
            ids := shr(128, mload(start))
            word := mload(add(start, 16))
        }
    }

    /// @notice `getBlock` for a payload in calldata.
    function getBlockCalldata(bytes calldata payload, uint256 index)
        internal
        pure
        returns (uint128 ids, uint256 word, uint256 count)
    {
        uint256 head;
        assembly {
            head := calldataload(payload.offset)
        }
        uint256 at;
        (at, count) = _locateBlock(head, index, payload.length);
        assembly {
            let start := add(payload.offset, at)
            ids := shr(128, calldataload(start))
            word := calldataload(add(start, 16))
        }
    }

    /// @notice Reverts unless the block's timestamp is `timestampUs` and its slots past `count` — feed
    ///         ids, lanes and staleness markers — are zero.
    function checkBlock(uint128 ids, uint256 word, uint256 count, uint64 timestampUs) internal pure {
        if (blockTimestampUs(word) != timestampUs) revert TimestampMismatch();
        if (count < FEEDS_PER_BLOCK) {
            uint256 unused = FEEDS_PER_BLOCK - count;
            if (
                uint256(ids) & ((uint256(1) << (32 * unused)) - 1) != 0
                    || (word >> 64) & ((uint256(1) << (48 * unused)) - 1) != 0
                    || word & ((uint256(1) << (2 * unused)) - 1) != 0
            ) revert NonZeroPadding();
        }
    }

    /// @notice Checks the whole payload as the reference deserializer does: the header, then every block.
    function validate(bytes memory payload) internal pure returns (uint8 channel, uint8 numFeeds, uint64 timestampUs) {
        (channel, numFeeds, timestampUs) = parseHeader(payload);
        uint256 blocks = numBlocks(numFeeds);
        for (uint256 b; b < blocks; ++b) {
            (uint128 ids, uint256 word, uint256 count) = getBlock(payload, b);
            checkBlock(ids, word, count, timestampUs);
        }
    }

    /// @notice `validate` for a payload in calldata.
    function validateCalldata(bytes calldata payload)
        internal
        pure
        returns (uint8 channel, uint8 numFeeds, uint64 timestampUs)
    {
        (channel, numFeeds, timestampUs) = parseHeaderCalldata(payload);
        uint256 blocks = numBlocks(numFeeds);
        for (uint256 b; b < blocks; ++b) {
            (uint128 ids, uint256 word, uint256 count) = getBlockCalldata(payload, b);
            checkBlock(ids, word, count, timestampUs);
        }
    }

    /*
     * Block and word
     */

    /// @notice The feed id in `slot`, 0..3.
    function blockFeedId(uint128 ids, uint256 slot) internal pure returns (uint32) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(ids >> (96 - 32 * slot));
    }

    /// @notice The lane in `slot`, 0..3.
    function blockLane(uint256 word, uint256 slot) internal pure returns (uint48) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint48(word >> (208 - 48 * slot));
    }

    function blockTimestampUs(uint256 word) internal pure returns (uint64) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64((word >> 8) & X56);
    }

    /// @notice The staleness marker in `slot`, 0..3.
    function blockStalenessMarker(uint256 word, uint256 slot) internal pure returns (uint8) {
        return uint8((word >> (6 - 2 * slot)) & 3);
    }

    /// @notice The oldest a feed can be under `marker`, in microseconds before the payload timestamp.
    ///         `bounded` is false for `MARKER_MORE_THAN_FIVE_SECONDS`: the age has no bound.
    function markerMaxAgeUs(uint8 marker) internal pure returns (bool bounded, uint64 maxAgeUs) {
        if (marker == MARKER_ZERO) return (true, 0);
        if (marker == MARKER_ONE_SECOND_OR_LESS) return (true, 1_000_000);
        if (marker == MARKER_FIVE_SECONDS_OR_LESS) return (true, 5_000_000);
        return (false, 0);
    }

    /*
     * Lane
     */

    function laneHasPrice(uint48 lane) internal pure returns (bool) {
        return lane >> 16 != PRICE_UNAVAILABLE;
    }

    /// @notice The price's decimal exponent, negated. Meaningful only if `laneHasPrice`.
    function laneNegExponent(uint48 lane) internal pure returns (uint8) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint8(lane >> 43);
    }

    /// @notice The price mantissa. Meaningful only if `laneHasPrice`.
    function laneMantissa(uint48 lane) internal pure returns (uint32) {
        return uint32((lane >> 16) & 0x7FFFFFF);
    }

    /// @notice The price with `decimals` decimals, floored. Meaningful only if `laneHasPrice`. Fits
    ///         uint256 for up to 68 decimals.
    function lanePrice(uint48 lane, uint8 decimals) internal pure returns (uint256) {
        uint256 negExponent = laneNegExponent(lane);
        uint256 mantissa = laneMantissa(lane);
        return
            negExponent <= decimals
                ? mantissa * 10 ** (decimals - negExponent)
                : mantissa / 10 ** (negExponent - decimals);
    }

    /// @notice `confidence / price` in hundredths of a basis point, rounded to nearest by Pyth; at most
    ///         65_534. `available` is false for 0xFFFF.
    function laneConfidence(uint48 lane) internal pure returns (bool available, uint16 hundredthsBps) {
        // forge-lint: disable-next-line(unsafe-typecast)
        hundredthsBps = uint16(lane);
        available = hundredthsBps != CONFIDENCE_UNAVAILABLE;
        if (!available) hundredthsBps = 0;
    }

    /*
     * Private
     */

    function _checkHeader(uint256 head, uint256 length) private pure returns (uint8 channel, uint8 numFeeds) {
        // forge-lint: disable-next-line(unsafe-typecast)
        if (uint32(head >> 224) != MAGIC) revert InvalidMagic();
        // forge-lint: disable-next-line(unsafe-typecast)
        channel = uint8(head >> 216);
        // forge-lint: disable-next-line(unsafe-typecast)
        numFeeds = uint8(head >> 208);
        if (numFeeds == 0) revert NoFeeds();
        if (length != HEADER_SIZE + BLOCK_SIZE * numBlocks(numFeeds)) revert InvalidLength();
    }

    /// @dev Block `index`'s byte offset and feed count. The index is checked against the feed count
    ///      first, so it is below 64 and the arithmetic after it cannot overflow; then the block is
    ///      checked to lie within `length`.
    function _locateBlock(uint256 head, uint256 index, uint256 length)
        private
        pure
        returns (uint256 at, uint256 count)
    {
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 numFeeds = uint8(head >> 208);
        if (index >= numBlocks(numFeeds)) revert BlockOutOfRange();
        unchecked {
            at = HEADER_SIZE + BLOCK_SIZE * index;
            if (length < at + BLOCK_SIZE) revert BlockOutOfRange();
            count = numFeeds - FEEDS_PER_BLOCK * index;
        }
        if (count > FEEDS_PER_BLOCK) count = FEEDS_PER_BLOCK;
    }
}
