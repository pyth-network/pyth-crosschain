#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use pyth_stylus::pyth::pyth_contract::PythContract;
use stylus_sdk::prelude::{entrypoint, public, sol_storage};
use alloc::vec::Vec;
use alloc::vec;


sol_storage! {
    #[entrypoint]
    struct ExtendPythExample {
        #[borrow]
        PythContract pyth
    }
}

#[public]
#[inherit(PythContract)]
impl ExtendPythExample {
    /// Returns a vector of bytes containing the data.
    fn get_data(&self) -> Vec<u8> { 
        // just reteun data
        vec![1,2,3]
    }
}