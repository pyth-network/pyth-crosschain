use std::fmt::Debug;

pub mod keccak256;
pub mod prime;

/// Hasher is a trait used to provide a hashing algorithm for the library.
pub trait Hasher: Clone + Default + Debug + serde::Serialize {
    /// This type is used as a hash type in the library.
    /// It is recommended to use fixed size u8 array as a hash type. For example,
    /// for sha256 the type would be `[u8; 32]`, representing 32 bytes,
    /// which is the size of the sha256 digest. Also, fixed sized arrays of `u8`
    /// by default satisfy all trait bounds required by this type.
    ///
    /// # Trait bounds
    /// `Copy` is required as the hash needs to be copied to be concatenated/propagated
    /// when constructing nodes.
    /// `PartialEq` is required to compare equality when verifying proof
    /// `Into<Vec<u8>>` is required to be able to serialize proof
    /// `TryFrom<Vec<u8>>` is required to parse hashes from a serialized proof
    /// `Default` is required to be able to create a default hash
    // TODO: use Digest trait from digest crate?
    type Hash: Copy
        + PartialEq
        + Default
        + Eq
        + Default
        + Debug
        + AsRef<[u8]>
        + serde::Serialize
        + for<'a> serde::de::Deserialize<'a>;
    fn hashv<T: AsRef<[u8]>>(data: &[T]) -> Self::Hash;
}
