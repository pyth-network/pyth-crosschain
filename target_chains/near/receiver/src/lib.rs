//#![deny(warnings)]

use {
    error::Error,
    ext::ext_wormhole,
    near_sdk::{
        borsh::{BorshDeserialize, BorshSerialize},
        collections::{UnorderedMap, UnorderedSet},
        env, is_promise_success,
        json_types::U128,
        log, near_bindgen, AccountId, BorshStorageKey, Duration, Gas, NearToken, PanicOnDefault,
        Promise, StorageUsage,
    },
    pythnet_sdk::legacy::{BatchPriceAttestation, P2W_MAGIC},
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{
            from_slice,
            v1::{
                AccumulatorUpdateData, Proof, WormholeMessage, WormholePayload,
                PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
            },
        },
    },
    serde_wormhole::RawMessage,
    state::{Price, PriceFeed, PriceIdentifier, Source, Vaa},
    std::{
        collections::HashMap,
        io::{Cursor, Read},
    },
};

pub mod error;
pub mod ext;
#[cfg(not(feature = "library"))]
pub mod governance;
pub mod state;
pub mod tests;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKeys {
    Source,
    Prices,
}

/// Alias to document time unit Pyth expects data to be in.
type Seconds = u64;

/// The `State` contains all persisted state for the contract. This includes runtime configuration.
///
/// There is no valid Default state for this contract, so we derive PanicOnDefault to force
/// deployment using one of the #[init] functions in the impl below. We also want to disable
/// this whole definition if the "library" feature flag is on.
#[cfg(not(feature = "library"))]
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
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
    update_fee: NearToken,
}

