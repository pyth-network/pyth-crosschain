// TODO: Go back to a reference based implementation ala Solana's original.

use {
    crate::{
        accumulators::Accumulator,
        hashers::{
            keccak256::Keccak256Hasher,
            Hasher,
        },
        PriceId,
    },
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    serde::{
        Deserialize,
        Serialize,
    },
    std::collections::HashSet,
};

// We need to discern between leaf and intermediate nodes to prevent trivial second
// pre-image attacks.
// https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack
const LEAF_PREFIX: &[u8] = &[0];
const INTERMEDIATE_PREFIX: &[u8] = &[1];

macro_rules! hash_leaf {
    {$x:ty, $d:ident} => {
        <$x as Hasher>::hashv(&[LEAF_PREFIX, $d])
    }
}

macro_rules! hash_intermediate {
    {$x:ty, $l:ident, $r:ident} => {
        <$x as Hasher>::hashv(&[INTERMEDIATE_PREFIX, $l.as_ref(), $r.as_ref()])
    }
}

/// An implementation of a Sha3/Keccak256 based Merkle Tree based on the implementation provided by
/// solana-merkle-tree. This modifies the structure slightly to be serialization friendly, and to
/// make verification cheaper on EVM based networks.
#[derive(
    Debug, Clone, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize, Default,
)]
pub struct MerkleTree<H: Hasher = Keccak256Hasher> {
    pub leaf_count: usize,
    pub nodes:      Vec<H::Hash>,
}

pub struct MerkleAccumulator<'a, H: Hasher = Keccak256Hasher> {
    pub accumulator: MerkleTree<H>,
    /// A list of the original items inserted into the tree.
    ///
    /// The full list is kept because proofs require the index of each item in the tree, by
    /// keeping the nodes we can look up the position in the original list for proof
    /// verification.
    pub items:       Vec<&'a [u8]>,
}

impl<'a, H: Hasher + 'a> Accumulator<'a> for MerkleAccumulator<'a, H> {
    type Proof = MerklePath<H>;

    fn from_set(items: impl Iterator<Item = &'a &'a [u8]>) -> Option<Self> {
        let items: Vec<&[u8]> = items.copied().collect();
        let tree = MerkleTree::new(&items);
        Some(Self {
            accumulator: tree,
            items,
        })
    }

    fn prove(&'a self, item: &[u8]) -> Option<Self::Proof> {
        let index = self.items.iter().position(|i| i == &item)?;
        self.accumulator.find_path(index)
    }

    fn verify(&'a self, proof: Self::Proof, item: &[u8]) -> bool {
        let item = hash_leaf!(H, item);
        proof.validate(item)
    }
}

impl<H: Hasher> MerkleTree<H> {
    #[inline]
    fn next_level_len(level_len: usize) -> usize {
        if level_len == 1 {
            0
        } else {
            (level_len + 1) / 2
        }
    }

    fn calculate_vec_capacity(leaf_count: usize) -> usize {
        // the most nodes consuming case is when n-1 is full balanced binary tree
        // then n will cause the previous tree add a left only path to the root
        // this cause the total nodes number increased by tree height, we use this
        // condition as the max nodes consuming case.
        // n is current leaf nodes number
        // assuming n-1 is a full balanced binary tree, n-1 tree nodes number will be
        // 2(n-1) - 1, n tree height is closed to log2(n) + 1
        // so the max nodes number is 2(n-1) - 1 + log2(n) + 1, finally we can use
        // 2n + log2(n+1) as a safe capacity value.
        // test results:
        // 8192 leaf nodes(full balanced):
        // computed cap is 16398, actually using is 16383
        // 8193 leaf nodes:(full balanced plus 1 leaf):
        // computed cap is 16400, actually using is 16398
        // about performance: current used fast_math log2 code is constant algo time
        if leaf_count > 0 {
            fast_math::log2_raw(leaf_count as f32) as usize + 2 * leaf_count + 1
        } else {
            0
        }
    }

    pub fn new<T: AsRef<[u8]>>(items: &[T]) -> Self {
        let cap = MerkleTree::<H>::calculate_vec_capacity(items.len());
        let mut mt = MerkleTree {
            leaf_count: items.len(),
            nodes:      Vec::with_capacity(cap),
        };

        for item in items {
            let item = item.as_ref();
            let hash = hash_leaf!(H, item);
            mt.nodes.push(hash);
        }

        let mut level_len = MerkleTree::<H>::next_level_len(items.len());
        let mut level_start = items.len();
        let mut prev_level_len = items.len();
        let mut prev_level_start = 0;
        while level_len > 0 {
            for i in 0..level_len {
                let prev_level_idx = 2 * i;

                let lsib: &H::Hash = &mt.nodes[prev_level_start + prev_level_idx];
                let rsib: &H::Hash = if prev_level_idx + 1 < prev_level_len {
                    &mt.nodes[prev_level_start + prev_level_idx + 1]
                } else {
                    // Duplicate last entry if the level length is odd
                    &mt.nodes[prev_level_start + prev_level_idx]
                };

                let hash = hash_intermediate!(H, lsib, rsib);
                mt.nodes.push(hash);
            }
            prev_level_start = level_start;
            prev_level_len = level_len;
            level_start += level_len;
            level_len = MerkleTree::<H>::next_level_len(level_len);
        }

        mt
    }

    pub fn get_root(&self) -> Option<&H::Hash> {
        self.nodes.iter().last()
    }

