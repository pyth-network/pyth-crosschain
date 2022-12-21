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
        log,
        near_bindgen,
        AccountId,
        Balance,
        BorshStorageKey,
        Gas,
        PanicOnDefault,
        Promise,
        StorageUsage,
    },
    p2w_sdk::{
        BatchPriceAttestation,
        Identifier,
        PriceStatus,
    },
    state::{
        PriceFeed,
        Source,
        Vaa,
    },
    std::io::Cursor,
};

pub mod error;
pub mod ext;
pub mod governance;
pub mod state;

const _GAS_FOR_VERIFY_VAA: Gas = Gas(10_000_000_000_000);
const INITIAL_STALENESS_THRESHOLD: u64 = 60;

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
    pub sources: UnorderedSet<Source>,

    /// The Governance Source.
    pub gov_source: Source,

    /// The last executed sequence number for governance actions.
    pub last_gov_seq: u64,

    /// A Mapping from PriceFeed ID to Price Info.
    pub prices: UnorderedMap<Identifier, PriceFeed>,

    /// The `AccountId` of the Wormhole contract used to verify VAA's.
    pub wormhole: AccountId,

    /// A hash of the current contract code.
    ///
    /// If this `hash` does not match the current contract code, then it indicates that a pending
    /// upgrade has been allowed, calling `upgrade` with code that matches this hash will cause the
    /// contract to upgrade itself.
    pub codehash: [u8; 32],

    /// Staleness threshold for rejecting price updates.
    pub stale_threshold: u64,

    /// Fee for updating price.
    pub update_fee: Balance,
}

/// The `Action` acts as an enum of possible `Action`'s this contract can receive via VAA.
#[derive(BorshDeserialize, BorshSerialize)]
pub enum Action {
    BatchAttest(Vec<u8>),
    ContractUpgrade([u8; 32]),
    SetDataSources(Vec<Source>),
    SetGovernanceSource(Source),
    SetStalePriceThreshold(u64),
    SetUpdateFee(Balance),
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
        update_fee: Balance,
        stale_threshold: u64,
    ) -> Self {
        // Add an initial Source so that the contract can be used.
        let mut sources = UnorderedSet::new(StorageKeys::Source);
        sources.insert(&initial_source);
        Self {
            prices: UnorderedMap::new(StorageKeys::Prices),
            last_gov_seq: 0,
            stale_threshold,
            gov_source,
            sources,
            wormhole,
            codehash,
            update_fee,
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
    pub fn update_price_feeds(&mut self, vaas: Vec<String>) -> Result<(), Error> {
        for vaa_hex in vaas {
            // We Verify the VAA is coming from a trusted source chain before attempting to verify
            // VAA signatures. Avoids a cross-contract call early.
            let vaa = hex::decode(&vaa_hex).map_err(|_| Error::InvalidHex)?;
            let vaa = vaa_payload::from_slice_with_payload::<structs::Vaa<()>>(&vaa);
            let vaa = vaa.map_err(|_| Error::InvalidVaa)?;
            let (vaa, _rest) = vaa;

            // Convert to local VAA type to catch APi changes.
            let vaa = Vaa::from(vaa);

            if self.sources.contains(&Source {
                emitter:            vaa.emitter_address,
                pyth_emitter_chain: vaa.emitter_chain,
            }) {
                return Err(Error::UnknownSource);
            }

            // Verify VAA and refund the caller in case of failure.
            ext_wormhole::ext(env::current_account_id())
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
        }

        Ok(())
    }

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

        // Get Storage Usage before execution.
        let storage = env::storage_usage();

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(&vaa).unwrap();
        let (_, rest): (structs::Vaa<()>, _) = vaa_payload::from_slice_with_payload(&vaa).unwrap();

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
                    "count": {}
                }}
            }}
        "#,
            count_updates
        );

        // Refund storage difference to `account_id` after storage execution.
        self.refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
        )
    }

    /// Process a Batch of Price Attestations.
    ///
    /// This receives price updates, verifies them, and stores the attestations in the contract
    /// state allowing other contracts to query them.
    #[private]
    pub fn attest_prices(&mut self, batch: Vec<u8>) {
        // Attempt to deserialize the Batch of Price Attestations.
        let bytes = &mut Cursor::new(batch);
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
                    "count": {}
                }}
            }}
        "#,
            count_updates
        );
    }

    /// Read the list of accepted `Source` chains for a price attestation.
    pub fn get_sources(&self) -> Vec<Source> {
        self.sources.iter().collect()
    }

    /// Read the current Price for a given Price Feed.
    ///
    /// if the price is past the staleness threshold the trading status is set to Unknown before
    /// returning to the caller.
    pub fn get_price(&self, price_id: Identifier) -> Option<PriceFeed> {
        self.prices.get(&price_id).and_then(|mut price| {
            let block_timestamp = env::block_timestamp();
            let price_timestamp = price.publish_time.try_into().ok()?;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp) > INITIAL_STALENESS_THRESHOLD {
                price.status = PriceStatus::Unknown;
            }

            Some(price)
        })
    }
}

