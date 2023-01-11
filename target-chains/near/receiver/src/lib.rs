//#![deny(warnings)]

use {
    error::Error,
    ext::ext_wormhole,
    near_sdk::{
        borsh::{
            self,
            BorshDeserialize,
            BorshSerialize,
        },
        collections::{
            UnorderedMap,
            UnorderedSet,
        },
        env,
        is_promise_success,
        json_types::U128,
        log,
        near_bindgen,
        AccountId,
        Balance,
        BorshStorageKey,
        Duration,
        Gas,
        PanicOnDefault,
        Promise,
        StorageUsage,
    },
    p2w_sdk::BatchPriceAttestation,
    state::{
        Price,
        PriceFeed,
        PriceIdentifier,
        Source,
        Vaa,
    },
    std::io::Cursor,
};

pub mod error;
pub mod ext;
pub mod governance;
pub mod state;
pub mod tests;

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKeys {
    Source,
    Prices,
}

/// The `State` contains all persisted state for the contract. This includes runtime configuration.
///
/// There is no valid Default state for this contract, so we derive PanicOnDefault to force
/// deployment using one of the #[init] functions in the impl below.
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Pyth {
    /// The set of `Source`s from which Pyth attestations are allowed to be relayed from.
    sources: UnorderedSet<Source>,

    /// The Governance Source.
    gov_source: Source,

    /// The last executed sequence number for all governance actions.
    executed_governance_vaa: u64,

    /// The last executed sequence number only for governance change actions.
    executed_governance_change_vaa: u64,

    /// A Mapping from PriceFeed ID to Price Info.
    prices: UnorderedMap<PriceIdentifier, PriceFeed>,

    /// The `AccountId` of the Wormhole contract used to verify VAA's.
    wormhole: AccountId,

    /// A hash of the current contract code.
    ///
    /// If this `hash` does not match the current contract code, then it indicates that a pending
    /// upgrade has been allowed, calling `upgrade` with code that matches this hash will cause the
    /// contract to upgrade itself.
    codehash: [u8; 32],

    /// Staleness threshold for rejecting price updates.
    stale_threshold: Duration,

    /// Fee for updating price.
    update_fee: u128,
}

