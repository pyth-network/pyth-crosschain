//! This module deals with verification of Merkle Tree proofs.
//!
//! The tree and the proofs can be generated using `OpenZeppelin`'s
//! [merkle tree library](https://github.com/OpenZeppelin/merkle-tree). You will
//! find a quickstart guide in its README.
//!
//! WARNING: You should avoid using leaf values that are 64 bytes long
//! prior to hashing, or use a hash function other than keccak256 for
//! hashing leaves. This is because the concatenation of a sorted pair
//! of internal nodes in the Merkle tree could be reinterpreted as a
//! leaf value. `OpenZeppelin`'s JavaScript library generates Merkle trees
//! that are safe against this attack out of the box.
use alloc::vec::Vec;
use core::marker::PhantomData;

use crate::{
    hash::{commutative_hash_pair, BuildHasher, Hasher},
    KeccakBuilder,
};

type Bytes32 = [u8; 32];

/// Verify merkle proofs.
pub struct Verifier<B = KeccakBuilder>(PhantomData<B>)
where
    B: BuildHasher;

impl Verifier<KeccakBuilder> {
    /// Verify that `leaf` is part of a Merkle tree defined by `root` by using
    /// `proof` and the default `keccak256` hashing algorithm.
    ///
    /// A new root is rebuilt by traversing up the Merkle tree. The `proof`
    /// provided must contain sibling hashes on the branch starting from the
    /// leaf to the root of the tree. Each pair of leaves and each pair of
    /// pre-images are assumed to be sorted.
    ///
    /// A `proof` is valid if and only if the rebuilt hash matches the root
    /// of the tree.
    ///
    /// # Arguments
    ///
    /// * `proof` - A slice of hashes that constitute the merkle proof.
    /// * `root` - The root of the merkle tree, in bytes.
    /// * `leaf` - The leaf of the merkle tree to proof, in bytes.
    ///
    /// # Examples
    ///
    /// ```
    /// use openzeppelin_crypto::merkle::Verifier;
    /// use hex_literal::hex;
    ///
    /// let root  = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    /// let leaf  = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    /// let proof = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    ///
    /// let verification = Verifier::verify(&[proof], root, leaf);
    /// assert!(!verification);
    /// ```
    #[must_use]
    pub fn verify(proof: &[Bytes32], root: Bytes32, leaf: Bytes32) -> bool {
        Verifier::verify_with_builder(proof, root, leaf, &KeccakBuilder)
    }

