//! Legacy Core Bridge state and instruction processing.

pub use crate::ID;

pub mod instruction;

mod processor;
pub use processor::_PYTH_INITIAL_MULTISIG_SET_PROD;
pub(crate) use processor::*;

pub mod state;

pub(crate) mod utils;
