//! Accumulators
//!
//! This module defines the Accumulator abstraction as well as the implementation details for
//! several different accumulators. This library can be used for interacting with PythNet state
//! proofs for account content.

pub mod merkle;
pub mod mul;

/// The Accumulator trait defines the interface for an accumulator.
///
/// This trait assumes an accumulator has an associated proof type that can be used to prove
/// membership of a specific item. The choice to return Proof makes this the most generic
/// implementation possible for any accumulator.
pub trait Accumulator<'a>
where
    Self: Sized,
    Self::Proof: 'a,
    Self::Proof: Sized,
{
    type Proof;

    /// Prove an item is a member of the accumulator.
    fn prove(&'a self, item: &[u8]) -> Option<Self::Proof>;

    /// Verify an item is a member of the accumulator.
    fn check(&'a self, proof: Self::Proof, item: &[u8]) -> bool;

    /// Create an accumulator from a set of items.
    fn from_set(items: impl Iterator<Item = &'a [u8]>) -> Option<Self>;
}
