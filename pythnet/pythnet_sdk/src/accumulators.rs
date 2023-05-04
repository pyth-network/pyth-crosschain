pub mod merkle;
mod mul;

pub trait Accumulator<'a>: Sized {
    type Proof: 'a;
    fn from_set(items: impl Iterator<Item = &'a &'a [u8]>) -> Option<Self>;
    fn prove(&'a self, item: &[u8]) -> Option<Self::Proof>;
    fn verify(&'a self, proof: Self::Proof, item: &[u8]) -> bool;
}
