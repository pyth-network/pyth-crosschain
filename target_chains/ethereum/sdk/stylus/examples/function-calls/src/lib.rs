#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{ prelude::{entrypoint,public, sol_storage}, alloy_primitives:: Uint};
use pyth_stylus::pyth::functions::get_price_no_older_than;

sol_storage! {
    #[entrypoint]
    struct FunctionCallsExample {
        address pyth_address;
        bytes32 price_id;
    }
}


#[public]
impl FunctionCallsExample {
    pub fn check_price(&mut self) -> Result<(), Vec<u8>> {
        let _price =   get_price_no_older_than(self, self.pyth_address.get(),self.price_id.get() ,Uint::from(1047483647))?;
        Ok(())
    }
}