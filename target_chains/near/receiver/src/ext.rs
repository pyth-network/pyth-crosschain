//! This module defines external contract API's that are used by the contract. This includes
//! Wormhole and perhaps any ancillary Pyth contracts.

use {
    crate::{
        error::Error,
        state::{Price, PriceIdentifier, Source},
    },
    near_sdk::{ext_contract, json_types::U128},
    std::collections::HashMap,
};

/// Defines the external contract API we care about for interacting with Wormhole. Note that
/// Wormhole on NEAR passes VAA's as hex encoded strings so that the explorer can display them in a
/// clean way. This may require juggling between Vec<u8> and HexString.
#[ext_contract(ext_wormhole)]
pub trait Wormhole {
    /// Returns the Governance Index of the current GuardianSet only if the VAA verifies.
    fn verify_vaa(&self, vaa: String) -> u32;
}

/// An external definition of the Pyth interface.
#[ext_contract(ext_pyth)]
pub trait Pyth {
    // See the implementation for details. The `data` parameter can be found by using a Hermes
    // price feed endpoint, and should be fed in as base64.
    #[handle_result]
    fn update_price_feeds(&mut self, data: String) -> Result<(), Error>;
    fn get_update_fee_estimate(&self, vaa: String) -> U128;
    fn get_sources(&self) -> Vec<Source>;
    fn get_stale_threshold(&self) -> u64;

    // See implementations for details, PriceIdentifier can be passed either as a 64 character
    // hex price ID which can be found on the Pyth homepage.
    fn price_feed_exists(&self, price_identifier: PriceIdentifier) -> bool;
    fn get_price(&self, price_identifier: PriceIdentifier) -> Option<Price>;
    fn get_price_unsafe(&self, price_identifier: PriceIdentifier) -> Option<Price>;
    fn get_price_no_older_than(&self, price_id: PriceIdentifier, age: u64) -> Option<Price>;
    fn get_ema_price(&self, price_id: PriceIdentifier) -> Option<Price>;
    fn get_ema_price_unsafe(&self, price_id: PriceIdentifier) -> Option<Price>;
    fn get_ema_price_no_older_than(&self, price_id: PriceIdentifier, age: u64) -> Option<Price>;
    fn list_prices(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
    fn list_prices_unsafe(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
    fn list_prices_no_older_than(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
    fn list_ema_prices(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
    fn list_ema_prices_unsafe(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
    fn list_ema_prices_no_older_than(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>>;
}
