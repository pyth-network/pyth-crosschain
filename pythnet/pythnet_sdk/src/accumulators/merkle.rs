//! A MerkleTree based Accumulator.

use {
    crate::{
        accumulators::Accumulator,
        hashers::{keccak256::Keccak256, Hasher},
    },
    borsh::{BorshDeserialize, BorshSerialize},
    serde::{Deserialize, Serialize},
};

// We need to discern between leaf and intermediate nodes to prevent trivial second pre-image
// attacks. If we did not do this it would be possible for an attacker to intentionally create
// non-leaf nodes that have the same hash as a leaf node, and then use that to prove the existence
// of a leaf node that does not exist.
//
// See:
//
// - https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack
// - https://en.wikipedia.org/wiki/Merkle_tree#Second_preimage_attack
//
// NOTE: We use a NULL prefix for leaf nodes to distinguish them from the empty message (""), while
// there is no path that allows empty messages this is a safety measure to prevent future
// vulnerabilities being introduced.
const LEAF_PREFIX: &[u8] = &[0];
const NODE_PREFIX: &[u8] = &[1];
const NULL_PREFIX: &[u8] = &[2];

/// A MerklePath contains a list of hashes that form a proof for membership in a tree.
#[derive(
    Clone,
    Default,
    Debug,
    Hash,
    PartialEq,
    Eq,
    Serialize,
    Deserialize,
    BorshSerialize,
    BorshDeserialize,
)]
pub struct MerklePath<H: Hasher>(Vec<H::Hash>);

/// A MerkleRoot contains the root hash of a MerkleTree.
#[derive(
    Clone,
    Default,
    Debug,
    Hash,
    PartialEq,
    Eq,
    Serialize,
    Deserialize,
    BorshSerialize,
    BorshDeserialize,
)]
pub struct MerkleRoot<H: Hasher>(H::Hash);

/// A MerkleTree is a binary tree where each node is the hash of its children.
#[derive(
    Debug, Clone, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize, Default,
)]
pub struct MerkleTree<H: Hasher = Keccak256> {
    pub root: MerkleRoot<H>,

    #[serde(skip)]
    #[borsh_skip]
    pub nodes: Vec<H::Hash>,
}

/// Implements functionality for using standalone MerkleRoots.
impl<H: Hasher> MerkleRoot<H> {
    /// Construct a MerkleRoot from an existing Hash.
    pub fn new(root: H::Hash) -> Self {
        Self(root)
    }

    /// Given a item and corresponding MerklePath, check that it is a valid membership proof.
    pub fn check(&self, proof: MerklePath<H>, item: &[u8]) -> bool {
        let mut current: <H as Hasher>::Hash = MerkleTree::<H>::hash_leaf(item);
        for hash in proof.0 {
            current = MerkleTree::<H>::hash_node(&current, &hash);
        }
        current == self.0
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.0.as_ref()
    }
}

/// Implements functionality for working with MerklePath (proofs).
impl<H: Hasher> MerklePath<H> {
    /// Given a Vector of hashes representing a merkle proof, construct a MerklePath.
    pub fn new(path: Vec<H::Hash>) -> Self {
        Self(path)
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        self.0
            .iter()
            .flat_map(|hash| hash.as_ref().to_vec())
            .collect()
    }

    pub fn to_vec(&self) -> Vec<H::Hash> {
        self.0.clone()
    }
}

/// Presents an Accumulator friendly interface for MerkleTree.
impl<'a, H: Hasher + 'a> Accumulator<'a> for MerkleTree<H> {
    type Proof = MerklePath<H>;

    /// Construct a MerkleTree from an iterator of items.
    fn from_set(items: impl Iterator<Item = &'a [u8]>) -> Option<Self> {
        let items: Vec<&[u8]> = items.collect();
        Self::new(&items)
    }

    /// Prove an item is in the tree by returning a MerklePath.
    fn prove(&'a self, item: &[u8]) -> Option<Self::Proof> {
        let item = MerkleTree::<H>::hash_leaf(item);
        let index = self.nodes.iter().position(|i| i == &item)?;
        Some(self.find_path(index))
    }

    // NOTE: This `check` call is intended to fit the generic accumulator implementation, but for a
    // merkle tree the proof does not usually need the `self` parameter as the proof is standalone
    // and doesn't need the original nodes.
    fn check(&'a self, proof: Self::Proof, item: &[u8]) -> bool {
        self.verify_path(proof, item)
    }
}

