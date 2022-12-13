//#![deny(warnings)]

use {
    error::Error,
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
        BorshStorageKey,
        Gas,
        PanicOnDefault,
        Promise,
    },
    p2w_sdk::{
        BatchPriceAttestation,
        Identifier,
        PriceStatus,
    },
    state::{
        PriceFeed,
        Source,
    },
    std::io::Cursor,
};

pub mod error;
pub mod ext;
pub mod state;

const GAS_FOR_VERIFY_VAA: Gas = Gas(10_000_000_000_000);
const STALENESS_THRESHOLD: u64 = 60;

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
pub struct State {
    /// The set of `Source`s from which Pyth attestations are allowed to be relayed from.
    pub source: UnorderedSet<Source>,

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
}

/// The `Action` acts as an enum of possible `Action`'s this contract can receive via VAA.
#[derive(BorshDeserialize, BorshSerialize)]
pub enum Action {
    AddSource(Source),
    DelSource(Source),
    BatchAttest(Vec<u8>),
    UpgradeContract([u8; 32]),
}

#[near_bindgen]
impl State {
    #[init]
    #[allow(clippy::new_without_default)]
    pub fn new(wormhole: AccountId, codehash: [u8; 32]) -> Self {
        Self {
            source: UnorderedSet::new(StorageKeys::Source),
            prices: UnorderedMap::new(StorageKeys::Prices),
            wormhole,
            codehash,
        }
    }

    /// Add a new (chain, contract) pair to the list of trusted sources for Price Attestations.
    #[private]
    pub fn add_source(&mut self, source: Source) {
        self.source.insert(&source);
    }

    /// Remove a (chain, contract) pair from the list of trusted sources for Price Attestations.
    ///
    /// NOTE: The caller of this function will be refunded the gas cost of the recovered storage
    /// but the caller may not be the same as the original caller of `add_source`. This means the
    /// refund goes to the wrong party. This is OK as the cost is low and the calls are rare and
    /// the bookkeeping to fix this is not worth it.
    #[private]
    pub fn del_source(&mut self, source: Source) {
        self.source.remove(&source);
    }

    pub fn get_sources(&self) -> Vec<Source> {
        self.source.iter().collect()
    }

    /// Process a Batch of Price Attestations.
    ///
    /// This receives price updates, verifies them, and stores the attestations in the contract
    /// state allowing other contracts to query them.
    #[private]
    pub fn attest_prices(&mut self, batch: &BatchPriceAttestation) -> usize {
        let mut count_updates = 0;
        for price_attestation in &batch.price_attestations {
            // Verify the PriceAttestation should be accepted, and if so, store it.
            if update_price_feed_if_new(&mut self.prices, PriceFeed::from(price_attestation)) {
                count_updates += 1;
            }
        }
        count_updates
    }

    /// Read the current Price for a given Price Feed, if the price is past the staleness threshold
    /// the trading status is set to Unknown before returning.
    pub fn get_price(&self, price_id: Identifier) -> Option<PriceFeed> {
        self.prices.get(&price_id).and_then(|mut price| {
            let block_timestamp = env::block_timestamp();
            let price_timestamp = price.publish_time.try_into().ok()?;

            // - If Price older than STALENESS_THRESHOLD, set status to Unknown.
            // - If Price newer than now by more than STALENESS_THRESHOLD, set status to Unknown.
            // - Any other price around the current time is considered valid.
            if u64::abs_diff(block_timestamp, price_timestamp) > STALENESS_THRESHOLD {
                price.status = PriceStatus::Unknown;
            }

            Some(price)
        })
    }

    /// Instruction for processing VAA's relayed via Wormhole.
    ///
    /// Note that VAA verification requires calling Wormhole so processing of the VAA itself is
    /// done in a callback handler, see `process_vaa_callback`.
    #[payable]
    #[handle_result]
    pub fn process_vaa(&mut self, vaa: String) -> Result<(), Error> {
        // Verify the VAA is coming from a trusted source chain.
        {
            let vaa = hex::decode(&vaa).map_err(|_| Error::InvalidHex)?;
            let vaa = vaa_payload::from_slice_with_payload::<structs::Vaa<()>>(&vaa)
                .map_err(|_| Error::InvalidVaa)?;

            if !self.source.contains(&Source {
                emitter:            vaa.0.emitter_address.0,
                pyth_emitter_chain: vaa.0.emitter_chain as u16,
            }) {
                return Err(Error::UnknownSource);
            }
        }

        // Verify VAA and refund the caller in case of failure.
        ext::ext_worm_hole::ext(env::current_account_id())
            .with_static_gas(Gas(30_000_000_000_000))
            .verify_vaa(vaa.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .with_attached_deposit(env::attached_deposit())
                    .process_vaa_callback(env::predecessor_account_id(), vaa),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
            );

        Ok(())
    }

    /// If submitting the VAA fails then this callback will refund the caller.
    pub fn refund_vaa(&mut self, account_id: AccountId, amount: u128) {
        if !is_promise_success() {
            Promise::new(account_id).transfer(amount);
        }
    }