impl Pyth {
    /// Updates the Price Feed only if it is newer than the current one. This function never fails
    /// and will either update in-place or not update at all. The return value indicates whether
    /// the update was performed or not.
    fn update_price_feed_if_new(&mut self, price_feed: PriceFeed) -> bool {
        match self.prices.get(&price_feed.id) {
            Some(stored_price_feed) => {
                let update = price_feed.publish_time > stored_price_feed.publish_time;
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

#[cfg(test)]
mod tests {
    use {
        super::*,
        near_sdk::{
            collections::UnorderedSet,
            test_utils::VMContextBuilder,
            testing_env,
            VMContext,
        },
        p2w_sdk::PriceAttestation,
        ContextMode::*,
    };

    enum ContextMode {
        ReadWrite,
        ReadOnly,
    }

    impl From<ContextMode> for bool {
        fn from(mode: ContextMode) -> Self {
            match mode {
                ReadWrite => false,
                ReadOnly => true,
            }
        }
    }

    fn get_context(is_view: ContextMode) -> VMContext {
        VMContextBuilder::new()
            .signer_account_id("bob_near".parse().unwrap())
            .is_view(is_view.into())
            .build()
    }

    // Lazy Static UnorderedSet containing one Pyth Source.
    lazy_static::lazy_static! {
        static ref SOURCE: UnorderedSet<Source> = {
            let mut source = UnorderedSet::new(b"s".to_vec());
            source.insert(&Source {
                emitter:            [0; 32],
                pyth_emitter_chain: 1,
            });
            source
        };
    }

    #[test]
    fn test_contract_init() {
        let contract = Pyth::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        assert_eq!(contract.sources.len(), 0);
        assert_eq!(contract.prices.len(), 0);
    }

    #[test]
    fn test_contract_add_source() {
        let mut contract = Pyth::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        assert_eq!(contract.sources.len(), 1);
    }

    #[test]
    fn test_contract_add_duplicate_source() {
        let mut contract = Pyth::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        // Add One Source.
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Add the same Source again.
        assert_eq!(contract.sources.len(), 1);
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Should only be one.
        assert_eq!(contract.sources.len(), 1);
    }

    #[test]
    fn test_contract_add_and_remove_source() {
        let context = get_context(ReadWrite);
        let mut contract = Pyth::new("wormhole.near".parse().unwrap(), [0; 32]);
        testing_env!(context);

        // Add One Source.
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Remove the Source.
        assert_eq!(contract.sources.len(), 1);
        contract.del_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Should be empty.
        assert_eq!(contract.sources.len(), 0);
    }

    #[test]
    fn test_contract_submit_prices() {
        let context = get_context(ReadWrite);
        let mut contract = Pyth::new("wormhole.near".parse().unwrap(), [0; 32]);
        testing_env!(context);

        contract.attest_prices(&BatchPriceAttestation {
            price_attestations: vec![
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
            ],
        });

        // All four updates are equivelent so only one price update should have happened.
        assert_eq!(contract.prices.len(), 1);
    }
}