#[cfg(not(feature = "library"))]
#[near_bindgen]
impl Pyth {
    #[init]
    #[allow(clippy::new_without_default)]
    pub fn new(
        wormhole: AccountId,
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
            codehash: Default::default(),
            update_fee: NearToken::from_yoctonear(update_fee.into()),
        }
    }

    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        // This currently deserializes and produces the same state, I.E migration is a no-op to the
        // current state.
        //
        // In the case where we want to actually migrate to a new state, we can do this by defining
        // the old State struct here and then deserializing into that, then migrating into the new
        // state, example code for the future reader:
        //
        // ```rust
        // pub fn migrate() -> Self {
        //     pub struct OldPyth {
        //         sources:                        UnorderedSet<Source>,
        //         gov_source:                     Source,
        //         executed_governance_vaa:        u64,
        //         executed_governance_change_vaa: u64,
        //         prices:                         UnorderedMap<PriceIdentifier, PriceFeed>,
        //         wormhole:                       AccountId,
        //         codehash:                       [u8; 32],
        //         stale_threshold:                Duration,
        //         update_fee:                     u128,
        //     }
        //
        //     // Construct new Pyth State from old, perform any migrations needed.
        //     let old: OldPyth = env::state_read().expect("Failed to read state");
        //
        //     Self {
        //        sources:    old.sources,
        //        gov_source: old.gov_source,
        //        ...
        //     }
        // }
        // ```
        let mut state: Self = env::state_read().expect("Failed to read state");
        state.codehash = Default::default();
        state
    }

    /// Instruction for processing VAA's relayed via Wormhole.
    ///
    /// Note that VAA verification requires calling Wormhole so processing of the VAA itself is
    /// done in a callback handler, see `process_vaa_callback`. The `data` parameter can be
    /// retrieved from Hermes using the price feed APIs.
    #[payable]
    #[handle_result]
    pub fn update_price_feeds(&mut self, data: String) -> Result<(), Error> {
        // Attempt to deserialize the Payload based on header.
        let bytes = &*hex::decode(data.clone()).map_err(|_| Error::InvalidHex)?;
        let cursor = &mut Cursor::new(bytes);
        let mut header = [0u8; 4];
        cursor.clone().read_exact(&mut header).unwrap();

        // Handle Accumulator style Price Updates.
        if &header == PYTHNET_ACCUMULATOR_UPDATE_MAGIC {
            let update_data =
                AccumulatorUpdateData::try_from_slice(&cursor.clone().into_inner()).unwrap();

            match update_data.proof {
                Proof::WormholeMerkle { vaa, .. } => {
                    self.verify_encoded_vaa_source(vaa.as_ref())?;
                    let vaa_hex = hex::encode(vaa.as_ref());
                    ext_wormhole::ext(self.wormhole.clone())
                        .with_static_gas(Gas::from_gas(30_000_000_000_000))
                        .verify_vaa(vaa_hex.clone())
                        .then(
                            Self::ext(env::current_account_id())
                                .with_static_gas(Gas::from_gas(30_000_000_000_000))
                                .with_attached_deposit(env::attached_deposit())
                                .verify_wormhole_merkle_callback(
                                    env::predecessor_account_id(),
                                    data,
                                ),
                        )
                        .then(
                            Self::ext(env::current_account_id())
                                .with_static_gas(Gas::from_gas(30_000_000_000_000))
                                .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
                        );
                }
            };
        } else {
            // We Verify the VAA is coming from a trusted source chain before attempting to verify
            // VAA signatures. Avoids a cross-contract call early.
            self.verify_encoded_vaa_source(bytes)?;

            // Verify VAA and refund the caller in case of failure.
            ext_wormhole::ext(self.wormhole.clone())
                .with_static_gas(Gas::from_gas(30_000_000_000_000))
                .verify_vaa(data.clone())
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(Gas::from_gas(30_000_000_000_000))
                        .with_attached_deposit(env::attached_deposit())
                        .verify_wormhole_batch_callback(env::predecessor_account_id(), data),
                )
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(Gas::from_gas(30_000_000_000_000))
                        .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
                );
        }

        Ok(())
    }

    #[payable]
    #[private]
    #[handle_result]
    pub fn verify_wormhole_batch_callback(
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
        let storage = env::storage_usage();

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(&vaa).unwrap();
        let vaa: wormhole_sdk::Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();

        // Attempt to deserialize the Payload based on header.
        let bytes = &mut Cursor::new(vaa.payload);
        let mut header = [0u8; 4];
        bytes.clone().read_exact(&mut header).unwrap();

        // Check the header is a P2W header and return if not.
        if &header != P2W_MAGIC {
            return Err(Error::InvalidVaa);
        }

        // Verify the PriceAttestation's are new enough, and if so, store them.
        let mut count_updates = 0;
        let batch = BatchPriceAttestation::deserialize(bytes).unwrap();
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
            env::storage_byte_cost()
                .checked_mul(env::storage_usage().checked_sub(storage).unwrap().into())
                .unwrap(),
        );

        // Refund storage difference to `account_id` after storage execution.
        Self::refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
            Some(self.update_fee),
        )
    }

    #[payable]
    #[private]
    #[handle_result]
    pub fn verify_wormhole_merkle_callback(
        &mut self,
        account_id: AccountId,
        data: String,
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
                    .as_yoctonear()
                    .checked_div(env::storage_byte_cost().as_yoctonear())
                    .ok_or(Error::ArithmeticOverflow)?,
            )
            .ok_or(Error::InsufficientDeposit)
            .and_then(|s| u64::try_from(s).map_err(|_| Error::ArithmeticOverflow))?;

        let mut count_updates = 0;
        let bytes = &*hex::decode(data.clone()).map_err(|_| Error::InvalidHex)?;
        let cursor = &mut Cursor::new(bytes);
        let update_data =
            AccumulatorUpdateData::try_from_slice(&cursor.clone().into_inner()).unwrap();

        match update_data.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                let vaa: wormhole_sdk::Vaa<&RawMessage> =
                    serde_wormhole::from_slice(vaa.as_ref()).unwrap();
                let message = WormholeMessage::try_from_bytes(vaa.payload)
                    .map_err(|_| Error::InvalidWormholeMessage)?;
                let root: MerkleRoot<Keccak160> = MerkleRoot::new(match message.payload {
                    WormholePayload::Merkle(merkle_root) => merkle_root.root,
                });

                for update in updates {
                    let message_vec = Vec::from(update.message);
                    if !root.check(update.proof, &message_vec) {
                        return Err(Error::InvalidMerkleProof)?;
                    }

                    let msg = from_slice::<byteorder::BE, Message>(&message_vec)
                        .map_err(|_| Error::InvalidAccumulatorMessage)?;

                    match msg {
                        Message::PriceFeedMessage(price_feed_message) => {
                            if self.update_price_feed_if_new(PriceFeed::from(&price_feed_message)) {
                                count_updates += 1;
                            }
                        }
                        _ => return Err(Error::InvalidAccumulatorMessageType)?,
                    }
                }
            }
        }

        log!(
            r#"
            {{
                "standard": "pyth",
                "version":  "1.0",
                "event":    "AccumulatorUpdates",
                "data":     {{
                    "count": {},
                    "diffs": {},
                    "costs": {},
                }}
            }}
            "#,
            count_updates,
            env::storage_usage() - storage,
            env::storage_byte_cost()
                .checked_mul(env::storage_usage().checked_sub(storage).unwrap().into())
                .unwrap(),
        );

        // Refund storage difference to `account_id` after storage execution.
        Self::refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
            Some(self.update_fee),
        )
    }

    /// Return the deposit required to update a price feed. This is the upper limit for an update
    /// call and any remaining deposit not consumed for storage will be refunded.
    #[allow(unused_variables)]
    pub fn get_update_fee_estimate(&self, data: String) -> U128 {
        let byte_cost = env::storage_byte_cost();
        let data_cost = byte_cost
            .checked_mul(std::mem::size_of::<PriceFeed>().try_into().unwrap())
            .unwrap();

        // If the data is an Accumulator style update, we should count he number of updates being
        // calculated in the fee.
        let bytes = hex::decode(data).unwrap();
        let cursor = &mut Cursor::new(bytes);
        let mut header = [0u8; 4];
        let mut total_updates = 0u128;
        cursor.clone().read_exact(&mut header).unwrap();
        if &header == PYTHNET_ACCUMULATOR_UPDATE_MAGIC {
            let update_data =
                AccumulatorUpdateData::try_from_slice(&cursor.clone().into_inner()).unwrap();
            match update_data.proof {
                Proof::WormholeMerkle { vaa: _, updates } => {
                    total_updates += updates.len() as u128;
                }
            }
        } else {
            total_updates = 1;
        }

        // The const multiplications here are to provide additional headway for any unexpected data
        // costs in NEAR's storage calculations.
        //
        // 5 is the upper limit for PriceFeed amount in a single update.
        // 4 is the value obtained through testing for headway.
        (data_cost
            .checked_mul(5u128 * 4u128)
            .unwrap()
            .checked_add(self.update_fee.checked_mul(total_updates).unwrap())
            .unwrap())
        .as_yoctonear()
        .into()
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
    /// Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for
    /// how to how this price safely.
    ///
    /// IMPORTANT:
    /// Pyth uses an on-demand update model, where consumers need to update the cached prices
    /// before using them. Please read more about this at https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand.
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
    pub fn get_price_no_older_than(
        &self,
        price_id: PriceIdentifier,
        age: Seconds,
    ) -> Option<Price> {
        self.prices.get(&price_id).and_then(|feed| {
            let block_timestamp = env::block_timestamp() / 1_000_000_000;
            let price_timestamp = feed.price.publish_time;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp.try_into().unwrap()) > age {
                return None;
            }

            Some(feed.price)
        })
    }

    /// Batch version of `get_price`.
    pub fn list_prices(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        self.list_prices_no_older_than(price_ids, self.stale_threshold)
    }

    /// Batch version of `get_price_unsafe`.
    pub fn list_prices_unsafe(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        self.list_prices_no_older_than(price_ids, u64::MAX)
    }

    /// Batch version of `get_price_no_older_than`.
    pub fn list_prices_no_older_than(
        &self,
        price_ids: Vec<PriceIdentifier>,
        age: Seconds,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        price_ids
            .into_iter()
            .map(|price_id| {
                if let Some(feed) = self.prices.get(&price_id) {
                    let block_timestamp = env::block_timestamp() / 1_000_000_000;
                    let price_timestamp = feed.price.publish_time;

                    // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
                    // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
                    // - Any other price around the current time is considered valid.
                    if u64::abs_diff(block_timestamp, price_timestamp.try_into().unwrap()) > age {
                        (price_id, None)
                    } else {
                        (price_id, Some(feed.price))
                    }
                } else {
                    (price_id, None)
                }
            })
            .collect()
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
        age: Seconds,
    ) -> Option<Price> {
        self.prices.get(&price_id).and_then(|feed| {
            let block_timestamp = env::block_timestamp() / 1_000_000_000;
            let price_timestamp = feed.ema_price.publish_time;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp.try_into().unwrap()) > age {
                return None;
            }

            Some(feed.ema_price)
        })
    }

    /// EMA version of `list_prices`.
    pub fn list_ema_prices(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        self.list_ema_prices_no_older_than(price_ids, self.get_stale_threshold())
    }

    /// EMA version of `list_prices_unsafe`.
    pub fn list_ema_prices_unsafe(
        &self,
        price_ids: Vec<PriceIdentifier>,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        self.list_ema_prices_no_older_than(price_ids, u64::MAX)
    }

    /// EMA version of `list_prices_no_older_than`.
    pub fn list_ema_prices_no_older_than(
        &self,
        price_ids: Vec<PriceIdentifier>,
        age: Seconds,
    ) -> HashMap<PriceIdentifier, Option<Price>> {
        price_ids
            .into_iter()
            .map(|price_id| {
                if let Some(feed) = self.prices.get(&price_id) {
                    let block_timestamp = env::block_timestamp() / 1_000_000_000;
                    let price_timestamp = feed.ema_price.publish_time;

                    // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
                    // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
                    // - Any other price around the current time is considered valid.
                    if u64::abs_diff(block_timestamp, price_timestamp.try_into().unwrap()) > age {
                        (price_id, None)
                    } else {
                        (price_id, Some(feed.ema_price))
                    }
                } else {
                    (price_id, None)
                }
            })
            .collect()
    }
}