    pub fn find_path(&self, index: usize) -> Option<MerklePath<H>> {
        if index >= self.leaf_count {
            return None;
        }

        let mut level_len = self.leaf_count;
        let mut level_start = 0;
        let mut path = MerklePath::<H>::default();
        let mut node_index = index;
        let mut lsib = None;
        let mut rsib = None;
        while level_len > 0 {
            let level = &self.nodes[level_start..(level_start + level_len)];

            let target = level[node_index];
            if lsib.is_some() || rsib.is_some() {
                path.push(MerkleNode::new(target, lsib, rsib));
            }
            if node_index % 2 == 0 {
                lsib = None;
                rsib = if node_index + 1 < level.len() {
                    Some(level[node_index + 1])
                } else {
                    Some(level[node_index])
                };
            } else {
                lsib = Some(level[node_index - 1]);
                rsib = None;
            }
            node_index /= 2;

            level_start += level_len;
            level_len = MerkleTree::<H>::next_level_len(level_len);
        }
        Some(path)
    }
}

#[derive(Clone, Default, Debug, PartialEq, Eq, Serialize)]
pub struct MerklePath<H: Hasher>(Vec<MerkleNode<H>>);

impl<H: Hasher> MerklePath<H> {
    pub fn push(&mut self, entry: MerkleNode<H>) {
        self.0.push(entry)
    }

    pub fn validate(&self, candidate: H::Hash) -> bool {
        let result = self.0.iter().try_fold(candidate, |candidate, pe| {
            let lsib = &pe.1.unwrap_or(candidate);
            let rsib = &pe.2.unwrap_or(candidate);
            let hash = hash_intermediate!(H, lsib, rsib);

            if hash == pe.0 {
                Some(hash)
            } else {
                None
            }
        });
        matches!(result, Some(_))
    }
}

#[derive(Clone, Default, Debug, PartialEq, Eq, Serialize)]
pub struct MerkleNode<H: Hasher>(H::Hash, Option<H::Hash>, Option<H::Hash>);

impl<'a, H: Hasher> MerkleNode<H> {
    pub fn new(
        target: H::Hash,
        left_sibling: Option<H::Hash>,
        right_sibling: Option<H::Hash>,
    ) -> Self {
        assert!(left_sibling.is_none() ^ right_sibling.is_none());
        Self(target, left_sibling, right_sibling)
    }
}

//TODO: update this to correct value/type later
//
/** using `sdk/program/src/slot_hashes.rs` as a reference **/

//TODO: newtype or type alias?
//  also double check alignment in conjunction with `AccumulatorPrice`
// #[repr(transparent)
#[derive(Serialize, PartialEq, Eq, Default)]
pub struct PriceProofs<H: Hasher>(Vec<(PriceId, MerklePath<H>)>);

impl<H: Hasher> PriceProofs<H> {
    pub fn new(price_proofs: &[(PriceId, MerklePath<H>)]) -> Self {
        let mut price_proofs = price_proofs.to_vec();
        price_proofs.sort_by(|(a, _), (b, _)| a.cmp(b));
        Self(price_proofs)
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        std::mem::size_of,
    };

    #[derive(Default, Clone, Debug, borsh::BorshSerialize)]
    struct PriceAccount {
        pub id:         u64,
        pub price:      u64,
        pub price_expo: u64,
        pub ema:        u64,
        pub ema_expo:   u64,
    }

    #[derive(Default, Debug, borsh::BorshSerialize)]
    struct PriceOnly {
        pub price_expo: u64,
        pub price:      u64,

        pub id: u64,
    }

    impl From<PriceAccount> for PriceOnly {
        fn from(other: PriceAccount) -> Self {
            Self {
                id:         other.id,
                price:      other.price,
                price_expo: other.price_expo,
            }
        }
    }

    #[test]
    fn test_merkle() {
        let mut set: HashSet<&[u8]> = HashSet::new();

        // Create some random elements (converted to bytes). All accumulators store arbitrary bytes so
        // that we can target any account (or subset of accounts).
        let price_account_a = PriceAccount {
            id:         1,
            price:      100,
            price_expo: 2,
            ema:        50,
            ema_expo:   1,
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

        let accumulator = MerkleAccumulator::<'_, Keccak256Hasher>::from_set(set.iter()).unwrap();
        let proof = accumulator.prove(&item_a).unwrap();
        // println!("Proof:  {:02X?}", proof);
        assert!(accumulator.verify(proof, &item_a));
        let proof = accumulator.prove(&item_a).unwrap();
        println!(
            "proof: {:#?}",
            proof.0.iter().map(|x| format!("{x:?}")).collect::<Vec<_>>()
        );
        println!(
            "accumulator root: {:?}",
            accumulator.accumulator.get_root().unwrap()
        );
        println!(
            r"
                Sizes:
                    MerkleAccumulator::Proof    {:?}
                    Keccak256Hasher::Hash       {:?}
                    MerkleNode                  {:?}
                    MerklePath                  {:?}

            ",
            size_of::<<MerkleAccumulator<'_> as Accumulator>::Proof>(),
            size_of::<<Keccak256Hasher as Hasher>::Hash>(),
            size_of::<MerkleNode<Keccak256Hasher>>(),
            size_of::<MerklePath<Keccak256Hasher>>()
        );
        assert!(!accumulator.verify(proof, &item_d));
    }

    //TODO: more tests
}
