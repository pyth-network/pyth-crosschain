//! An interface to the default hashing algorithm used in this library's [merkle
//! proofs][crate].
use tiny_keccak::{Hasher as TinyHasher, Keccak};

use crate::hash::{BuildHasher, Hash, Hasher};

/// The default [`Hasher`] builder used in this library's [merkle
/// proofs][crate].
///
/// It instantiates a [`Keccak256`] hasher.
#[allow(clippy::module_name_repetitions)]
pub struct KeccakBuilder;

impl BuildHasher for KeccakBuilder {
    type Hasher = Keccak256;

    #[inline]
    fn build_hasher(&self) -> Self::Hasher {
        Keccak256(Keccak::v256())
    }
}

/// The default [`Hasher`] used in this library's [merkle proofs][crate].
///
/// The underlying implementation is guaranteed to match that of the
/// `keccak256` algorithm, commonly used in Ethereum.
#[allow(clippy::module_name_repetitions)]
pub struct Keccak256(Keccak);

impl Hasher for Keccak256 {
    type Output = [u8; 32];

    fn update(&mut self, input: impl AsRef<[u8]>) {
        self.0.update(input.as_ref());
    }

    fn finalize(self) -> Self::Output {
        let mut buffer = [0u8; 32];
        self.0.finalize(&mut buffer);
        buffer
    }
}

impl Hash for [u8; 32] {
    #[inline]
    fn hash<H: Hasher>(&self, state: &mut H) {
        state.update(self);
    }
}
