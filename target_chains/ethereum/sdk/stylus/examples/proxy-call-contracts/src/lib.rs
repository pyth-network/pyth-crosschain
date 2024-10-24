#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{ alloy_primitives:: Uint, console, prelude::{entrypoint,public, sol_storage}};
use pyth_stylus::pyth::pyth_contract::PythContract;

sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        bytes32 price_id;
        address pyth_address;

        #[borrow]
        PythContract _pyth;
    }
}


#[public]
#[inherit(PythContract)]
impl ProxyCallsExample {
    pub fn check_price(&mut self) {
        console!("test")
        // let _price =  self._pyth.get_price_no_older_than(self.pyth_address.get(),self.price_id.get() ,Uint::from(1047483647))?;
        // Ok(())
    }
}