    /// Verify multiple `leaves` can be simultaneously proven to be a part of
    /// a Merkle tree defined by `root` by using a `proof` with `proof_flags`
    /// and a `hasher`.
    ///
    /// The `proof` must contain the sibling hashes one would need to rebuild
    /// the root starting from `leaves`. `proof_flags` represents whether a
    /// hash must be computed using a `proof` member. A new root is rebuilt by
    /// starting from the `leaves` and traversing up the Merkle tree.
    ///
    /// The procedure incrementally reconstructs all inner nodes by combining
    /// a leaf/inner node with either another leaf/inner node or a `proof`
    /// sibling node, depending on each proof flag being true or false
    /// respectively, i.e., the `i`-th hash must be computed using the proof if
    /// `proof_flags[i] == false`.
    ///
    /// CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs,
    /// it is sufficient to ensure that:
    /// - The tree is complete (but not necessarily perfect).
    /// - The leaves to be proven are in the opposite order they appear in the
    ///   tree (i.e., as seen from right to left starting at the deepest layer
    ///   and continuing at the next layer).
    ///
    /// NOTE: This implementation is *not* equivalent to it's Solidity
    /// counterpart. In Rust, access to uninitialized memory panics, which
    /// means we don't need to check that the whole proof array has been
    /// processed. Both implementations will revert for the same inputs, but
    /// for different reasons. See <https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-wprv-93r4-jj2p>
    ///
    /// # Arguments
    ///
    /// * `proof` - A slice of hashes that constitute the merkle proof.
    /// * `proof_flags` - A slice of booleans that determine whether to hash
    ///   leaves or the proof.
    /// * `root` - The root of the merkle tree, in bytes.
    /// * `leaves` - A slice of hashes that constitute the leaves of the merkle
    ///   tree to be proven, each leaf in bytes.
    ///
    /// # Errors
    ///
    /// Will return `Err` if the arguments are well-formed, but invalid.
    ///
    /// # Panics
    ///
    /// Will panic with an out-of-bounds error if the proof is malicious. See
    /// <https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-wprv-93r4-jj2p>
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openzeppelin_crypto::merkle::Verifier;
    /// use hex_literal::hex;
    ///
    /// let root   =  hex!("6deb52b5da8fd108f79fab00341f38d2587896634c646ee52e49f845680a70c8");
    /// let leaves = [hex!("19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681"),
    ///               hex!("c62a8cfa41edc0ef6f6ae27a2985b7d39c7fea770787d7e104696c6e81f64848"),
    ///               hex!("eba909cf4bb90c6922771d7f126ad0fd11dfde93f3937a196274e1ac20fd2f5b")];
    /// let proof  = [hex!("9a4f64e953595df82d1b4f570d34c4f4f0cfaf729a61e9d60e83e579e1aa283e"),
    ///               hex!("8076923e76cf01a7c048400a2304c9a9c23bbbdac3a98ea3946340fdafbba34f")];
    ///
    /// let proof_flags = [false, true, false, true];
    ///
    /// let verification =
    ///     Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
    /// assert!(verification.unwrap());
    /// ```
    pub fn verify_multi_proof(
        proof: &[Bytes32],
        proof_flags: &[bool],
        root: Bytes32,
        leaves: &[Bytes32],
    ) -> Result<bool, MultiProofError> {
        Verifier::verify_multi_proof_with_builder(
            proof,
            proof_flags,
            root,
            leaves,
            &KeccakBuilder,
        )
    }
}

