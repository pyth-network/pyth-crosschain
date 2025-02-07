use {
    borsh::{BorshDeserialize, BorshSerialize},
    serde::{Deserialize, Serialize},
    std::fmt::Debug,
};

pub mod keccak256;
pub mod keccak256_160;
pub mod prime;

/// We provide `Hasher` as a small hashing abstraction.
///
/// This trait allows us to use a more abstract idea of hashing than the `Digest` trait from the
/// `digest` create provides. In particular, if we want to use none cryptographic hashes or hashes
/// that fit the mathematical definition of a hash, we can do this with this far more general
/// abstraction.
pub trait Hasher
where
    Self: Clone,
    Self: Debug,
    Self: Default,
{
    type Hash: Copy
        + AsRef<[u8]>
        + BorshSerialize
        + BorshDeserialize
        + Debug
        + Default
        + Eq
        + std::hash::Hash
        + PartialOrd
        + PartialEq
        + Serialize
        + for<'a> Deserialize<'a>;

    fn hashv(data: &[impl AsRef<[u8]>]) -> Self::Hash;
}
