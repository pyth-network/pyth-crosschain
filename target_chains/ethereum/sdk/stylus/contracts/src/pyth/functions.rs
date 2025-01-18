#![allow(clippy::too_many_arguments)]
use crate::pyth::mock::DecodeDataType;
use crate::pyth::types::{
    getEmaPriceNoOlderThanCall, getEmaPriceUnsafeCall, getPriceNoOlderThanCall, getPriceUnsafeCall,
    getUpdateFeeCall, getValidTimePeriodCall, parsePriceFeedUpdatesCall,
    parsePriceFeedUpdatesUniqueCall, updatePriceFeedsCall, updatePriceFeedsIfNecessaryCall, Price,
    PriceFeed,
};
use crate::utils::{call_helper, delegate_call_helper};
use alloc::vec::Vec;
use alloy_primitives::{Address, Bytes, B256, U256};
use alloy_sol_types::SolType;
use stylus_sdk::storage::TopLevelStorage;

/// Retrieves the price for a given asset ID from the Pyth price feed, ensuring the price is not older than a specified age.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `id`: The fixed byte identifier for the asset whose price is being retrieved.
/// - `age`: The maximum allowed age of the price.
///
/// # Returns
/// - `Result<Price, Vec<u8>>`: A `Result` that contains the `Price` struct if successful, or an error message as a byte vector.
pub fn get_price_no_older_than(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    id: B256,
    age: U256,
) -> Result<Price, Vec<u8>> {
    let price_call = call_helper::<getPriceNoOlderThanCall>(storage, pyth_address, (id, age))?;
    Ok(price_call.price)
}

/// Queries the contract for the fee required to update price data, given the update data as input.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `update_data`: A vector of bytes containing the data required for the update.
///
/// # Returns
/// - `Result<U256, Vec<u8>>`: A `Result` containing the update fee as a `U256` if successful, or an error message as a byte vector.
pub fn get_update_fee(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    update_data: Vec<Bytes>,
) -> Result<U256, Vec<u8>> {
    let update_fee_call = call_helper::<getUpdateFeeCall>(storage, pyth_address, (update_data,))?;
    Ok(update_fee_call.feeAmount)
}

/// Retrieves the Exponential Moving Average (EMA) price for a specific asset ID without safety checks.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `id`: The fixed byte identifier for the asset whose EMA price is being retrieved.
///
/// # Returns
/// - `Result<Price, Vec<u8>>`: A `Result` containing the `Price` struct if successful, or an error message as a byte vector.
pub fn get_ema_price_unsafe(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    id: B256,
) -> Result<Price, Vec<u8>> {
    let ema_price = call_helper::<getEmaPriceUnsafeCall>(storage, pyth_address, (id,))?;
    Ok(ema_price.price)
}

/// Similar to `get_ema_price_unsafe`, but ensures the EMA price is not older than a specified age.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `id`: The fixed byte identifier for the asset whose EMA price is being retrieved.
/// - `age`: The maximum allowed age of the EMA price.
///
/// # Returns
/// - `Result<Price, Vec<u8>>`: A `Result` containing the `Price` struct if successful, or an error message as a byte vector.
pub fn get_ema_price_no_older_than(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    id: B256,
    age: U256,
) -> Result<Price, Vec<u8>> {
    let ema_price = call_helper::<getEmaPriceNoOlderThanCall>(storage, pyth_address, (id, age))?;
    Ok(ema_price.price)
}

/// Retrieves the current price for a given asset ID without safety checks, constructing a `Price` struct from raw values.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `id`: The fixed byte identifier for the asset whose price is being retrieved.
///
/// # Returns
/// - `Result<Price, Vec<u8>>`: A `Result` containing the constructed `Price` struct if successful, or an error message as a byte vector.
pub fn get_price_unsafe(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    id: B256,
) -> Result<Price, Vec<u8>> {
    let price = call_helper::<getPriceUnsafeCall>(storage, pyth_address, (id,))?;
    let price = Price {
        price: price._0,
        conf: price._1,
        expo: price._2,
        publish_time: price._3,
    };
    Ok(price)
}

/// Queries the Pyth contract to get the valid time period for price feeds.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
///
/// # Returns
/// - `Result<U256, Vec<u8>>`: A `Result` containing the valid time period as a `U256` if successful, or an error message as a byte vector.
pub fn get_valid_time_period(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
) -> Result<U256, Vec<u8>> {
    let valid_time_period = call_helper::<getValidTimePeriodCall>(storage, pyth_address, ())?;
    Ok(valid_time_period.validTimePeriod)
}

/// Updates the price feeds in the Pyth contract using the provided update data.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `update_data`: A vector of bytes containing the data required for the update.
///
/// # Returns
/// - `Result<(), Vec<u8>>`: A `Result` that indicates success or failure, returning an error message as a byte vector if unsuccessful.
pub fn update_price_feeds(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    update_data: Vec<Bytes>,
) -> Result<(), Vec<u8>> {
    delegate_call_helper::<updatePriceFeedsCall>(storage, pyth_address, (update_data,))?;
    Ok(())
}

