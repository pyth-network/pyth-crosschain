// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/// @title Codebook256
/// @notice Decodes the 8-bit confidence and spread codes of a `packedEvmEcdsa`
/// lane into a ratio against the price, in units of 0.01 bps.
/// @dev The codebook has 255 entries, strictly increasing from 0 to 10_528
/// (105.28 bps). Index 255 (`0xFF`) is not an entry: it means "unavailable".
///
/// The entries come from five segments, each a constant step:
///
/// | indices   | first value | step |
/// |-----------|-------------|------|
/// | 0..=9     | 0           | 1    |
/// | 10..=63   | 12          | 2    |
/// | 64..=127  | 123         | 5    |
/// | 128..=191 | 448         | 10   |
/// | 192..=254 | 1228        | 150  |
///
/// This is the generator of the Rust table in
/// `pyth-lazer/sdk/rust/protocol/src/payload/packed_evm/lane/codebook_256.rs`.
/// `decode` evaluates the segments instead of indexing a `bytes` table: a
/// `bytes` constant is copied into memory on every call, which costs 291 gas
/// per lookup (456 with `via-ir`) against 99 to 217 (77 to 185) here. The test
/// suite pins every entry to the canonical hex table from the Rust tests.
///
/// The entries are a cross-language contract. Changing one re-prices every
/// code a deployed consumer reads. A different table is a new format, not an
/// edit to this one.
library Codebook256 {
    /// @notice Number of entries in the codebook.
    uint256 internal constant TABLE_LEN = 255;

    /// @notice The code that means "no value": the one byte that is not an index.
    uint8 internal constant UNAVAILABLE = type(uint8).max;

    /// @notice Largest value the codebook holds, in 0.01 bps (105.28 bps).
    uint16 internal constant MAX_VALUE = 10_528;

    /// @notice Looks up `index` in the codebook.
    /// @return value The entry, in 0.01 bps. Zero when `available` is false.
    /// @return available False only for `UNAVAILABLE` (255).
    function decode(uint8 index) internal pure returns (uint16 value, bool available) {
        unchecked {
            uint256 i = index;
            if (i < 10) return (uint16(i), true);
            // 12 + 2 * (i - 10)
            if (i < 64) return (uint16(2 * i - 8), true);
            // 123 + 5 * (i - 64)
            if (i < 128) return (uint16(5 * i - 197), true);
            // 448 + 10 * (i - 128)
            if (i < 192) return (uint16(10 * i - 832), true);
            // 1228 + 150 * (i - 192)
            if (i < 255) return (uint16(150 * i - 27_572), true);
            return (0, false);
        }
    }
}
