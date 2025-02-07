#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use pyth_stylus::pyth::pyth_contract::PythContract;
use stylus_sdk::prelude::{entrypoint, public, storage};

#[entrypoint]
#[storage]
struct ExtendPythExample {
    #[borrow]
    pyth: PythContract,
}

#[public]
#[inherit(PythContract)]
impl ExtendPythExample {
    /// Returns a vector of bytes containing the data.
    fn get_data(&self) -> Vec<u8> {
        // just reteun data
        vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    }
}