/// This second `impl Pyth` block contains only private methods that are called internally that
/// have no transaction semantics associated with them. Note that these do not need `#[private]`
/// annotations as they are already uncallable.
#[cfg(not(feature = "library"))]
impl Pyth {
    /// Verify a VAA source from a serialized VAA.
    fn verify_encoded_vaa_source(&self, vaa: &[u8]) -> Result<(), Error> {
        let vaa: wormhole_sdk::Vaa<&RawMessage> = serde_wormhole::from_slice(vaa).unwrap();

        // Convert to local VAA type to catch API changes.
        let vaa: Vaa<&RawMessage> = Vaa::from(vaa);

        if !self.sources.contains(&Source {
            emitter: vaa.emitter_address,
            chain: vaa.emitter_chain,
        }) {
            return Err(Error::UnknownSource(vaa.emitter_address));
        }

        Ok(())
    }

    /// Updates the Price Feed only if it is newer than the current one. This function never fails
    /// and will either update in-place or not update at all. The return value indicates whether
    /// the update was performed or not.
    fn update_price_feed_if_new(&mut self, price_feed: PriceFeed) -> bool {
        match self.prices.get(&price_feed.id) {
            Some(stored_price_feed) => {
                let update = price_feed.price.publish_time > stored_price_feed.price.publish_time;
                update.then(|| self.prices.insert(&price_feed.id, &price_feed));
                update
            }

            None => {
                self.prices.insert(&price_feed.id, &price_feed);
                true
            }
        }
    }

