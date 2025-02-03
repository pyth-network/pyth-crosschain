#![cfg_attr(not(test), no_std, no_main)]
#![allow(clippy::let_unit_value)]
extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use alloy_primitives::U256;
use alloy_sol_types::sol;
use pyth_stylus::pyth::{
    functions::{
        get_ema_price_no_older_than, get_ema_price_unsafe, get_price_no_older_than,
        get_price_unsafe, get_update_fee, get_valid_time_period, update_price_feeds,
    },
    mock::create_price_feed_update_data_list,
    types::StoragePrice,
};
use stylus_sdk::{
    prelude::{entrypoint, public, storage},
    storage::{StorageAddress, StorageB256},
    stylus_proc::SolidityError,
};

#[entrypoint]
#[storage]
struct FunctionCallsExample {
    pyth_address: StorageAddress,
    price_id: StorageB256,
    price: StoragePrice,
}

sol! {
    error ArraySizeNotMatch();
    error CallFailed();
}

#[derive(SolidityError)]
pub enum MultiCallErrors {
    ArraySizeNotMatch(ArraySizeNotMatch),

    CallFailed(CallFailed),
}

#[public]
impl FunctionCallsExample {
    pub fn get_price_unsafe(&mut self) -> Result<i64, Vec<u8>> {
        let price_result = get_price_unsafe(self, self.pyth_address.get(), self.price_id.get())?;
        self.price.set(price_result);
        Ok(price_result.price)
    }

    pub fn get_ema_price_unsafe(&mut self) -> Result<i64, Vec<u8>> {
        let price_result =
            get_ema_price_unsafe(self, self.pyth_address.get(), self.price_id.get())?;
        Ok(price_result.price)
    }
    pub fn get_price_no_older_than(&mut self) -> Result<i64, Vec<u8>> {
        let price_result = get_price_no_older_than(
            self,
            self.pyth_address.get(),
            self.price_id.get(),
            U256::from(1000),
        )?;
        Ok(price_result.price)
    }

    pub fn get_ema_price_no_older_than(&mut self) -> Result<i64, Vec<u8>> {
        let price_result = get_ema_price_no_older_than(
            self,
            self.pyth_address.get(),
            self.price_id.get(),
            U256::from(1000),
        )?;
        Ok(price_result.price)
    }

    pub fn get_update_fee(&mut self) -> Result<U256, Vec<u8>> {
        let (data, _) = create_price_feed_update_data_list();
        let fee = get_update_fee(self, self.pyth_address.get(), data)?;
        Ok(fee)
    }

    pub fn get_valid_time_period(&mut self) -> Result<U256, Vec<u8>> {
        let time = get_valid_time_period(self, self.pyth_address.get())?;
        Ok(time)
    }

    #[payable]
    pub fn update_price_feeds(&mut self) -> Result<(), Vec<u8>> {
        let (data_bytes, _) = create_price_feed_update_data_list();
        let _ = update_price_feeds(self, self.pyth_address.get(), data_bytes)?;
        Ok(())
    }
}