#[near_bindgen]
impl Pyth {
    #[init]
    #[allow(clippy::new_without_default)]
    pub fn new(
        wormhole: AccountId,
        codehash: [u8; 32],
        initial_source: Source,
        gov_source: Source,
        update_fee: U128,
        stale_threshold: u64,
    ) -> Self {
        // Add an initial Source so that the contract can be used.
        let mut sources = UnorderedSet::new(StorageKeys::Source);
        sources.insert(&initial_source);
        Self {
            prices: UnorderedMap::new(StorageKeys::Prices),
            executed_governance_vaa: 0,
            executed_governance_change_vaa: 0,
            stale_threshold,
            gov_source,
            sources,
            wormhole,
            codehash,
            update_fee: update_fee.into(),
        }
    }

    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let state: Self = env::state_read().expect("Failed to read state");
        state
    }

    /// Instruction for processing VAA's relayed via Wormhole.
    ///
    /// Note that VAA verification requires calling Wormhole so processing of the VAA itself is
    /// done in a callback handler, see `process_vaa_callback`.
    #[payable]
    #[handle_result]
    pub fn update_price_feed(&mut self, vaa_hex: String) -> Result<(), Error> {
        // We Verify the VAA is coming from a trusted source chain before attempting to verify
        // VAA signatures. Avoids a cross-contract call early.
        let vaa = hex::decode(&vaa_hex).map_err(|_| Error::InvalidHex)?;
        let vaa = serde_wormhole::from_slice_with_payload::<wormhole::Vaa<()>>(&vaa);
        let vaa = vaa.map_err(|_| Error::InvalidVaa)?;
        let (vaa, _rest) = vaa;

        // Convert to local VAA type to catch APi changes.
        let vaa = Vaa::from(vaa);

        if !self.sources.contains(&Source {
            emitter: vaa.emitter_address,
            chain:   vaa.emitter_chain,
        }) {
            return Err(Error::UnknownSource);
        }

        // Verify VAA and refund the caller in case of failure.
        ext_wormhole::ext(self.wormhole.clone())
            .with_static_gas(Gas(30_000_000_000_000))
            .verify_vaa(vaa_hex.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .with_attached_deposit(env::attached_deposit())
                    .verify_vaa_callback(env::predecessor_account_id(), vaa_hex),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
            );

        Ok(())
    }

    /// Return the deposit required to update a price feed. This is the upper limit for an update
    /// call and any remaining deposit not consumed for storage will be refunded.
    #[allow(unused_variables)]
    pub fn get_update_fee_estimate(&self, vaa: String) -> U128 {
        let byte_cost = env::storage_byte_cost();
        let data_cost = byte_cost * std::mem::size_of::<PriceFeed>() as u128;

        // The const multiplications here are to provide additional headway for any unexpected data
        // costs in NEAR's storage calculations.
        //
        // 5 is the upper limit for PriceFeed amount in a single update.
        // 4 is the value obtained through testing for headway.
        (5u128 * 4u128 * data_cost + self.update_fee).into()
    }

    #[payable]
    #[private]
    #[handle_result]
    pub fn verify_vaa_callback(
        &mut self,
        account_id: AccountId,
        vaa: String,
        #[callback_result] _result: Result<u32, near_sdk::PromiseError>,
    ) -> Result<(), Error> {
        if !is_promise_success() {
            return Err(Error::VaaVerificationFailed);
        }

        // Get Storage Usage before execution, subtracting the fee from the deposit has the effect
        // forces the caller to add the required fee to the deposit. The protocol defines the fee
        // as a u128, but storage is a u64, so we need to check that the fee does not overflow the
        // storage cost as well.
        let storage = (env::storage_usage() as u128)
            .checked_sub(
                self.update_fee
                    .checked_div(env::storage_byte_cost())
                    .ok_or(Error::ArithmeticOverflow)?,
            )
            .ok_or(Error::InsufficientDeposit)
            .and_then(|s| u64::try_from(s).map_err(|_| Error::ArithmeticOverflow))?;

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(&vaa).unwrap();
        let (_, rest): (wormhole::Vaa<()>, _) =
            serde_wormhole::from_slice_with_payload(&vaa).unwrap();

        // Attempt to deserialize the Batch of Price Attestations.
        let bytes = &mut Cursor::new(rest);
        let batch = BatchPriceAttestation::deserialize(bytes).unwrap();

        // Verify the PriceAttestation's are new enough, and if so, store them.
        let mut count_updates = 0;
        for price_attestation in &batch.price_attestations {
            if self.update_price_feed_if_new(PriceFeed::from(price_attestation)) {
                count_updates += 1;
            }
        }

        log!(
            r#"
            {{
                "standard": "pyth",
                "version":  "1.0",
                "event":    "BatchAttest",
                "data":     {{
                    "count": {},
                    "diffs": {},
                    "costs": {},
                }}
            }}
        "#,
            count_updates,
            env::storage_usage() - storage,
            env::storage_byte_cost() * (env::storage_usage() - storage) as u128,
        );

        // Refund storage difference to `account_id` after storage execution.
        self.refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
        )
    }

    /// Read the list of accepted `Source` chains for a price attestation.
    pub fn get_sources(&self) -> Vec<Source> {
        self.sources.iter().collect()
    }

    /// Get the current staleness threshold.
    pub fn get_stale_threshold(&self) -> u64 {
        self.stale_threshold
    }

    /// Determine if a price feed for the given price_identifier exists
    pub fn price_feed_exists(&self, price_identifier: PriceIdentifier) -> bool {
        self.prices.get(&price_identifier).is_some()
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the stale price threshold.
    ///
    /// Please refer to the documentation at https://docs.pyth.network/consumers/best-practices for
    /// how to how this price safely.
    ///
    /// IMPORTANT:
    /// Pyth uses an on-demand update model, where consumers need to update the cached prices
    /// before using them. Please read more about this at https://docs.pyth.network/consume-data/on-demand.
    pub fn get_price(&self, price_identifier: PriceIdentifier) -> Option<Price> {
        self.get_price_no_older_than(price_identifier, self.stale_threshold)
    }

    /// Get the latest available price cached for the given price identifier.
    ///
    /// WARNING:
    ///
    /// the returned price can be from arbitrarily far in the past. This function makes no
    /// guarantees that the returned price is recent or useful for any particular application.
    /// Users of this function should check the returned timestamp to ensure that the returned
    /// price is sufficiently recent for their application. The checked get_price_no_older_than()
    /// function should be used in preference to this.
    pub fn get_price_unsafe(&self, price_identifier: PriceIdentifier) -> Option<Price> {
        self.get_price_no_older_than(price_identifier, u64::MAX)
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the given age.
    pub fn get_price_no_older_than(&self, price_id: PriceIdentifier, age: u64) -> Option<Price> {
        self.prices.get(&price_id).and_then(|feed| {
            let block_timestamp = env::block_timestamp() / 1_000_000_000;
            let price_timestamp = feed.price.timestamp;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp) > age {
                return None;
            }

            Some(feed.price)
        })
    }

    /// EMA version of `get_price`.
    pub fn get_ema_price(&self, price_id: PriceIdentifier) -> Option<Price> {
        self.get_ema_price_no_older_than(price_id, self.get_stale_threshold())
    }

    /// EMA version of `get_price_unsafe`.
    pub fn get_ema_price_unsafe(&self, price_id: PriceIdentifier) -> Option<Price> {
        self.get_ema_price_no_older_than(price_id, u64::MAX)
    }

    /// EMA version of `get_price_no_older_than`.
    pub fn get_ema_price_no_older_than(
        &self,
        price_id: PriceIdentifier,
        age: u64,
    ) -> Option<Price> {
        self.prices.get(&price_id).and_then(|feed| {
            let block_timestamp = env::block_timestamp();
            let price_timestamp = feed.ema_price.timestamp;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp) > age {
                return None;
            }

            Some(feed.ema_price)
        })
    }
}