/// Implement a MerkleTree-specific interface for interacting with trees.
impl<H: Hasher> MerkleTree<H> {
    /// Construct a new MerkleTree from a list of byte slices.
    ///
    /// This list does not have to be a set which means the tree may contain duplicate items. It is
    /// up to the caller to enforce a strict set-like object if that is desired.
    pub fn new(items: &[&[u8]]) -> Option<Self> {
        if items.is_empty() {
            return None;
        }

        let depth = items.len().next_power_of_two().trailing_zeros();
        let mut tree: Vec<H::Hash> = vec![Default::default(); 1 << (depth + 1)];

        // Filling the leaf hashes
        for i in 0..(1 << depth) {
            if i < items.len() {
                tree[(1 << depth) + i] = MerkleTree::<H>::hash_leaf(items[i]);
            } else {
                tree[(1 << depth) + i] = MerkleTree::<H>::hash_null();
            }
        }

        // Filling the node hashes from bottom to top
        for k in (1..=depth).rev() {
            let level = k - 1;
            let level_num_nodes = 1 << level;
            for i in 0..level_num_nodes {
                let id = (1 << level) + i;
                tree[id] = MerkleTree::<H>::hash_node(&tree[id * 2], &tree[id * 2 + 1]);
            }
        }

        Some(Self {
            root: MerkleRoot::new(tree[1]),
            nodes: tree,
        })
    }

    /// Produces a Proof of membership for an index in the tree.
    pub fn find_path(&self, mut index: usize) -> MerklePath<H> {
        let mut path = Vec::new();
        while index > 1 {
            path.push(self.nodes[index ^ 1]);
            index /= 2;
        }
        MerklePath::new(path)
    }

    /// Check if a given MerklePath is a valid proof for a corresponding item.
    pub fn verify_path(&self, proof: MerklePath<H>, item: &[u8]) -> bool {
        self.root.check(proof, item)
    }

    #[inline]
    pub fn hash_leaf(leaf: &[u8]) -> H::Hash {
        H::hashv(&[LEAF_PREFIX, leaf])
    }

    #[inline]
    pub fn hash_node(l: &H::Hash, r: &H::Hash) -> H::Hash {
        H::hashv(&[
            NODE_PREFIX,
            (if l <= r { l } else { r }).as_ref(),
            (if l <= r { r } else { l }).as_ref(),
        ])
    }

    #[inline]
    pub fn hash_null() -> H::Hash {
        H::hashv(&[NULL_PREFIX])
    }

    /// Serialize a MerkleTree into a Vec<u8>.
    ///
    ///Layout:
    ///
    /// ```rust,ignore
    /// 4 bytes:  magic number
    /// 1 byte:   update type
    /// 4 byte:   storage id
    /// 32 bytes: root hash
    /// ```
    ///
    /// TODO: This code does not belong to MerkleTree, we should be using the wire data types in
    /// calling code to wrap this value.
    pub fn serialize(&self, slot: u64, ring_size: u32) -> Vec<u8> {
        let mut serialized = vec![];
        serialized.extend_from_slice(0x41555756u32.to_be_bytes().as_ref());
        serialized.extend_from_slice(0u8.to_be_bytes().as_ref());
        serialized.extend_from_slice(slot.to_be_bytes().as_ref());
        serialized.extend_from_slice(ring_size.to_be_bytes().as_ref());
        serialized.extend_from_slice(self.root.0.as_ref());
        serialized
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        proptest::prelude::*,
        std::{collections::BTreeSet, mem::size_of},
    };

    #[derive(Default, Clone, Debug, borsh::BorshSerialize)]
    struct PriceAccount {
        pub id: u64,
        pub price: u64,
        pub price_expo: u64,
        pub ema: u64,
        pub ema_expo: u64,
    }

    #[derive(Default, Debug, borsh::BorshSerialize)]
    struct PriceOnly {
        pub price_expo: u64,
        pub price: u64,

        pub id: u64,
    }

    impl From<PriceAccount> for PriceOnly {
        fn from(other: PriceAccount) -> Self {
            Self {
                id: other.id,
                price: other.price,
                price_expo: other.price_expo,
            }
        }
    }

    #[derive(Debug)]
    struct MerkleTreeDataWrapper {
        pub accumulator: MerkleTree,
        pub data: BTreeSet<Vec<u8>>,
    }

