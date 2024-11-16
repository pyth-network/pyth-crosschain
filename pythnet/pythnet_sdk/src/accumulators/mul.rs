//! A multiplication based Accumulator (should not use, example only)

use crate::{
    accumulators::Accumulator,
    hashers::{prime::PrimeHasher, Hasher},
};

/// A multiplication based Accumulator
///
/// This accumulator relies on the quasi-commutative nature of the multiplication operator. It's
/// here mostly as a an example to gain intuition for how accumulators should function. This
/// implementation relies on the fact that `/` can be used to "remove" an element but typically an
/// accumulator cannot rely on having a shortcut, and must re-accumulate sans the element being
/// proved to be a member.
pub struct MulAccumulator<H: Hasher> {
    pub accumulator: H::Hash,
    pub items: Vec<H::Hash>,
}

impl<'a> Accumulator<'a> for MulAccumulator<PrimeHasher> {
    type Proof = <PrimeHasher as Hasher>::Hash;

    fn prove(&self, item: &[u8]) -> Option<Self::Proof> {
        let bytes = u128::from_be_bytes(PrimeHasher::hashv(&[item]));
        let acc = u128::from_be_bytes(self.accumulator);
        Some((acc / bytes).to_be_bytes())
    }

    fn check(&self, proof: Self::Proof, item: &[u8]) -> bool {
        let bytes = u128::from_be_bytes(PrimeHasher::hashv(&[item]));
        let proof = u128::from_be_bytes(proof);
        proof * bytes == u128::from_be_bytes(self.accumulator)
    }

    fn from_set(items: impl Iterator<Item = &'a [u8]>) -> Option<Self> {
        let primes: Vec<[u8; 16]> = items.map(|i| PrimeHasher::hashv(&[i])).collect();
        Some(Self {
            items: primes.clone(),
            accumulator: primes.into_iter().reduce(|acc, v| {
                u128::to_be_bytes(u128::from_be_bytes(acc) * u128::from_be_bytes(v))
            })?,
        })
    }
}

#[cfg(test)]
mod test {
    use {super::*, std::collections::HashSet};

    #[test]
    fn test_membership() {
        let mut set: HashSet<&[u8]> = HashSet::new();

        // Create some random elements (converted to bytes). All accumulators store arbitrary bytes
        // so that we can target any account (or subset of accounts).
        let item_a = 33usize.to_be_bytes();
        let item_b = 54usize.to_be_bytes();
        let item_c = 2usize.to_be_bytes();
        let item_d = 88usize.to_be_bytes();

        // Insert the bytes into the Accumulate type.
        set.insert(&item_a);
        set.insert(&item_b);
        set.insert(&item_c);

        println!();

        // Create an Accumulator. Test Membership.
        {
            let accumulator = MulAccumulator::<PrimeHasher>::from_set(set.into_iter()).unwrap();
            let proof = accumulator.prove(&item_a).unwrap();
            assert!(accumulator.check(proof, &item_a));
            assert!(!accumulator.check(proof, &item_d));
        }
    }
}
