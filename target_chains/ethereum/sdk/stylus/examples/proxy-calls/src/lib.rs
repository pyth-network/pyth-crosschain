#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_primitives::Uint;
use stylus_sdk::prelude::{entrypoint,public, sol_storage};
use pyth_stylus::pyth::pyth_contract::PythContract;


sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        address pyth_address;
        bytes32 price_id;
    }
}


#[public]
impl ProxyCallsExample {
    pub fn get_price_no_older_than(&mut self) -> Result<(), Vec<u8>> {
      // let price =   get_price_no_older_than(self, self.pyth_address.get(),self.price_id.get() ,Uint::from(1047483647))?;
      // self.price.set(price);
       Ok(())
    }
}