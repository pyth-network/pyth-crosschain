#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_primitives::Uint;
use stylus_sdk::prelude::{entrypoint,public, sol_storage};
use pyth_stylus::pyth::{functions::{
    get_price_no_older_than, 
    get_ema_price_no_older_than, 
    get_ema_price_unsafe, 
    get_price_unsafe, 
    get_update_fee,
    get_valid_time_period,
    update_price_feeds,
    update_price_feeds_if_necessary
},types::{
    StoragePrice, 
    StoragePriceFeed
}};


sol_storage! {
    #[entrypoint]
    struct FunctionCallsExample {
        address pyth_address;
        bytes32 price_id;
        StoragePrice price;
        StoragePriceFeed price_feed;
        StoragePrice ema_price;
        StoragePriceFeed ema_price_feed;
    }
}


#[public]
impl FunctionCallsExample {
    pub fn get_price_no_older_than(&mut self) -> Result<(), Vec<u8>> {
       let price =   get_price_no_older_than(self, self.pyth_address.get(),self.price_id.get() ,Uint::from(1047483647))?;
       self.price.set(price);
       Ok(())
    }
}