/// Updates price feeds only if necessary, based on provided price IDs and publish times.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `update_data`: A vector of bytes containing the data required for the update.
/// - `price_ids`: A vector of fixed byte identifiers for the assets to update.
/// - `publish_times`: A vector of timestamps indicating when the prices were published.
///
/// # Returns
/// - `Result<(), Vec<u8>>`: A `Result` that indicates success or failure, returning an error message as a byte vector if unsuccessful.
pub fn update_price_feeds_if_necessary(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    update_data: Vec<Bytes>,
    price_ids: Vec<B256>,
    publish_times: Vec<u64>,
) -> Result<(), Vec<u8>> {
    delegate_call_helper::<updatePriceFeedsIfNecessaryCall>(
        storage,
        pyth_address,
        (update_data, price_ids, publish_times),
    )?;
    Ok(())
}

/// Parses the updates to price feeds, returning a vector of `PriceFeed` structs based on the provided time range.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `update_data`: A vector of bytes containing the data required for the updates.
/// - `price_ids`: A vector of fixed byte identifiers for the assets being updated.
/// - `min_publish_time`: The minimum publish time to consider for the updates.
/// - `max_publish_time`: The maximum publish time to consider for the updates.
///
/// # Returns
/// - `Result<Vec<PriceFeed>, Vec<u8>>`: A `Result` containing a vector of `PriceFeed` structs if successful, or an error message as a byte vector.
pub fn parse_price_feed_updates(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    update_data: Vec<Bytes>,
    price_ids: Vec<B256>,
    min_publish_time: u64,
    max_publish_time: u64,
) -> Result<Vec<PriceFeed>, Vec<u8>> {
    let parse_price_feed_updates_call = delegate_call_helper::<parsePriceFeedUpdatesCall>(
        storage,
        pyth_address,
        (update_data, price_ids, min_publish_time, max_publish_time),
    )?;
    Ok(parse_price_feed_updates_call.priceFeeds)
}

/// Similar to `parse_price_feed_updates`, but only returns the latest price feed for each asset if multiple updates are available.
///
/// # Parameters
/// - `storage`: A mutable reference to an implementation of `TopLevelStorage`.
/// - `pyth_address`: The address of the Pyth price feed contract.
/// - `update_data`: A vector of bytes containing the data required for the updates.
/// - `price_ids`: A vector of fixed byte identifiers for the assets being updated.
/// - `min_publish_time`: The minimum publish time to consider for the updates.
/// - `max_publish_time`: The maximum publish time to consider for the updates.
///
/// # Returns
/// - `Result<Vec<PriceFeed>, Vec<u8>>`: A `Result` containing a vector of `PriceFeed` structs if successful, or an error message as a byte vector.
pub fn parse_price_feed_updates_unique(
    storage: &mut impl TopLevelStorage,
    pyth_address: Address,
    update_data: Vec<Bytes>,
    price_ids: Vec<B256>,
    min_publish_time: u64,
    max_publish_time: u64,
) -> Result<Vec<PriceFeed>, Vec<u8>> {
    let parse_price_feed_updates_call = delegate_call_helper::<parsePriceFeedUpdatesUniqueCall>(
        storage,
        pyth_address,
        (update_data, price_ids, min_publish_time, max_publish_time),
    )?;
    Ok(parse_price_feed_updates_call.priceFeeds)
}

/// Creates the update data required for a price feed, encapsulating the current price, confidence interval,
/// exponential moving average (EMA) price, and other relevant details.
///
/// # Parameters
/// - `id`: The fixed byte identifier for the asset being updated.
/// - `price`: The current price of the asset as a 64-bit signed integer.
/// - `conf`: The confidence level of the current price as a 64-bit unsigned integer.
/// - `expo`: The exponent for the price, indicating its precision.
/// - `ema_price`: The Exponential Moving Average price of the asset as a 64-bit signed integer.
/// - `ema_conf`: The confidence level of the EMA price as a 64-bit unsigned integer.
/// - `publish_time`: The time the price was published, represented as a `U256`.
/// - `prev_publish_time`: The previous publish time of the price, represented as a 64-bit unsigned integer.
///
/// # Returns
/// - `Vec<u8>`: A byte vector containing the encoded update data for the price feed.
pub fn create_price_feed_update_data(
    id: B256,
    price: i64,
    conf: u64,
    expo: i32,
    ema_price: i64,
    ema_conf: u64,
    publish_time: U256,
    prev_publish_time: u64,
) -> Vec<u8> {
    let price = Price {
        price,
        conf,
        expo,
        publish_time,
    };
    let ema_price = Price {
        price: ema_price,
        conf: ema_conf,
        expo,
        publish_time,
    };

    let price_feed_data = PriceFeed {
        id,
        price,
        ema_price,
    };

    let price_feed_data_encoding = (price_feed_data, prev_publish_time);
    DecodeDataType::abi_encode(&price_feed_data_encoding)
}