    /// Checks storage usage invariants and additionally refunds the caller if they overpay. This
    /// method can optionally charge a fee to the caller which is removed from their deposit during
    /// refund.
    fn refund_storage_usage(
        recipient: AccountId,
        before: StorageUsage,
        after: StorageUsage,
        deposit: NearToken,
        additional_fee: Option<NearToken>,
    ) -> Result<(), Error> {
        let fee = additional_fee.unwrap_or_default();

        if let Some(diff) = after.checked_sub(before) {
            // Handle storage increases if checked_sub succeeds.
            let cost = (env::storage_byte_cost().checked_mul(diff.into()).unwrap())
                .checked_add(fee)
                .unwrap();

            // Use match
            match deposit.checked_sub(cost) {
                Some(refund) => {
                    if !refund.is_zero() {
                        Promise::new(recipient).transfer(refund);
                    }
                }
                None => {
                    return Err(Error::InsufficientDeposit);
                }
            }
        } else {
            // If checked_sub fails we have a storage decrease, we want to refund them the cost of
            // the amount reduced, as well the original deposit they sent.
            let storage_refund = env::storage_byte_cost()
                .checked_mul(before.checked_sub(after).unwrap().into())
                .unwrap();
            let refund = storage_refund
                .checked_add(deposit)
                .unwrap()
                .checked_sub(fee)
                .unwrap();
            Promise::new(recipient).transfer(refund);
        }

        Ok(())
    }
}