/// This second `impl Pyth` block contains only private methods that are called internally that
/// have no transaction semantics associated with them. Note that these do not need `#[private]`
/// annotations as they are already uncallable.
impl Pyth {
    /// Updates the Price Feed only if it is newer than the current one. This function never fails
    /// and will either update in-place or not update at all. The return value indicates whether
    /// the update was performed or not.
    fn update_price_feed_if_new(&mut self, price_feed: PriceFeed) -> bool {
        match self.prices.get(&price_feed.id) {
            Some(stored_price_feed) => {
                let update = price_feed.price.timestamp > stored_price_feed.price.timestamp;
                update.then(|| self.prices.insert(&price_feed.id, &price_feed));
                update
            }

            None => {
                self.prices.insert(&price_feed.id, &price_feed);
                true
            }
        }
    }

    /// Checks storage usage invariants and additionally refunds the caller if they overpay.
    fn refund_storage_usage(
        &self,
        refunder: AccountId,
        before: StorageUsage,
        after: StorageUsage,
        deposit: Balance,
    ) -> Result<(), Error> {
        if let Some(diff) = after.checked_sub(before) {
            // Handle storage increases if checked_sub succeeds.
            let cost = Balance::from(diff);
            let cost = cost * env::storage_byte_cost();

            // If the cost is higher than the deposit we bail.
            if cost > deposit {
                return Err(Error::InsufficientDeposit);
            }

            // Otherwise we refund whatever is left over.
            if deposit - cost > 0 {
                Promise::new(refunder).transfer(cost);
            }
        } else {
            // Handle storage decrease if checked_sub fails. We know storage used now is <=
            let refund = Balance::from(before - after);
            let refund = refund * env::storage_byte_cost();
            Promise::new(refunder).transfer(refund);
        }

        Ok(())
    }
}

#[no_mangle]
pub extern "C" fn update_contract() {
    env::setup_panic_hook();
    let mut contract: Pyth = env::state_read().expect("Failed to Read State");
    contract.upgrade(env::input().unwrap()).unwrap();
}