    #[private]
    pub fn set_upgrade_hash(&mut self, codehash: [u8; 32]) {
        self.codehash = codehash;
    }

    /// Upon succesful verification of a VAA, this callback processes the VAA itself and branches
    /// to the appropriate handler.
    #[private]
    pub fn process_vaa_callback(
        &mut self,
        account_id: AccountId,
        vaa: String,
        #[callback_result] _result: Result<u32, near_sdk::PromiseError>,
    ) {
        // Get Storage Usage before executed.
        let storage_usage = env::storage_usage();

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(&vaa).unwrap();
        let (_, rest): (structs::Vaa<()>, _) = vaa_payload::from_slice_with_payload(&vaa).unwrap();

        match Action::try_from_slice(rest).unwrap() {
            Action::AddSource(source) => self.add_source(source),
            Action::DelSource(source) => self.del_source(source),
            Action::UpgradeContract(codehash) => self.set_upgrade_hash(codehash),
            Action::BatchAttest(batch) => {
                let bytes = &mut Cursor::new(batch);
                let batch = BatchPriceAttestation::deserialize(bytes).unwrap();
                let count = self.attest_prices(&batch);
                log!("Updated {} Price Feeds", count);
            }
        }

        // Refund Storage Difference to `account_id` after storage execution.
        let storage_diff = env::storage_usage() - storage_usage;
        Promise::new(account_id).transfer(storage_diff as u128 * env::storage_byte_cost());
    }

    /// This method allows self-upgrading the contract to a new implementation. This function is
    /// open to call by anyone, but to perform an authorized upgrade a VAA containing the hash of
    /// the `new_code` must have previously been relayed to this contract's `process_vaa` endpoint.
    /// otherwise the upgrade will fail.
    ///
    /// NOTE: This function is not pub so that it can only be called by the `upgrade_contract`
    /// method, this is much much cheaper than serializing a Vec<u8> to call this method as a
    /// normal public method.
    #[handle_result]
    fn upgrade(&mut self, new_code: Vec<u8>) -> Result<Promise, Error> {
        let signature = env::sha256(&new_code);

        if signature != self.codehash {
            return Err(Error::UnauthorizedUpgrade);
        }

        Ok(Promise::new(env::current_account_id())
            .deploy_contract(new_code)
            .then(Self::ext(env::current_account_id()).refund_upgrade(
                env::predecessor_account_id(),
                env::attached_deposit(),
                env::storage_usage(),
            )))
    }

    /// This method is called after the upgrade to refund the caller for the storage used by the
    /// old contract.
    pub fn refund_upgrade(&mut self, account_id: AccountId, amount: u128, storage: u64) {
        let refund = env::storage_byte_cost() * (env::storage_usage() - storage) as u128;
        let refund = amount - refund;
        if refund > 0 {
            Promise::new(account_id).transfer(refund);
        }
    }
}

/// Updates the Price Feed only if it is newer than the current one. This function never fails and
/// will either update in-place or not update at all. The return value indicates whether the update
/// was performed or not.
fn update_price_feed_if_new(
    prices: &mut UnorderedMap<Identifier, PriceFeed>,
    price_feed: PriceFeed,
) -> bool {
    match prices.get(&price_feed.id) {
        Some(stored_price_feed) => {
            let update = price_feed.publish_time > stored_price_feed.publish_time;
            update.then(|| prices.insert(&price_feed.id, &price_feed));
            update
        }

        None => {
            prices.insert(&price_feed.id, &price_feed);
            true
        }
    }
}

#[no_mangle]
pub extern "C" fn update_contract() {
    env::setup_panic_hook();
    let mut contract: State = env::state_read().expect("Failed to Read State");
    contract.upgrade(env::input().unwrap());
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
        let contract = State::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        assert_eq!(contract.source.len(), 0);
        assert_eq!(contract.prices.len(), 0);
    }

    #[test]
    fn test_contract_add_source() {
        let mut contract = State::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        assert_eq!(contract.source.len(), 1);
    }

    #[test]
    fn test_contract_add_duplicate_source() {
        let mut contract = State::new("wormhole.near".parse().unwrap(), [0; 32]);
        let context = get_context(ReadWrite);
        testing_env!(context);

        // Add One Source.
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Add the same Source again.
        assert_eq!(contract.source.len(), 1);
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Should only be one.
        assert_eq!(contract.source.len(), 1);
    }

    #[test]
    fn test_contract_add_and_remove_source() {
        let context = get_context(ReadWrite);
        let mut contract = State::new("wormhole.near".parse().unwrap(), [0; 32]);
        testing_env!(context);

        // Add One Source.
        contract.add_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Remove the Source.
        assert_eq!(contract.source.len(), 1);
        contract.del_source(Source {
            emitter:            [0; 32],
            pyth_emitter_chain: 1,
        });

        // Should be empty.
        assert_eq!(contract.source.len(), 0);
    }

    #[test]
    fn test_contract_submit_prices() {
        let context = get_context(ReadWrite);
        let mut contract = State::new("wormhole.near".parse().unwrap(), [0; 32]);
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