impl<B> Verifier<B>
where
    B: BuildHasher,
    B::Hasher: Hasher<Output = Bytes32>,
{
    /// Verify that `leaf` is part of a Merkle tree defined by `root` by using
    /// `proof` and a custom hashing algorithm defined by `builder`. See
    /// [`BuildHasher`] for more information on how to construct a builder.
    ///
    /// WARNING: This is a lower-level function. For most use cases,
    /// [`Verifier::verify`], which uses `keccak256` as a hashing algorithm,
    /// should be enough. Using other hashing algorithm may have unexpected
    /// results.
    ///
    /// # Arguments
    ///
    /// * `proof` - A slice of hashes that constitute the merkle proof.
    /// * `root` - The root of the merkle tree, in bytes.
    /// * `leaf` - The leaf of the merkle tree to proof, in bytes.
    /// * `builder` - A [`BuildHasher`] that represents a hashing algorithm.
    ///
    /// # Examples
    ///
    /// ```
    /// use openzeppelin_crypto::{merkle::Verifier, KeccakBuilder};
    /// use hex_literal::hex;
    ///
    /// let root  = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    /// let leaf  = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    /// let proof = hex!("0000000000000000000000000000000000000000000000000000000000000000");
    ///
    /// let verification = Verifier::verify_with_builder(&[proof], root, leaf, &KeccakBuilder);
    /// assert!(!verification);
    /// ```
    pub fn verify_with_builder(
        proof: &[Bytes32],
        root: Bytes32,
        mut leaf: Bytes32,
        builder: &B,
    ) -> bool {
        for &hash in proof {
            leaf = commutative_hash_pair(leaf, hash, builder.build_hasher());
        }

        leaf == root
    }

    /// Verify multiple `leaves` can be simultaneously proven to be a part of
    /// a Merkle tree defined by `root` by using a `proof` with `proof_flags`
    /// and a custom hashing algorithm defined by `builder`. See
    /// [`BuildHasher`] for more information on how to construct a builder.
    ///
    /// WARNING: This is a lower-level function. For most use cases,
    /// [`Verifier::verify_multi_proof`], which uses `keccak256` as a hashing
    /// algorithm, should be enough. Using other hashing algorithm may have
    /// unexpected results.
    ///
    /// The `proof` must contain the sibling hashes one would need to rebuild
    /// the root starting from `leaves`. `proof_flags` represents whether a
    /// hash must be computed using a `proof` member. A new root is rebuilt by
    /// starting from the `leaves` and traversing up the Merkle tree.
    ///
    /// The procedure incrementally reconstructs all inner nodes by combining
    /// a leaf/inner node with either another leaf/inner node or a `proof`
    /// sibling node, depending on each proof flag being true or false
    /// respectively, i.e., the `i`-th hash must be computed using the proof if
    /// `proof_flags[i] == false`.
    ///
    /// CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs,
    /// it is sufficient to ensure that:
    /// - The tree is complete (but not necessarily perfect).
    /// - The leaves to be proven are in the opposite order they appear in the
    ///   tree (i.e., as seen from right to left starting at the deepest layer
    ///   and continuing at the next layer).
    ///
    /// NOTE: This implementation is *not* equivalent to it's Solidity
    /// counterpart. In Rust, access to uninitialized memory panics, which
    /// means we don't need to check that the whole proof array has been
    /// processed. Both implementations will revert for the same inputs, but
    /// for different reasons. See <https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-wprv-93r4-jj2p>
    ///
    /// # Arguments
    ///
    /// * `proof` - A slice of hashes that constitute the merkle proof.
    /// * `proof_flags` - A slice of booleans that determine whether to hash
    ///   leaves or the proof.
    /// * `root` - The root of the merkle tree, in bytes.
    /// * `leaves` - A slice of hashes that constitute the leaves of the merkle
    ///   tree to be proven, each leaf in bytes.
    /// * `builder` - A [`BuildHasher`] that represents a hashing algorithm.
    ///
    /// # Errors
    ///
    /// Will return `Err` if the arguments are well-formed, but invalid.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openzeppelin_crypto::{merkle::Verifier, KeccakBuilder};
    /// use hex_literal::hex;
    ///
    /// let root   =  hex!("6deb52b5da8fd108f79fab00341f38d2587896634c646ee52e49f845680a70c8");
    /// let leaves = [hex!("19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681"),
    ///               hex!("c62a8cfa41edc0ef6f6ae27a2985b7d39c7fea770787d7e104696c6e81f64848"),
    ///               hex!("eba909cf4bb90c6922771d7f126ad0fd11dfde93f3937a196274e1ac20fd2f5b")];
    /// let proof  = [hex!("9a4f64e953595df82d1b4f570d34c4f4f0cfaf729a61e9d60e83e579e1aa283e"),
    ///               hex!("8076923e76cf01a7c048400a2304c9a9c23bbbdac3a98ea3946340fdafbba34f")];
    /// let proof_flags = [false, true, false, true];
    ///
    /// let verification =
    ///     Verifier::verify_multi_proof_with_builder(&proof, &proof_flags, root, &leaves, &KeccakBuilder);
    /// assert!(verification.unwrap());
    /// ```
    pub fn verify_multi_proof_with_builder(
        proof: &[Bytes32],
        proof_flags: &[bool],
        root: Bytes32,
        leaves: &[Bytes32],
        builder: &B,
    ) -> Result<bool, MultiProofError> {
        let total_hashes = proof_flags.len();
        if leaves.len() + proof.len() != total_hashes + 1 {
            return Err(MultiProofError::InvalidTotalHashes);
        }
        if total_hashes == 0 {
            // We can safely assume that either `leaves` or `proof` is not empty
            // given the previous check. We use `unwrap_or_else` to avoid
            // eagerly evaluating `proof[0]`, which may panic.
            let rebuilt_root = *leaves.first().unwrap_or_else(|| &proof[0]);
            return Ok(root == rebuilt_root);
        }

        // `hashes` represents a queue of hashes, our "main queue".
        let mut hashes = Vec::with_capacity(total_hashes + leaves.len());
        // Which initially gets populated with the leaves.
        hashes.extend(leaves);
        // The `xxx_pos` values are "pointers" to the next value to consume in
        // each queue. We use them to mimic a queue's pop operation.
        let mut proof_pos = 0;
        let mut hashes_pos = 0;
        // At each step, we compute the next hash using two values:
        // - A value from the "main queue". Consume all the leaves, then all the
        //   hashes but the root.
        // - A value from the "main queue" (merging branches) or a member of the
        //   `proof`, depending on `flag`.
        for &flag in proof_flags {
            let a = hashes[hashes_pos];
            hashes_pos += 1;

            let b;
            if flag {
                b = hashes
                    .get(hashes_pos)
                    .ok_or(MultiProofError::InvalidRootChild)?;
                hashes_pos += 1;
            } else {
                b = proof
                    .get(proof_pos)
                    .ok_or(MultiProofError::InvalidProofLength)?;
                proof_pos += 1;
            };

            let hash = commutative_hash_pair(a, *b, builder.build_hasher());
            hashes.push(hash);
        }

        // We know that `total_hashes > 0`.
        let rebuilt_root = hashes[total_hashes + leaves.len() - 1];
        Ok(root == rebuilt_root)
    }
}

