pub use crate::pyth::functions::{
    get_ema_price_no_older_than, get_ema_price_unsafe, get_price_no_older_than, get_price_unsafe,
    get_update_fee, get_valid_time_period, parse_price_feed_updates,
    parse_price_feed_updates_unique, update_price_feeds, update_price_feeds_if_necessary,
};
use alloc::vec::Vec;
use alloy_primitives::{Bytes, B256, U256};
use alloy_sol_types::SolValue;
use stylus_sdk::{
    abi::Bytes as AbiBytes,
    prelude::*,
    storage::{StorageAddress, TopLevelStorage},
};
/// `IPyth` is a trait that defines methods for interacting with the Pyth contract.
pub trait IPyth {
    /// The Error Type for the Pyth Contract.
    /// - `Vec<u8>`: The error message in bytes.
    type Error: Into<alloc::vec::Vec<u8>>;

    /// Retrieves the latest price feed without any recency checks.
    ///
    /// # Parameters
    /// - `id`: The unique identifier for the price feed.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: The price data in bytes, or an error.
    fn get_price_unsafe(&mut self, id: B256) -> Result<Vec<u8>, Self::Error>;

    /// Retrieves a price that is no older than a specified `age`.
    ///
    /// # Parameters
    /// - `id`: The unique identifier for the price feed.
    /// - `age`: The maximum acceptable age of the price in seconds.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: The price data in bytes, or an error.
    fn get_price_no_older_than(&mut self, id: B256, age: U256) -> Result<Vec<u8>, Self::Error>;

    /// Retrieves the exponentially-weighted moving average (EMA) price without recency checks.
    ///
    /// # Parameters
    /// - `id`: The unique identifier for the price feed.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: The EMA price data in bytes, or an error.
    fn get_ema_price_unsafe(&mut self, id: B256) -> Result<Vec<u8>, Self::Error>;

    /// Retrieves an EMA price that is no older than the specified `age`.
    ///
    /// # Parameters
    /// - `id`: The unique identifier for the price feed.
    /// - `age`: The maximum acceptable age of the price in seconds.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: The EMA price data in bytes, or an error.
    fn get_ema_price_no_older_than(&mut self, id: B256, age: U256) -> Result<Vec<u8>, Self::Error>;

    /// Updates price feeds with the given data.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    ///
    /// # Returns
    /// - `Result<(), Self::Error>`: Success or error.
    fn update_price_feeds(&mut self, update_data: Vec<AbiBytes>) -> Result<(), Self::Error>;

    /// Updates price feeds if necessary, based on given publish times.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    /// - `price_ids`: Array of price IDs.
    /// - `publish_times`: Array of publish times for the corresponding price IDs.
    ///
    /// # Returns
    /// - `Result<(), Self::Error>`: Success or error.
    fn update_price_feeds_if_necessary(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        publish_times: Vec<u64>,
    ) -> Result<(), Self::Error>;

    /// Returns the fee required to update the price feeds based on the provided data.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    ///
    /// # Returns
    /// - `Result<U256, Self::Error>`: The required fee in Wei, or an error.
    fn get_update_fee(&mut self, update_data: Vec<AbiBytes>) -> Result<U256, Self::Error>;

    /// Returns the fee required to update the price feeds based on the provided data.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    ///
    /// # Returns
    /// - `Result<U256, Self::Error>`: The required fee in Wei, or an error.
    fn get_valid_time_period(&mut self) -> Result<U256, Self::Error>;

    /// Parses the price feed updates for specific price IDs within a given time range.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    /// - `price_ids`: Array of price IDs to parse.
    /// - `min_publish_time`: Minimum acceptable publish time for the price IDs.
    /// - `max_publish_time`: Maximum acceptable publish time for the price IDs.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: Parsed price feed data in bytes, or an error.
    fn parse_price_feed_updates(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error>;

    /// Parses price feed updates for specific price IDs, ensuring only the first updates within a time range are returned.
    ///
    /// # Parameters
    /// - `update_data`: Array of price update data.
    /// - `price_ids`: Array of price IDs to parse.
    /// - `min_publish_time`: Minimum acceptable publish time for the price IDs.
    /// - `max_publish_time`: Maximum acceptable publish time for the price IDs.
    ///
    /// # Returns
    /// - `Result<Vec<u8>, Self::Error>`: Parsed price feed data in bytes, or an error.
    fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error>;
}

#[storage]
pub struct PythContract {
    pub _ipyth: StorageAddress,
}

unsafe impl TopLevelStorage for PythContract {}

#[public]
impl IPyth for PythContract {
    type Error = Vec<u8>;

    fn get_price_unsafe(&mut self, id: B256) -> Result<Vec<u8>, Self::Error> {
        let price = get_price_unsafe(self, self._ipyth.get(), id)?;
        let data = price.abi_encode();
        Ok(data)
    }

    fn get_price_no_older_than(&mut self, id: B256, age: U256) -> Result<Vec<u8>, Self::Error> {
        let price = get_price_no_older_than(self, self._ipyth.get(), id, age)?;
        let data = price.abi_encode();
        Ok(data)
    }

    fn get_ema_price_unsafe(&mut self, id: B256) -> Result<Vec<u8>, Self::Error> {
        let price = get_ema_price_unsafe(self, self._ipyth.get(), id)?;
        let data = price.abi_encode();
        Ok(data)
    }

    fn get_ema_price_no_older_than(&mut self, id: B256, age: U256) -> Result<Vec<u8>, Self::Error> {
        let price = get_ema_price_no_older_than(self, self._ipyth.get(), id, age)?;
        let data = price.abi_encode();
        Ok(data)
    }

    fn get_valid_time_period(&mut self) -> Result<U256, Self::Error> {
        let time = get_valid_time_period(self, self._ipyth.get())?;
        Ok(time)
    }

    fn get_update_fee(&mut self, update_data: Vec<AbiBytes>) -> Result<U256, Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        let fee = get_update_fee(self, self._ipyth.get(), data)?;
        Ok(fee)
    }

    #[payable]
    fn update_price_feeds(&mut self, update_data: Vec<AbiBytes>) -> Result<(), Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        update_price_feeds(self, self._ipyth.get(), data)?;
        Ok(())
    }

    #[payable]
    fn update_price_feeds_if_necessary(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        publish_times: Vec<u64>,
    ) -> Result<(), Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        update_price_feeds_if_necessary(self, self._ipyth.get(), data, price_ids, publish_times)?;
        Ok(())
    }

    #[payable]
    fn parse_price_feed_updates(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        let encode_data = parse_price_feed_updates(
            self,
            self._ipyth.get(),
            data,
            price_ids,
            min_publish_time,
            max_publish_time,
        )?
        .abi_encode();
        Ok(encode_data)
    }

    #[payable]
    fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        let encode_data = parse_price_feed_updates_unique(
            self,
            self._ipyth.get(),
            data,
            price_ids,
            min_publish_time,
            max_publish_time,
        )?
        .abi_encode();
        Ok(encode_data)
    }
}
