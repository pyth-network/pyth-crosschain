#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{ prelude::{entrypoint,public, sol_storage}, storage::StorageAddress, alloy_primitives::{FixedBytes, Uint}};
use pyth_stylus::pyth::functions::get_price_no_older_than;

sol_storage! {
    #[entrypoint]
    struct FunctionCallsExample {
        address pyth_address;
    }
}


#[public]
impl FunctionCallsExample {
    pub fn check_price(&mut self) -> Result<(), Vec<u8>> {
        let price =   get_price_no_older_than(self, self.pyth_address,FixedBytes::from("BTC"),Uint::from(10000000000))?;
        Ok(())
    }

}