    impl Arbitrary for MerkleTreeDataWrapper {
        type Parameters = usize;

        fn arbitrary_with(size: Self::Parameters) -> Self::Strategy {
            let size = size.saturating_add(1);
            prop::collection::vec(
                prop::collection::vec(any::<u8>(), 1..=10),
                size..=size.saturating_add(100),
            )
            .prop_map(|v| {
                let data: BTreeSet<Vec<u8>> = v.into_iter().collect();
                let accumulator =
                    MerkleTree::<Keccak256>::from_set(data.iter().map(|i| i.as_ref())).unwrap();
                MerkleTreeDataWrapper { accumulator, data }
            })
            .boxed()
        }

        type Strategy = BoxedStrategy<Self>;
    }

    impl Arbitrary for MerklePath<Keccak256> {
        type Parameters = usize;

        fn arbitrary_with(size: Self::Parameters) -> Self::Strategy {
            let size = size.saturating_add(1);
            prop::collection::vec(
                prop::collection::vec(any::<u8>(), 32),
                size..=size.saturating_add(100),
            )
            .prop_map(|v| {
                let v = v.into_iter().map(|i| i.try_into().unwrap()).collect();
                MerklePath(v)
            })
            .boxed()
        }

        type Strategy = BoxedStrategy<Self>;
    }

    #[test]
    fn test_merkle() {
        let mut set: BTreeSet<&[u8]> = BTreeSet::new();

        // Create some random elements (converted to bytes). All accumulators store arbitrary bytes so
        // that we can target any account (or subset of accounts).
        let price_account_a = PriceAccount {
            id: 1,
            price: 100,
            price_expo: 2,
            ema: 50,
            ema_expo: 1,
        };
        let item_a = borsh::BorshSerialize::try_to_vec(&price_account_a).unwrap();

        let mut price_only_b = PriceOnly::from(price_account_a);
        price_only_b.price = 200;
        let item_b = BorshSerialize::try_to_vec(&price_only_b).unwrap();
        let item_c = 2usize.to_be_bytes();
        let item_d = 88usize.to_be_bytes();

        // Insert the bytes into the Accumulate type.
        set.insert(&item_a);
        set.insert(&item_b);
        set.insert(&item_c);

        let accumulator = MerkleTree::<Keccak256>::from_set(set.into_iter()).unwrap();
        let proof = accumulator.prove(&item_a).unwrap();

        assert!(accumulator.verify_path(proof, &item_a));
        let proof = accumulator.prove(&item_a).unwrap();
        assert_eq!(size_of::<<Keccak256 as Hasher>::Hash>(), 32);

        assert!(!accumulator.verify_path(proof, &item_d));
    }

    #[test]
    // Note that this is testing proofs for trees size 2 and greater, as a size 1 tree the root is
    // its own proof and will always pass. This just checks the most obvious case that an empty or
    // default proof should obviously not work, see the proptest for a more thorough check.
    fn test_merkle_default_proof_fails() {
        let mut set: BTreeSet<&[u8]> = BTreeSet::new();

        // Insert the bytes into the Accumulate type.
        let item_a = 88usize.to_be_bytes();
        let item_b = 99usize.to_be_bytes();
        set.insert(&item_a);
        set.insert(&item_b);

        // Attempt to prove empty proofs that are not in the accumulator.
        let accumulator = MerkleTree::<Keccak256>::from_set(set.into_iter()).unwrap();
        let proof = MerklePath::<Keccak256>::default();
        assert!(!accumulator.verify_path(proof, &item_a));
        let proof = MerklePath::<Keccak256>(vec![Default::default()]);
        assert!(!accumulator.verify_path(proof, &item_a));
    }

    #[test]
    fn test_corrupted_tree_proofs() {
        let mut set: BTreeSet<&[u8]> = BTreeSet::new();

        // Insert the bytes into the Accumulate type.
        let item_a = 88usize.to_be_bytes();
        let item_b = 99usize.to_be_bytes();
        let item_c = 100usize.to_be_bytes();
        let item_d = 101usize.to_be_bytes();
        set.insert(&item_a);
        set.insert(&item_b);
        set.insert(&item_c);
        set.insert(&item_d);

        // Accumulate
        let accumulator = MerkleTree::<Keccak256>::from_set(set.into_iter()).unwrap();

        // For each hash in the resulting proofs, corrupt one hash and confirm that the proof
        // cannot pass check.
        for item in [item_a, item_b, item_c, item_d].iter() {
            let proof = accumulator.prove(item).unwrap();
            for (i, _) in proof.0.iter().enumerate() {
                let mut corrupted_proof = proof.clone();
                corrupted_proof.0[i] = Default::default();
                assert!(!accumulator.verify_path(corrupted_proof, item));
            }
        }
    }

