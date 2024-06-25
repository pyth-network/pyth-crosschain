// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

/// @title PRNG Library
/// @notice A library for pseudorandom number generation and related utility functions
/// @dev This PRNG library is designed to work with Pyth Entropy as the seed source.
///      Pyth Entropy provides secure, rapid random number generation for blockchain applications,
///      enabling responsive UX for NFT mints, games, and other use cases requiring randomness.
library PRNG {
    /// @notice Generate a random byte between 0 and 255
    /// @param seed The Pyth Entropy seed (bytes32)
    /// @return A random uint8 value
    function randomByte(bytes32 seed) internal pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encode(seed))) % 256);
    }

    /// @notice Generate a sequence of random bytes
    /// @param seed The Pyth Entropy seed (bytes32)
    /// @param length The number of random bytes to generate (max 32)
    /// @return A bytes array of random values
    function randomBytes(
        bytes32 seed,
        uint256 length
    ) internal pure returns (bytes memory) {
        require(length <= 32, "Length must be 32 or less");
        bytes32 randomness = keccak256(abi.encode(seed));
        bytes memory result = new bytes(length);
        assembly {
            mstore(add(result, 32), randomness)
        }
        return result;
    }

    /// @notice Generate a random integer within a specified range
    /// @param seed The Pyth Entropy seed (bytes32)
    /// @param min The minimum value (inclusive)
    /// @param max The maximum value (inclusive)
    /// @return A random uint256 value between min and max
    function randInt(
        bytes32 seed,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        require(max > min, "Max must be greater than min");
        return (uint256(keccak256(abi.encode(seed))) % (max - min + 1)) + min;
    }

    /// @notice Expand a seed into an array of random bytes32 values
    /// @param seed The Pyth Entropy seed (bytes32)
    /// @param numHashes The number of random bytes32 values to generate
    /// @return An array of random bytes32 values
    function expandRandomness(
        bytes32 seed,
        uint256 numHashes
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory randomStream = new bytes32[](numHashes);
        for (uint256 i = 0; i < numHashes; i++) {
            seed = keccak256(abi.encode(seed, i));
            randomStream[i] = seed;
        }
        return randomStream;
    }

    /// @notice Generate a random permutation of a sequence
    /// @param seed The Pyth Entropy seed (bytes32)
    /// @param length The length of the sequence to permute
    /// @return A randomly permuted array of uint256 values
    function randomPermutation(
        bytes32 seed,
        uint256 length
    ) internal pure returns (uint256[] memory) {
        uint256[] memory permutation = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            permutation[i] = i;
        }
        for (uint256 i = 0; i < length; i++) {
            uint256 j = i +
                (uint256(keccak256(abi.encode(seed, i))) % (length - i));
            (permutation[i], permutation[j]) = (permutation[j], permutation[i]);
        }
        return permutation;
    }

    /// @notice Convert bytes32 to uint256
    /// @param value The bytes32 value to convert
    /// @return The converted uint256 value
    function toUint(bytes32 value) internal pure returns (uint256) {
        return uint256(value);
    }

    /// @notice Convert bytes32 to uint64
    /// @param value The bytes32 value to convert
    /// @return The converted uint64 value
    function toUint64(bytes32 value) internal pure returns (uint64) {
        return uint64(uint256(value));
    }

    /// @notice Convert bytes32 to int64
    /// @param value The bytes32 value to convert
    /// @return The converted int64 value
    function toInt64(bytes32 value) internal pure returns (int64) {
        return int64(uint64(uint256(value)));
    }

    /// @notice Convert bytes32 to uint32
    /// @param value The bytes32 value to convert
    /// @return The converted uint32 value
    function toUint32(bytes32 value) internal pure returns (uint32) {
        return uint32(uint256(value));
    }

    /// @notice Convert bytes32 to int32
    /// @param value The bytes32 value to convert
    /// @return The converted int32 value
    function toInt32(bytes32 value) internal pure returns (int32) {
        return int32(uint32(uint256(value)));
    }

    /// @notice Convert bytes32 to uint8
    /// @param value The bytes32 value to convert
    /// @return The converted uint8 value
    function toUint8(bytes32 value) internal pure returns (uint8) {
        return uint8(uint256(value));
    }

    /// @notice Convert bytes32 to int8
    /// @param value The bytes32 value to convert
    /// @return The converted int8 value
    function toInt8(bytes32 value) internal pure returns (int8) {
        return int8(uint8(uint256(value)));
    }
}