/// An error that occurred while verifying a multi-proof.
///
/// TODO: Once <https://github.com/rust-lang/rust/issues/103765> is resolved,
/// we should derive `core::error::Error`.
#[derive(core::fmt::Debug)]
pub enum MultiProofError {
    /// The proof length does not match the flags.
    InvalidProofLength,
    /// Tried to access uninitialized memory.
    ///
    /// This happens when the proof is too long, which makes the verification
    /// procedure try to access uninitialized memory, which may result in an
    /// invalid root.
    ///
    /// For more information see [this vulnerability].
    ///
    /// [this vulnerability]: https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories/GHSA-wprv-93r4-jj2p
    InvalidRootChild,
    /// The number of leaves and proof members does not match the number of
    /// hashes necessary to complete the verification.
    InvalidTotalHashes,
}

impl core::fmt::Display for MultiProofError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let msg = match self {
            MultiProofError::InvalidProofLength => "invalid multi-proof length",
            MultiProofError::InvalidRootChild => "invalid root child generated",
            MultiProofError::InvalidTotalHashes => {
                "leaves.len() + proof.len() != total_hashes + 1"
            }
        };

        write!(f, "{msg}")
    }
}

#[cfg(all(test, feature = "std"))]
mod tests {
    //! NOTE: The values used as input for these tests were all generated using
    //! https://github.com/OpenZeppelin/merkle-tree.
    use hex_literal::hex;
    use rand::{thread_rng, RngCore};

    use super::{Bytes32, KeccakBuilder, Verifier};
    use crate::hash::{commutative_hash_pair, BuildHasher};

    /// Shorthand for declaring variables converted from a hex literal to a
    /// fixed 32-byte slice.
    macro_rules! bytes {
        ($($var:ident = $hex:literal);* $(;)?) => {
            $(
                #[allow(non_upper_case_globals)]
                const $var: Bytes32 = hex!($hex);
            )*
        };
    }

    /// Shorthand for converting from an array of hex literals to an array of
    /// fixed 32-bytes slices.
    macro_rules! bytes_array {
        ($($s:literal),* $(,)?) => {
            [
              $(hex!($s),)*
            ]
        };
    }

