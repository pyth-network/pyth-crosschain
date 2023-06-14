#[cfg(test)]
extern crate lazy_static;

pub mod contract;
pub mod governance;
pub mod msg;
pub mod state;
pub mod wormhole;
pub use pythnet_sdk::wire::v1::Proof;

#[cfg(feature = "injective")]
mod injective;
