#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;


use alloc::vec::Vec;
use alloy_primitives::{  FixedBytes, U256};
use stylus_sdk::prelude::{entrypoint,public, sol_storage,};
use pyth_stylus::{pyth::{
    pyth_contract::{IPyth, PythContract},
    types::Price
}, utils::helpers::decode_helper};


sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        #[borrow]
        PythContract pyth
    }
}

#[public]
#[inherit(PythContract)]
impl ProxyCallsExample {
    pub fn get_price_no_older_than(&mut self,id : FixedBytes<32>, age:U256) -> Result<(), Vec<u8>> {
      let price =  self.pyth.get_price_no_older_than(id, age)?;
       let _ = decode_helper::<Price>(&price)?;
       Ok(())
    }
}