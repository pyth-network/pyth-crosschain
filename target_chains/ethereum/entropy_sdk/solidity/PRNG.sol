// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

/// @title PRNG Contract
/// @notice A contract for pseudorandom number generation and related utility functions
/// @dev This PRNG contract is designed to work with Pyth Entropy as the seed source.
///      Pyth Entropy provides secure, rapid random number generation for blockchain applications,
///      enabling responsive UX for NFT mints, games, and other use cases requiring randomness.
contract PRNG {
    bytes32 private seed;
    uint256 private nonce;

    /// @notice Initialize the PRNG with a seed
    /// @param _seed The Pyth Entropy seed (bytes32)
    constructor(bytes32 _seed) {
        seed = _seed;
        nonce = 0;
    }

    /// @notice Set a new seed and reset the nonce
    /// @param _newSeed The new seed (bytes32)
    function setSeed(bytes32 _newSeed) internal {
        seed = _newSeed;
        nonce = 0;
    }

    /// @notice Generate the next random bytes32 value and update the state
    /// @return The next random bytes32 value
    function nextBytes32() internal returns (bytes32) {
        bytes32 result = keccak256(abi.encode(seed, nonce));
        nonce++;
        return result;
    }

    /// @notice Generate a random uint256 value
    /// @return A random uint256 value
    function randUint() internal returns (uint256) {
        return uint256(nextBytes32());
    }

    /// @notice Generate a random uint64 value
    /// @return A random uint64 value
    function randUint64() internal returns (uint64) {
        return uint64(uint256(nextBytes32()));
    }

    /// @notice Generate a random uint256 value within a specified range
    /// @param min The minimum value (inclusive)
    /// @param max The maximum value (exclusive)
    /// @return A random uint256 value between min and max
    /// @dev The result is uniformly distributed between min and max, with a slight bias toward lower numbers.
    /// @dev This bias is insignificant as long as (max - min) << MAX_UINT256.
    function randUintRange(
        uint256 min,
        uint256 max
    ) internal returns (uint256) {
        require(max > min, "Max must be greater than min");
        return (randUint() % (max - min)) + min;
    }

    /// @notice Generate a random permutation of a sequence
    /// @param length The length of the sequence to permute
    /// @return A randomly permuted array of uint256 values
    function randomPermutation(
        uint256 length
    ) internal returns (uint256[] memory) {
        uint256[] memory permutation = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            permutation[i] = i;
        }
        for (uint256 i = 0; i < length; i++) {
            uint256 j = i + (randUint() % (length - i));
            (permutation[i], permutation[j]) = (permutation[j], permutation[i]);
        }
        return permutation;
    }
}