    #[test]
    #[should_panic]
    // Generates a tree with four leaves, then uses the first leaf of the right subtree as the
    // sibling hash, this detects if second preimage attacks are possible.
    fn test_merkle_second_preimage_attack() {
        let mut set: BTreeSet<&[u8]> = BTreeSet::new();

        // Insert the bytes into the Accumulate type.
        let item_a = 81usize.to_be_bytes();
        let item_b = 99usize.to_be_bytes();
        let item_c = 100usize.to_be_bytes();
        let item_d = 101usize.to_be_bytes();
        set.insert(&item_a);
        set.insert(&item_b);
        set.insert(&item_c);
        set.insert(&item_d);

        // Accumulate into a 2 level tree.
        let accumulator = MerkleTree::<Keccak256>::from_set(set.into_iter()).unwrap();
        let proof = accumulator.prove(&item_a).unwrap();
        assert!(accumulator.verify_path(proof, &item_a));

        // We now have a 2 level tree with 4 nodes:
        //
        //         root
        //         /  \
        //        /    \
        //       A      B
        //      / \    / \
        //     a   b  c   d
        //
        // Laid out as: [0, root, A, B, a, b, c, d]
        //
        // In order to test preimage resistance we will attack the tree by dropping its leaf nodes
        // from the bottom level, this produces a new tree with 2 nodes:
        //
        //         root
        //         /  \
        //        /    \
        //       A      B
        //
        // Laid out as: [0, root, A, B]
        //
        // Here rather than A/B being hashes of leaf nodes, they themselves ARE the leaves, if the
        // implementation did not use a different hash for nodes and leaves then it is possible to
        // falsely prove `A` was in the original tree by tricking the implementation into performing
        // H(a || b) at the leaf.
        let faulty_accumulator = MerkleTree::<Keccak256> {
            root: accumulator.root,
            nodes: vec![
                accumulator.nodes[0],
                accumulator.nodes[1], // Root Stays the Same
                accumulator.nodes[2], // Left node hash becomes a leaf.
                accumulator.nodes[3], // Right node hash becomes a leaf.
            ],
        };

        // `a || b` is the concatenation of a and b, which when hashed without pre-image fixes in
        // place generates A as a leaf rather than a pair node.
        let fake_leaf = &[
            MerkleTree::<Keccak256>::hash_leaf(&item_b),
            MerkleTree::<Keccak256>::hash_leaf(&item_a),
        ]
        .concat();

        // Confirm our combined hash existed as a node pair in the original tree.
        assert_eq!(
            MerkleTree::<Keccak256>::hash_leaf(fake_leaf),
            accumulator.nodes[2]
        );

        // Now we can try and prove leaf membership in the faulty accumulator. NOTE: this should
        // fail but to confirm that the test is actually correct you can remove the PREFIXES from
        // the hash functions and this test will erroneously pass.
        let proof = faulty_accumulator.prove(fake_leaf).unwrap();
        assert!(faulty_accumulator.verify_path(proof, fake_leaf));
    }

    proptest! {
        // Use proptest to generate arbitrary Merkle trees as part of our fuzzing strategy. This
        // will help us identify any edge cases or unexpected behavior in the implementation.
        #[test]
        fn test_merkle_tree(v in any::<MerkleTreeDataWrapper>()) {
            for d in v.data {
                let proof = v.accumulator.prove(&d).unwrap();
                assert!(v.accumulator.verify_path(proof, &d));
            }
        }

        // Use proptest to generate arbitrary proofs for Merkle Trees trying to find a proof that
        // passes which should not.
        #[test]
        fn test_fake_merkle_proofs(
            v in any::<MerkleTreeDataWrapper>(),
            p in any::<MerklePath<Keccak256>>(),
        ) {
            // Reject 1-sized trees as they will always pass due to root being the only elements
            // own proof (I.E proof is [])
            if v.data.len() == 1 {
                return Ok(());
            }

            for d in v.data {
                assert!(!v.accumulator.verify_path(p.clone(), &d));
            }
        }
    }
}
