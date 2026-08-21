//! Legacy Core Bridge state and instruction processing.

pub use crate::ID;

pub mod instruction;

mod processor;
pub use processor::PYTH_INITIAL_MULTISIG_SET;
pub(crate) use processor::*;

pub mod state;

pub(crate) mod utils;
