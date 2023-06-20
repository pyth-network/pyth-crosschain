// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./external/UnsafeCalldataBytesLib.sol";

/**
 * @dev This library provides methods to construct and verify Merkle Tree proofs efficiently.
 *
 */

library MerkleTree {
    uint8 constant MERKLE_LEAF_PREFIX = 0;
    uint8 constant MERKLE_NODE_PREFIX = 1;
    uint8 constant MERKLE_EMPTY_LEAF_PREFIX = 2;

    function hash(bytes memory input) internal pure returns (bytes20) {
        return bytes20(keccak256(input));
    }

    function emptyLeafHash() internal pure returns (bytes20) {
        return hash(abi.encodePacked(MERKLE_EMPTY_LEAF_PREFIX));
    }

    function leafHash(bytes memory data) internal pure returns (bytes20) {
        return hash(abi.encodePacked(MERKLE_LEAF_PREFIX, data));
    }

    function nodeHash(
        bytes20 childA,
        bytes20 childB
    ) internal pure returns (bytes20) {
        if (childA > childB) {
            (childA, childB) = (childB, childA);
        }
        return hash(abi.encodePacked(MERKLE_NODE_PREFIX, childA, childB));
    }

    /// @notice Verify Merkle Tree proof for given leaf data based on data on memory.
    /// @dev To optimize gas usage, this method doesn't take the proof as a bytes array
    /// but rather takes the encoded proof and the offset of the proof in the
    /// encoded proof array possibly containing multiple proofs. Also, the method
    /// does not perform any check on the boundry of the `encodedProof` and  the
    /// `proofOffset` parameters. It is the caller's responsibility to ensure
    /// that the `encodedProof` is long enough to contain the proof and the
    /// `proofOffset` is not out of bound.
    function isProofValid(
        bytes calldata encodedProof,
        uint proofOffset,
        bytes20 root,
        bytes calldata leafData
    ) internal pure returns (bool valid, uint endOffset) {
        unchecked {
            bytes20 currentDigest = MerkleTree.leafHash(leafData);

            uint8 proofSize = UnsafeCalldataBytesLib.toUint8(
                encodedProof,
                proofOffset
            );
            proofOffset += 1;

            for (uint i = 0; i < proofSize; i++) {
                bytes20 siblingDigest = bytes20(
                    UnsafeCalldataBytesLib.toAddress(encodedProof, proofOffset)
                );
                proofOffset += 20;

                currentDigest = MerkleTree.nodeHash(
                    currentDigest,
                    siblingDigest
                );
            }

            valid = currentDigest == root;
            endOffset = proofOffset;
        }
    }

    /// @notice Construct Merkle Tree proofs for given list of messages.
    /// @dev This function is only used for testing purposes and is not efficient
    /// for production use-cases.
    ///
    /// This method creates a merkle tree with leaf size of (2^depth) with the
    /// messages as leafs (in the same given order) and returns the root digest
    /// and the proofs for each message. If the number of messages is not a power
    /// of 2, the tree is padded with empty messages.
    function constructProofs(
        bytes[] memory messages,
        uint8 depth
    ) internal pure returns (bytes20 root, bytes[] memory proofs) {
        require((1 << depth) >= messages.length, "depth too small");

        bytes20[] memory tree = new bytes20[]((1 << (depth + 1)));

        // The tree is structured as follows:
        // 1
        // 2 3
        // 4 5 6 7
        // ...
        // In this structure the parent of node x is x//2 and the children
        // of node x are x*2 and x*2 + 1. Also, the sibling of the node x
        // is x^1. The root is at index 1 and index 0 is not used.

        // Filling the leaf hashes
        bytes20 cachedEmptyLeafHash = emptyLeafHash();

        for (uint i = 0; i < (1 << depth); i++) {
            if (i < messages.length) {
                tree[(1 << depth) + i] = leafHash(messages[i]);
            } else {
                tree[(1 << depth) + i] = cachedEmptyLeafHash;
            }
        }

        // Filling the node hashes from bottom to top
        for (uint k = depth; k > 0; k--) {
            uint level = k - 1;
            uint levelNumNodes = (1 << level);
            for (uint i = 0; i < levelNumNodes; i++) {
                uint id = (1 << level) + i;
                tree[id] = nodeHash(tree[id * 2], tree[id * 2 + 1]);
            }
        }

        root = tree[1];

        proofs = new bytes[](messages.length);

        for (uint i = 0; i < messages.length; i++) {
            // depth is the number of sibling nodes in the path from the leaf to the root
            proofs[i] = abi.encodePacked(depth);

            uint idx = (1 << depth) + i;

            // This loop iterates through the leaf and its parents
            // and keeps adding the sibling of the current node to the proof.
            while (idx > 1) {
                proofs[i] = abi.encodePacked(
                    proofs[i],
                    tree[idx ^ 1] // Sibling of this node
                );

                // Jump to parent
                idx /= 2;
            }
        }
    }
}
