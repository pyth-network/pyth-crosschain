#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec::Vec;
use alloy_sol_types::SolValue;
use pyth_stylus::pyth::{
    pyth_contract::{IPyth, PythContract},
    types::Price,
};
use stylus_sdk::{
    abi::Bytes,
    alloy_primitives::U256,
    msg,
    prelude::{entrypoint, public, storage},
    storage::StorageB256,
    stylus_proc::SolidityError,
};

pub use sol::*;

mod sol {
    use alloy_sol_types::sol;

    sol! {
        /// Indicates an error related to the issue about mismatched signature.
        #[derive(Debug)]
        #[allow(missing_docs)]
        error InsufficientFee();
    }
}

#[derive(SolidityError, Debug)]
pub enum Error {
    InsufficientFee(InsufficientFee),
}

#[entrypoint]
#[storage]
struct PythExample {
    #[borrow]
    pyth: PythContract,
    eth_usd_price_id: StorageB256,
}

#[public]
impl PythExample {
    fn mint(&mut self) -> Result<(), Vec<u8>> {
        // Get the price if it is not older than 60 seconds.
        let price = self
            .pyth
            .get_ema_price_no_older_than(self.eth_usd_price_id.get(), U256::from(60))?;
        let decode_price = Price::abi_decode(&price, false).expect("Failed to decode price");

        let eth_price_18_decimals = U256::from(decode_price.price) / U256::from(decode_price.expo);

        let one_dollar_in_wei = U256::MAX / eth_price_18_decimals;

        if msg::value() >= one_dollar_in_wei {
            // User paid enough money.
            // TODO: mint the NFT here
        } else {
            return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }
        Ok(())
    }

    fn update_and_mint(&mut self, pyth_price_update: Vec<Bytes>) -> Result<(), Vec<u8>> {
        let update_fee = self.pyth.get_update_fee(pyth_price_update.clone())?;
        if update_fee < msg::value() {
            return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }
        self.pyth.update_price_feeds(pyth_price_update)?;
        self.mint()?;
        Ok(())
    }
}