    #[test]
    fn verifies_valid_proofs() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(
        //   toElements('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='),
        //   ['string'],
        // );
        //
        // const root  = merkleTree.root;
        // const hash  = merkleTree.leafHash(['A']);
        // const proof = merkleTree.getProof(['A']);
        // ```
        bytes! {
            root   = "b89eb120147840e813a77109b44063488a346b4ca15686185cf314320560d3f3";
            leaf_a = "6efbf77e320741a027b50f02224545461f97cd83762d5fbfeb894b9eb3287c16";
            leaf_b = "7051e21dd45e25ed8c605a53da6f77de151dcbf47b0e3ced3c5d8b61f4a13dbc";
        };
        let proof = bytes_array! {
            "7051e21dd45e25ed8c605a53da6f77de151dcbf47b0e3ced3c5d8b61f4a13dbc",
            "1629d3b5b09b30449d258e35bbd09dd5e8a3abb91425ef810dc27eef995f7490",
            "633d21baee4bbe5ed5c51ac0c68f7946b8f28d2937f0ca7ef5e1ea9dbda52e7a",
            "8a65d3006581737a3bab46d9e4775dbc1821b1ea813d350a13fcd4f15a8942ec",
            "d6c3f3e36cd23ba32443f6a687ecea44ebfe2b8759a62cccf7759ec1fb563c76",
            "276141cd72b9b81c67f7182ff8a550b76eb96de9248a3ec027ac048c79649115",
        };

        let verification = Verifier::verify(&proof, root, leaf_a);
        assert!(verification);

        let builder = KeccakBuilder.build_hasher();
        let no_such_leaf = commutative_hash_pair(leaf_a, leaf_b, builder);
        let proof = &proof[1..];
        let verification = Verifier::verify(proof, root, no_such_leaf);
        assert!(verification);
    }

    #[test]
    fn rejects_invalid_proofs() {
        // ```js
        // const correctMerkleTree = StandardMerkleTree.of(toElements('abc'), ['string']);
        // const otherMerkleTree = StandardMerkleTree.of(toElements('def'), ['string']);
        //
        // const root = correctMerkleTree.root;
        // const leaf = correctMerkleTree.leafHash(['a']);
        // const proof = otherMerkleTree.getProof(['d']);
        // ```
        bytes! {
            root  = "f2129b5a697531ef818f644564a6552b35c549722385bc52aa7fe46c0b5f46b1";
            leaf  = "9c15a6a0eaeed500fd9eed4cbeab71f797cefcc67bfd46683e4d2e6ff7f06d1c";
            proof = "7b0c6cd04b82bfc0e250030a5d2690c52585e0cc6a4f3bc7909d7723b0236ece";
        };

        let verification = Verifier::verify(&[proof], root, leaf);
        assert!(!verification);
    }

    #[test]
    fn rejects_proofs_with_invalid_length() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abc'), ['string']);
        //
        // const root = merkleTree.root;
        // const leaf = merkleTree.leafHash(['a']);
        // const proof = merkleTree.getProof(['a']);
        // ```
        bytes! {
            root = "f2129b5a697531ef818f644564a6552b35c549722385bc52aa7fe46c0b5f46b1";
            leaf = "9c15a6a0eaeed500fd9eed4cbeab71f797cefcc67bfd46683e4d2e6ff7f06d1c";
        };
        let proof = bytes_array! {
            "19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681",
            "9cf5a63718145ba968a01c1d557020181c5b252f665cf7386d370eddb176517b",
        };

