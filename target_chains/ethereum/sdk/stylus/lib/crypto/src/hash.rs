//! Generic hashing support.
//!
//! This module provides a generic way to compute the [hash] of a value. It is
//! intended to be used as a replacement for [`core::hash`], which we can't use
//! because [`core::hash::Hasher::finish`] returns a `u64`.
//!
//! [hash]: https://en.wikipedia.org/wiki/Hash_function

/// A hashable type.
///
/// Types implementing `Hash` are able to be [`Hash::hash`]ed with an instance
/// of [`Hasher`].
pub trait Hash {
    /// Feeds this value into the given [`Hasher`].
    fn hash<H: Hasher>(&self, state: &mut H);
}

/// A trait for hashing an arbitrary stream of bytes.
///
/// Instances of `Hasher` usually represent state that is changed while hashing
/// data.
///
/// `Hasher` provides a fairly basic interface for retrieving the generated hash
/// (with [`Hasher::finalize`]), and absorbing an arbitrary number of bytes
/// (with [`Hasher::update`]). Most of the time, [`Hasher`] instances are used
/// in conjunction with the [`Hash`] trait.
pub trait Hasher {
    /// The output type of this hasher.
    ///
    /// For [`core::hash`] types, it's `u64`. For [`tiny_keccak`], it's `[u8]`.
    /// For this crate, it's `[u8; 32]`.
    type Output;

    /// Absorb additional input. Can be called multiple times.
    fn update(&mut self, input: impl AsRef<[u8]>);

    /// Output the hashing algorithm state.
    fn finalize(self) -> Self::Output;
}

/// A trait for creating instances of [`Hasher`].
///
/// A `BuildHasher` is typically used (e.g., by [`HashMap`]) to create
/// [`Hasher`]s for each key such that they are hashed independently of one
/// another, since [`Hasher`]s contain state.
///
/// For each instance of `BuildHasher`, the [`Hasher`]s created by
/// [`build_hasher`] should be identical. That is, if the same stream of bytes
/// is fed into each hasher, the same output will also be generated.
///
/// # Examples
///
/// ```rust
/// use openzeppelin_crypto::KeccakBuilder;
/// use openzeppelin_crypto::hash::{BuildHasher, Hash, Hasher};
///
/// let b = KeccakBuilder;
/// let mut hasher_1 = b.build_hasher();
/// let mut hasher_2 = b.build_hasher();
///
/// hasher_1.update([1]);
/// hasher_2.update([1]);
///
/// assert_eq!(hasher_1.finalize(), hasher_2.finalize());
/// ```
///
/// [`build_hasher`]: BuildHasher::build_hasher
/// [`HashMap`]: ../../std/collections/struct.HashMap.html
pub trait BuildHasher {
    /// Type of the hasher that will be created.
    type Hasher: Hasher;

    /// Creates a new hasher.
    ///
    /// Each call to `build_hasher` on the same instance should produce
    /// identical [`Hasher`]s.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openzeppelin_crypto::KeccakBuilder;
    /// use openzeppelin_crypto::hash::BuildHasher;
    ///
    /// let b = KeccakBuilder;
    /// let hasher = b.build_hasher();
    /// ```
    fn build_hasher(&self) -> Self::Hasher;

    /// Calculates the hash of a single value.
    ///
    /// This is intended as a convenience for code which *consumes* hashes, such
    /// as the implementation of a hash table or in unit tests that check
    /// whether a custom [`Hash`] implementation behaves as expected.
    ///
    /// This must not be used in any code which *creates* hashes, such as in an
    /// implementation of [`Hash`].  The way to create a combined hash of
    /// multiple values is to call [`Hash::hash`] multiple times using the same
    /// [`Hasher`], not to call this method repeatedly and combine the results.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openzeppelin_crypto::KeccakBuilder;
    /// use openzeppelin_crypto::hash::{BuildHasher, Hash};
    ///
    /// let b = KeccakBuilder;
    /// let hash_1 = b.hash_one([0u8; 32]);
    /// let hash_2 = b.hash_one([0u8; 32]);
    /// assert_eq!(hash_1, hash_2);
    ///
    /// let hash_1 = b.hash_one([1u8; 32]);
    /// assert_ne!(hash_1, hash_2);
    /// ```
    fn hash_one<Hashable>(
        &self,
        h: Hashable,
    ) -> <Self::Hasher as Hasher>::Output
    where
        Hashable: Hash,
        Self: Sized,
        Self::Hasher: Hasher,
    {
        let mut hasher = self.build_hasher();
        h.hash(&mut hasher);
        hasher.finalize()
    }
}

/// Hash the pair `(a, b)` with `state`.
#[allow(clippy::module_name_repetitions)]
#[inline]
pub fn hash_pair<S, H>(a: &H, b: &H, mut state: S) -> S::Output
where
    H: Hash + ?Sized,
    S: Hasher,
{
    a.hash(&mut state);
    b.hash(&mut state);
    state.finalize()
}

/// Sort the pair `(a, b)` and hash the result with `state`. Frequently used
/// when working with merkle proofs.
#[inline]
pub fn commutative_hash_pair<S, H>(a: &H, b: &H, state: S) -> S::Output
where
    H: Hash + PartialOrd,
    S: Hasher,
{
    if a > b {
        hash_pair(b, a, state)
    } else {
        hash_pair(a, b, state)
    }
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use super::{commutative_hash_pair, hash_pair, BuildHasher, Hash, Hasher};
    use crate::KeccakBuilder;

    impl Hash for &[u8] {
        fn hash<H: Hasher>(&self, state: &mut H) {
            state.update(self);
        }
    }

    #[test]
    fn hashes_pairs() {
        let builder = KeccakBuilder;
        let a = [1u8].as_slice();
        let b = [2u8].as_slice();

        let r1 = hash_pair(&a, &b, builder.build_hasher());
        let r2 = hash_pair(&a, &b, builder.build_hasher());
        assert_eq!(r1, r2);

        let r3 = hash_pair(&b, &a, builder.build_hasher());
        assert_ne!(r1, r3);
    }

    #[test]
    fn commutatively_hashes_pairs() {
        let builder = KeccakBuilder;
        let a = [1u8].as_slice();
        let b = [2u8].as_slice();

        let r1 = commutative_hash_pair(&a, &b, builder.build_hasher());
        let r2 = commutative_hash_pair(&b, &a, builder.build_hasher());
        assert_eq!(r1, r2);
    }
}
