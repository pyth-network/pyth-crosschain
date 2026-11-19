// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Codebook256} from "./Codebook256.sol";

/// @title PythLazerPackedEvmLib
/// @notice Reads `packedEvmEcdsa` payloads after `PythLazer.verifyUpdate` has
/// verified them.
/// @dev Every function is `internal`, so it compiles into the consumer contract
/// and needs no linked library. Payload readers take `bytes calldata` and never
/// copy the payload to memory. Word and lane readers take a `bytes32` word or a
/// `uint48` lane, so a consumer can decode a word it stored earlier.
///
/// The payload, all values big-endian:
///
/// | offset     | size | field                                   |
/// |------------|------|-----------------------------------------|
/// | 0          | 4    | magic, `PEVM` (`0x5045564d`)            |
/// | 4          | 1    | channel id                              |
/// | 5          | 1    | `numFeeds`                              |
/// | 6 + 48 * b | 48   | block `b`, for `b` < ceil(numFeeds / 4) |
///
/// A block is four `uint32` feed ids (16 bytes) and then a 32-byte word. The
/// word is four 6-byte lanes, in the same order as the block's feed ids, then a
/// 7-byte timestamp in unix microseconds, then 1 reserved byte. Feed `i` of the
/// payload is slot `i % 4` of block `i / 4`. Feed ids keep the order the
/// subscriber requested; they are not sorted.
///
/// A lane is 48 bits, most-significant bit first:
///
/// | bits   | field                                            |
/// |--------|--------------------------------------------------|
/// | 47..43 | `negExponent`: the exponent is `-negExponent`    |
/// | 42..16 | price mantissa, unsigned 27 bits                 |
/// | 15..8  | confidence code, `Codebook256` of conf / price   |
/// | 7..0   | spread code, `Codebook256` of (ask - bid) / price|
///
/// The three fields are independent. The price is unavailable when its top 32
/// bits are all ones; any other value is a real, positive price, even when both
/// codes are unavailable. A code is unavailable when it is `0xFF`. A lane of six
/// `0xFF` bytes (`LANE_UNAVAILABLE`) has none of the three: the feed had no
/// data, no price, a price older than 5 s, or a price that did not fit.
///
/// Validation is deliberately minimal, to save gas. The readers check only what
/// stops them reading the wrong bytes: the magic, in `parseHeader` and
/// `findFeed`, and the payload length, once per read. They do NOT check the
/// reserved byte, the zero padding of the last block, that every block carries
/// the same timestamp, or that `numFeeds` is at least 1.
/// Pyth signs the payload and the Rust parser checks all of these, so an
/// on-chain check would only spend gas. Do not add them back.
///
/// The slots past `numFeeds` in the last block hold feed id 0 and a zero lane.
/// A zero lane reads as an available price of 0 at exponent 0, so only read
/// feeds below `numFeeds`.
library PythLazerPackedEvmLib {
    /// @notice `PEVM` in ASCII.
    uint32 internal constant FORMAT_MAGIC = 0x5045564d;

    uint256 internal constant HEADER_SIZE = 6;
    uint256 internal constant BLOCK_SIZE = 48;
    uint256 internal constant FEEDS_PER_BLOCK = 4;

    /// @notice The lane of a feed with no price, no confidence and no spread.
    uint48 internal constant LANE_UNAVAILABLE = type(uint48).max;

    /// @dev Offsets of the `PythLazer` EVM envelope that wraps the payload.
    uint256 private constant UPDATE_PAYLOAD_LEN_OFFSET = 69;
    uint256 private constant UPDATE_PAYLOAD_OFFSET = 71;

    uint256 private constant MANTISSA_MASK = (1 << 27) - 1;
    uint256 private constant PRICE_UNAVAILABLE = type(uint32).max;

    error InvalidPackedEvmMagic();
    error ReadOutOfBounds();
    error LaneSlotOutOfRange();
    error PriceUnavailable();
    error ConfidenceUnavailable();
    error SpreadUnavailable();

    // ========================================================================
    // Payload readers (bytes calldata)
    // ========================================================================

    /// @notice Returns the payload inside a `PythLazer` EVM update, as a
    /// calldata slice of `update`.
    /// @dev `PythLazer.verifyUpdate` is an external call, so a consumer gets its
    /// returned payload as `bytes memory`. This helper slices the same bytes out
    /// of the consumer's own calldata instead. It does not verify anything:
    /// call it only after `verifyUpdate(update)` has succeeded.
    function getPayloadFromUpdate(bytes calldata update) internal pure returns (bytes calldata payload) {
        uint256 payloadLen = uint16(bytes2(update[UPDATE_PAYLOAD_LEN_OFFSET:UPDATE_PAYLOAD_OFFSET]));
        payload = update[UPDATE_PAYLOAD_OFFSET:UPDATE_PAYLOAD_OFFSET + payloadLen];
    }

    /// @notice Reads the payload header and checks the magic.
    /// @dev The other payload readers do not check the magic, except
    /// `findFeed`, which calls this. Call it once per payload before them, so
    /// that a payload in another format is not misread.
    /// @return channelId The channel id; 1 is real time, 2 is fixed rate 50 ms,
    /// as in `PythLazerStructs.Channel`.
    /// @return numFeeds The number of feeds in the payload.
    function parseHeader(bytes calldata payload) internal pure returns (uint8 channelId, uint8 numFeeds) {
        uint256 header = _load(payload, 0, HEADER_SIZE) >> 208;
        if (header >> 16 != FORMAT_MAGIC) {
            revert InvalidPackedEvmMagic();
        }
        channelId = uint8(header >> 8);
        numFeeds = uint8(header);
    }

    /// @notice The number of 48-byte blocks that hold `numFeeds` feeds.
    function numBlocks(uint8 numFeeds) internal pure returns (uint256) {
        unchecked {
            return (uint256(numFeeds) + FEEDS_PER_BLOCK - 1) / FEEDS_PER_BLOCK;
        }
    }

    /// @notice The four feed ids of block `blockIndex`.
    function getBlockFeedIds(bytes calldata payload, uint256 blockIndex)
        internal
        pure
        returns (uint32 feedId0, uint32 feedId1, uint32 feedId2, uint32 feedId3)
    {
        uint256 ids = _load(payload, _blockOffset(blockIndex), 16) >> 128;
        feedId0 = uint32(ids >> 96);
        feedId1 = uint32(ids >> 64);
        feedId2 = uint32(ids >> 32);
        feedId3 = uint32(ids);
    }

    /// @notice The 32-byte word of block `blockIndex`: four lanes and the
    /// timestamp. Store it in one storage slot and decode it later with
    /// `getWordLane` and `getWordTimestamp`.
    function getBlockWord(bytes calldata payload, uint256 blockIndex) internal pure returns (bytes32) {
        unchecked {
            return bytes32(_load(payload, _blockOffset(blockIndex) + 16, 32));
        }
    }

    /// @notice The feed id of feed `feedIndex` of the payload.
    function getFeedId(bytes calldata payload, uint256 feedIndex) internal pure returns (uint32) {
        _checkFeedIndex(feedIndex);
        return _feedIdAt(payload, feedIndex);
    }

    /// @notice The lane of feed `feedIndex` of the payload.
    function getLane(bytes calldata payload, uint256 feedIndex) internal pure returns (uint48) {
        _checkFeedIndex(feedIndex);
        unchecked {
            bytes32 word = getBlockWord(payload, feedIndex >> 2);
            return uint48(uint256(word) >> (208 - 48 * (feedIndex & 3)));
        }
    }

    /// @notice The payload timestamp, in unix microseconds, read from block 0.
    function getTimestamp(bytes calldata payload) internal pure returns (uint64) {
        return getWordTimestamp(getBlockWord(payload, 0));
    }

    /// @notice Finds the position of `feedId` in the payload.
    /// @dev Checks the magic, then scans the feed ids in payload order. The
    /// scan is linear in `numFeeds`. A consumer that already knows the order
    /// it subscribed in can skip it and call `getLane` with the index.
    /// @return found Whether the payload carries `feedId`.
    /// @return feedIndex The position of the first match; 0 when not found.
    function findFeed(bytes calldata payload, uint32 feedId) internal pure returns (bool found, uint256 feedIndex) {
        (, uint8 numFeeds) = parseHeader(payload);
        unchecked {
            for (uint256 i = 0; i < numFeeds; ++i) {
                if (_feedIdAt(payload, i) == feedId) {
                    return (true, i);
                }
            }
        }
        return (false, 0);
    }

    /// @dev `numFeeds` is a `uint8`, so no payload holds a feed at 256 or
    /// above. Bounding the index lets the offset arithmetic run unchecked.
    function _checkFeedIndex(uint256 feedIndex) private pure {
        if (feedIndex > type(uint8).max) {
            revert ReadOutOfBounds();
        }
    }

    /// @dev The offset of block `blockIndex`. 255 feeds fill 64 blocks.
    function _blockOffset(uint256 blockIndex) private pure returns (uint256) {
        if (blockIndex >= 64) {
            revert ReadOutOfBounds();
        }
        unchecked {
            return HEADER_SIZE + blockIndex * BLOCK_SIZE;
        }
    }

    /// @dev Feed id `feedIndex`, for a `feedIndex` below 256.
    function _feedIdAt(bytes calldata payload, uint256 feedIndex) private pure returns (uint32) {
        unchecked {
            uint256 offset = HEADER_SIZE + (feedIndex >> 2) * BLOCK_SIZE + (feedIndex & 3) * 4;
            return uint32(_load(payload, offset, 4) >> 224);
        }
    }

    /// @dev Reads the 32 bytes of `payload` at `offset`, after checking that
    /// `payload` holds the `size` bytes the caller uses. Every caller passes
    /// an offset below 2^16, so the sum cannot overflow. This is the payload's
    /// only length check: a calldata slice does the same check for two to four
    /// times the gas.
    function _load(bytes calldata payload, uint256 offset, uint256 size) private pure returns (uint256 value) {
        unchecked {
            if (payload.length < offset + size) {
                revert ReadOutOfBounds();
            }
        }
        assembly {
            value := calldataload(add(payload.offset, offset))
        }
    }

    // ========================================================================
    // Word readers (bytes32)
    // ========================================================================

    /// @notice Lane `slot` (0 to 3) of `word`.
    function getWordLane(bytes32 word, uint256 slot) internal pure returns (uint48) {
        if (slot >= FEEDS_PER_BLOCK) {
            revert LaneSlotOutOfRange();
        }
        unchecked {
            return uint48(uint256(word) >> (208 - 48 * slot));
        }
    }

    /// @notice The timestamp of `word`, in unix microseconds.
    function getWordTimestamp(bytes32 word) internal pure returns (uint64) {
        return uint64(uint56(uint256(word) >> 8));
    }

    // ========================================================================
    // Lane readers (uint48)
    // ========================================================================

    /// @notice Whether `lane` carries a price.
    function hasPrice(uint48 lane) internal pure returns (bool) {
        return uint32(lane >> 16) != PRICE_UNAVAILABLE;
    }

    /// @notice The price of `lane`, as `mantissa * 10^exponent`. Reverts when
    /// `hasPrice` is false.
    /// @return mantissa The unsigned 27-bit mantissa.
    /// @return exponent The exponent, from -31 to 0.
    function getPrice(uint48 lane) internal pure returns (uint32 mantissa, int16 exponent) {
        uint256 price = uint32(lane >> 16);
        if (price == PRICE_UNAVAILABLE) {
            revert PriceUnavailable();
        }
        unchecked {
            mantissa = uint32(price & MANTISSA_MASK);
            exponent = -int16(uint16(price >> 27));
        }
    }

    /// @notice Whether `lane` carries a confidence.
    function hasConfidence(uint48 lane) internal pure returns (bool) {
        return uint8(lane >> 8) != Codebook256.UNAVAILABLE;
    }

    /// @notice The confidence of `lane` as a ratio against the price, in
    /// 0.01 bps. Reverts when `hasConfidence` is false.
    function getConfidence(uint48 lane) internal pure returns (uint16) {
        (uint16 value, bool available) = Codebook256.decode(uint8(lane >> 8));
        if (!available) {
            revert ConfidenceUnavailable();
        }
        return value;
    }

    /// @notice Whether `lane` carries a spread.
    function hasSpread(uint48 lane) internal pure returns (bool) {
        return uint8(lane) != Codebook256.UNAVAILABLE;
    }

    /// @notice The spread (ask - bid) of `lane` as a ratio against the price,
    /// in 0.01 bps. Reverts when `hasSpread` is false.
    function getSpread(uint48 lane) internal pure returns (uint16) {
        (uint16 value, bool available) = Codebook256.decode(uint8(lane));
        if (!available) {
            revert SpreadUnavailable();
        }
        return value;
    }
}