        let bad_proof = &proof[..1];
        let verification = Verifier::verify(bad_proof, root, leaf);
        assert!(!verification);
    }

    #[test]
    fn verifies_valid_multi_proof() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abcdef'), ['string']);
        //
        // const root = merkleTree.root;
        // const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toElements('bdf'));
        // const hashes = leaves.map(e => merkleTree.leafHash(e));
        // ```
        bytes! {
            root = "6deb52b5da8fd108f79fab00341f38d2587896634c646ee52e49f845680a70c8";
        };
        let leaves = bytes_array! {
            "19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681",
            "c62a8cfa41edc0ef6f6ae27a2985b7d39c7fea770787d7e104696c6e81f64848",
            "eba909cf4bb90c6922771d7f126ad0fd11dfde93f3937a196274e1ac20fd2f5b",
        };
        let proof = bytes_array! {
            "9a4f64e953595df82d1b4f570d34c4f4f0cfaf729a61e9d60e83e579e1aa283e",
            "8076923e76cf01a7c048400a2304c9a9c23bbbdac3a98ea3946340fdafbba34f",
        };

        let proof_flags = [false, true, false, true];
        let verification =
            Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
        assert!(verification.unwrap());
    }

    #[test]
    fn rejects_invalid_multi_proof() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abcdef'), ['string']);
        // const otherMerkleTree = StandardMerkleTree.of(toElements('ghi'), ['string']);
        //
        // const root = merkleTree.root;
        // const { proof, proofFlags, leaves } = otherMerkleTree.getMultiProof(toElements('ghi'));
        // const hashes = leaves.map(e => merkleTree.leafHash(e));
        // ```
        bytes! {
            root = "6deb52b5da8fd108f79fab00341f38d2587896634c646ee52e49f845680a70c8";
        };
        let leaves = bytes_array! {
            "34e6ce3d0d73f6bff2ee1e865833d58e283570976d70b05f45c989ef651ef742",
            "aa28358fb75b314c899e16d7975e029d18b4457fd8fd831f2e6c17ffd17a1d7e",
            "e0fd7e6916ff95d933525adae392a17e247819ebecc2e63202dfec7005c60560",
        };
        let proof = [];
        let proof_flags = [true, true];

        let verification =
            Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
        assert!(!verification.unwrap());
    }

    #[test]
    fn errors_invalid_multi_proof_leaves() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abcd'), ['string']);
        //
        // const root = merkleTree.root;
        // const hashA = merkleTree.leafHash(['a']);
        // const hashB = merkleTree.leafHash(['b']);
        // const hashCD = hashPair(
        //   ethers.toBeArray(merkleTree.leafHash(['c'])),
        //   ethers.toBeArray(merkleTree.leafHash(['d'])),
        // );
        // const hashE = merkleTree.leafHash(['e']); // incorrect (not part of the tree)
        // const fill = ethers.randomBytes(32);
        // ```
        bytes! {
            root    = "8f7234e8cfe39c08ca84a3a3e3274f574af26fd15165fe29e09cbab742daccd9";
            hash_a  = "9c15a6a0eaeed500fd9eed4cbeab71f797cefcc67bfd46683e4d2e6ff7f06d1c";
            hash_b  = "19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681";
            hash_cd = "03707d7802a71ca56a8ad8028da98c4f1dbec55b31b4a25d536b5309cc20eda9";
            hash_e  = "9a4f64e953595df82d1b4f570d34c4f4f0cfaf729a61e9d60e83e579e1aa283e";
        };

        let mut random_bytes = [0u8; 32];
        thread_rng().fill_bytes(&mut random_bytes);

        let fill = Bytes32::from(random_bytes);
        let proof = [hash_b, fill, hash_cd];
        let proof_flags = [false, false, false];
        let leaves = [hash_a, hash_e];

        let verification =
            Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
        assert!(verification.is_err());
    }

    #[test]
    fn errors_multi_proof_len_invalid() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abcd'), ['string']);
        //
        // const root = merkleTree.root;
        // const hashA = merkleTree.leafHash(['a']);
        // const hashB = merkleTree.leafHash(['b']);
        // const hashCD = hashPair(
        //   ethers.toBeArray(merkleTree.leafHash(['c'])),
        //   ethers.toBeArray(merkleTree.leafHash(['d'])),
        // );
        // const hashE = merkleTree.leafHash(['e']); // incorrect (not part of the tree)
        // const fill = ethers.randomBytes(32);
        // ```
        bytes! {
            root    = "8f7234e8cfe39c08ca84a3a3e3274f574af26fd15165fe29e09cbab742daccd9";
            hash_a  = "9c15a6a0eaeed500fd9eed4cbeab71f797cefcc67bfd46683e4d2e6ff7f06d1c";
            hash_b  = "19ba6c6333e0e9a15bf67523e0676e2f23eb8e574092552d5e888c64a4bb3681";
            hash_cd = "03707d7802a71ca56a8ad8028da98c4f1dbec55b31b4a25d536b5309cc20eda9";
            hash_e  = "9a4f64e953595df82d1b4f570d34c4f4f0cfaf729a61e9d60e83e579e1aa283e";
        };

        let mut random_bytes = [0u8; 32];
        thread_rng().fill_bytes(&mut random_bytes);

        let fill = Bytes32::from(random_bytes);
        let proof = [hash_b, fill, hash_cd];
        let proof_flags = [false, false, false, false];
        let leaves = [hash_e, hash_a];

        let verification =
            Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
        assert!(verification.is_err());
    }

    #[test]
    fn verifies_single_leaf_multi_proof() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('a'), ['string']);
        //
        // const root = merkleTree.root;
        // const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toElements('a'));
        // const hashes = leaves.map(e => merkleTree.leafHash(e));
        // ```
        bytes!(root = "9c15a6a0eaeed500fd9eed4cbeab71f797cefcc67bfd46683e4d2e6ff7f06d1c");
        let proof = [];
        let proof_flags = [];
        let leaves = [root];

        let verification = Verifier::<KeccakBuilder>::verify_multi_proof(
            &proof,
            &proof_flags,
            root,
            &leaves,
        );
        assert!(verification.unwrap());
    }

    #[test]
    fn verifies_empty_leaves_multi_proof() {
        // ```js
        // const merkleTree = StandardMerkleTree.of(toElements('abcd'), ['string']);
        //
        // const root = merkleTree.root;
        // ```
        bytes!(root = "8f7234e8cfe39c08ca84a3a3e3274f574af26fd15165fe29e09cbab742daccd9");
        let proof = [root];
        let proof_flags = [];
        let leaves = [];

        let verification =
            Verifier::verify_multi_proof(&proof, &proof_flags, root, &leaves);
        assert!(verification.unwrap());
    }

    #[test]
    /// Errors when processing manipulated proofs with a zero-value node at
    /// depth 1.
    fn errors_manipulated_multi_proof() {
        // ```js
        // // Create a merkle tree that contains a zero leaf at depth 1
        // const leave = ethers.id('real leaf');
        // const root = hashPair(ethers.toBeArray(leave), Buffer.alloc(32, 0));
        //
        // // Now we can pass any **malicious** fake leaves as valid!
        // const maliciousLeaves = ['malicious', 'leaves'].map(ethers.id)
        //                          .map(ethers.toBeArray).sort(Buffer.compare);
        // const maliciousProof = [leave, leave];
        // const maliciousProofFlags = [true, true, false];
        // ```
        bytes! {
            root = "f2d552e1e4c59d4f0fa2b80859febc9e4bdc915dff37c56c858550d8b64659a5";
            leaf = "5e941ddd8f313c0b39f92562c0eca709c3d91360965d396aaef584b3fa76889a";
        };
        let malicious_leaves = bytes_array! {
            "1f23ad5fc0ee6ccbe2f3d30df856758f05ad9d03408a51a99c1c9f0854309db2",
            "613994f4e324d0667c07857cd5d147994bc917da5d07ee63fc3f0a1fe8a18e34",
        };
        let malicious_proof = [leaf, leaf];
        let malicious_proof_flags = [true, true, false];

        let verification = Verifier::verify_multi_proof(
            &malicious_proof,
            &malicious_proof_flags,
            root,
            &malicious_leaves,
        );
        assert!(verification.is_err());
    }
}
