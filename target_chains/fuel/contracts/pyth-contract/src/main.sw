contract;

mod errors;
mod utils;
mod pyth_merkle_proof;
mod data_structures;
mod events;

use std::{
    block::timestamp,
    bytes::Bytes,
    call_frames::msg_asset_id,
    constants::{
        BASE_ASSET_ID,
        ZERO_B256,
    },
    context::msg_amount,
    hash::Hash,
    storage::{
        storage_map::StorageMap,
        storage_vec::*,
    },
    u256::U256,
};

use ::errors::{PythError, WormholeError};
use ::utils::{difference, total_fee};
use ::data_structures::{
    batch_attestation_update::parse_and_verify_batch_attestation_header,
    data_source::*,
    price::*,
    update_type::UpdateType,
    wormhole_light::*,
};
use ::events::{ConstructedEvent, NewGuardianSetEvent, UpdatedPriceFeedsEvent};

use pyth_interface::{
    data_structures::{
        data_source::DataSource,
        price::{
            Price,
            PriceFeed,
            PriceFeedId,
        },
        wormhole_light::{
            GuardianSet,
            WormholeProvider,
        },
    },
    PythCore,
    PythInfo,
    PythInit,
    WormholeGuardians,
};

use ownership::*;
use src5::{SRC5, State};

configurable {
    DEPLOYER: Identity = Identity::Address(Address::from(ZERO_B256)),
}

storage {
    //   |                |
    // --+-- PYTH STATE --+--
    //   |                |
    // (chainId, emitterAddress) => isValid; takes advantage of
    // constant-time mapping lookup for VM verification
    is_valid_data_source: StorageMap<DataSource, bool> = StorageMap {},
    // Mapping of cached price information
    // priceId => PriceInfo
    latest_price_feed: StorageMap<PriceFeedId, PriceFeed> = StorageMap {},
    single_update_fee: u64 = 0,
    // For tracking all active emitter/chain ID pairs
    valid_data_sources: StorageVec<DataSource> = StorageVec {},
    /// Maximum acceptable time period before price is considered to be stale.
    /// This includes attestation delay, block time, and potential clock drift
    /// between the source/target chains.
    valid_time_period_seconds: u64 = 0,
    //   |                    |
    // --+-- WORMHOLE STATE --+--
    //   |                    |
    // Mapping of consumed governance actions
    wormhole_consumed_governance_actions: StorageMap<b256, bool> = StorageMap {},
    // Mapping of guardian_set_index => guardian set
    wormhole_guardian_sets: StorageMap<u32, StorageGuardianSet> = StorageMap {},
    // Current active guardian set index
    wormhole_guardian_set_index: u32 = 0,
    // Using Ethereum's Wormhole governance
    wormhole_provider: WormholeProvider = WormholeProvider {
        governance_chain_id: 0u16,
        governance_contract: ZERO_B256,
    },
}

impl SRC5 for Contract {
    #[storage(read)]
    fn owner() -> State {
        _owner()
    }
}

impl PythCore for Contract {
    #[storage(read)]
    fn ema_price(price_feed_id: PriceFeedId) -> Price {
        ema_price_no_older_than(valid_time_period(), price_feed_id)
    }

    #[storage(read)]
    fn ema_price_no_older_than(time_period: u64, price_feed_id: PriceFeedId) -> Price {
        ema_price_no_older_than(time_period, price_feed_id)
    }

    #[storage(read)]
    fn ema_price_unsafe(price_feed_id: PriceFeedId) -> Price {
        ema_price_unsafe(price_feed_id)
    }

    #[storage(read), payable]
    fn parse_price_feed_updates(
        max_publish_time: u64,
        min_publish_time: u64,
        target_price_feed_ids: Vec<PriceFeedId>,
        update_data: Vec<Bytes>,
    ) -> Vec<PriceFeed> {
        require(
            msg_asset_id() == BASE_ASSET_ID,
            PythError::FeesCanOnlyBePaidInTheBaseAsset,
        );

        let required_fee = update_fee(update_data);
        require(msg_amount() >= required_fee, PythError::InsufficientFee);

        let mut output_price_feeds: Vec<PriceFeed> = Vec::with_capacity(target_price_feed_ids.len);
        let mut i = 0;
        while i < update_data.len {
            let data = update_data.get(i).unwrap();

            match UpdateType::determine_type(data) {
                UpdateType::Accumulator(accumulator_update) => {
                    let (mut offset, digest, number_of_updates, encoded) = accumulator_update.verify_and_parse(
                        current_guardian_set_index(),
                        storage
                            .wormhole_guardian_sets,
                        storage
                            .is_valid_data_source,
                    );
                    let mut i_2 = 0;
                    while i_2 < number_of_updates {
                        let (new_offset, price_feed) = PriceFeed::extract_from_merkle_proof(digest, encoded, offset);

                        offset = new_offset;

                        if price_feed.id.is_target(target_price_feed_ids) == false {
                            i_2 += 1;
                            continue;
                        }

                        if price_feed.price.publish_time >= min_publish_time && price_feed.price.publish_time <= max_publish_time {
                            // check if output_price_feeds already contains a PriceFeed with price_feed.id, if so continue as we only want 1
                            // output PriceFeed per target ID
                            if price_feed.id.is_contained_within(output_price_feeds) {
                                i_2 += 1;
                                continue;
                            }

                            output_price_feeds.push(price_feed)
                        }

                        i_2 += 1;
                    }
                    require(offset == encoded.len, PythError::InvalidUpdateDataLength);
                },
                UpdateType::BatchAttestation(batch_attestation_update) => {
                    let vm = WormholeVM::parse_and_verify_pyth_vm(
                        current_guardian_set_index(),
                        batch_attestation_update
                            .data,
                        storage
                            .wormhole_guardian_sets,
                        storage
                            .is_valid_data_source,
                    );

                    let (mut attestation_index, number_of_attestations, attestation_size) = parse_and_verify_batch_attestation_header(vm.payload);
                    let attestation_size_u16 = attestation_size.as_u64();

                    let mut i_2: u16 = 0;
                    while i_2 < number_of_attestations {
                        let (_, slice) = vm.payload.split_at(attestation_index + 32);
                        let (price_feed_id, _) = slice.split_at(32);
                        let price_feed_id: PriceFeedId = price_feed_id.into();

                        if price_feed_id.is_target(target_price_feed_ids) == false {
                            attestation_index += attestation_size_u16;
                            i_2 += 1;
                            continue;
                        }

                        let price_feed = PriceFeed::parse_attestation(attestation_size, vm.payload, attestation_index);

                        if price_feed.price.publish_time >= min_publish_time && price_feed.price.publish_time <= max_publish_time {
                            // check if output_price_feeds already contains a PriceFeed with price_feed.id, if so continue;
                            // as we only want 1 output PriceFeed per target ID
                            if price_feed.id.is_contained_within(output_price_feeds) {
                                attestation_index += attestation_size_u16;
                                i_2 += 1;
                                continue;
                            }

                            output_price_feeds.push(price_feed)
                        }

                        attestation_index += attestation_size_u16;
                        i_2 += 1;
                    }
                }
            }

            i += 1;
        }

        require(
            target_price_feed_ids
                .len == output_price_feeds
                .len,
            PythError::PriceFeedNotFoundWithinRange,
        );

        output_price_feeds
    }

    #[storage(read)]
    fn price(price_feed_id: PriceFeedId) -> Price {
        price_no_older_than(valid_time_period(), price_feed_id)
    }

    #[storage(read)]
    fn price_no_older_than(time_period: u64, price_feed_id: PriceFeedId) -> Price {
        price_no_older_than(time_period, price_feed_id)
    }

    #[storage(read)]
    fn price_unsafe(price_feed_id: PriceFeedId) -> Price {
        price_unsafe(price_feed_id)
    }

    #[storage(read)]
    fn update_fee(update_data: Vec<Bytes>) -> u64 {
        update_fee(update_data)
    }

    #[storage(read, write), payable]
    fn update_price_feeds(update_data: Vec<Bytes>) {
        update_price_feeds(update_data)
    }

    #[storage(read, write), payable]
    fn update_price_feeds_if_necessary(
        price_feed_ids: Vec<PriceFeedId>,
        publish_times: Vec<u64>,
        update_data: Vec<Bytes>,
    ) {
        require(
            price_feed_ids
                .len == publish_times
                .len,
            PythError::LengthOfPriceFeedIdsAndPublishTimesMustMatch,
        );

        let mut i = 0;
        while i < price_feed_ids.len {
            if latest_publish_time(price_feed_ids.get(i).unwrap()) < publish_times.get(i).unwrap()
            {
                update_price_feeds(update_data);
                return;
            }

            i += 1;
        }
    }

    #[storage(read)]
    fn valid_time_period() -> u64 {
        valid_time_period()
    }
}

/// PythCore Private Functions ///
#[storage(read)]
fn ema_price_no_older_than(time_period: u64, price_feed_id: PriceFeedId) -> Price {
    let price = ema_price_unsafe(price_feed_id);

    require(
        difference(timestamp(), price.publish_time) <= time_period,
        PythError::OutdatedPrice,
    );

    price
}

#[storage(read)]
fn ema_price_unsafe(price_feed_id: PriceFeedId) -> Price {
    let price_feed = storage.latest_price_feed.get(price_feed_id).try_read();
    require(price_feed.is_some(), PythError::PriceFeedNotFound);

    price_feed.unwrap().ema_price
}

#[storage(read)]
fn price_no_older_than(time_period: u64, price_feed_id: PriceFeedId) -> Price {
    let price = price_unsafe(price_feed_id);
    require(
        difference(timestamp(), price.publish_time) <= time_period,
        PythError::OutdatedPrice,
    );

    price
}

#[storage(read)]
fn price_unsafe(price_feed_id: PriceFeedId) -> Price {
    let price_feed = storage.latest_price_feed.get(price_feed_id).try_read();
    require(price_feed.is_some(), PythError::PriceFeedNotFound);

    price_feed.unwrap().price
}

#[storage(read)]
fn update_fee(update_data: Vec<Bytes>) -> u64 {
    let mut total_number_of_updates = 0;
    let mut i = 0;
    while i < update_data.len {
        let data = update_data.get(i).unwrap();

        match UpdateType::determine_type(data) {
            UpdateType::Accumulator(accumulator_update) => {
                let proof_size_offset = accumulator_update.verify();

                total_number_of_updates += accumulator_update.total_updates(proof_size_offset);
            },
            UpdateType::BatchAttestation => {
                total_number_of_updates += 1;
            },
        }

        i += 1;
    }

    total_fee(total_number_of_updates, storage.single_update_fee)
}

#[storage(read, write), payable]
fn update_price_feeds(update_data: Vec<Bytes>) {
    require(
        msg_asset_id() == BASE_ASSET_ID,
        PythError::FeesCanOnlyBePaidInTheBaseAsset,
    );

    let mut total_number_of_updates = 0;

    // let mut updated_price_feeds: Vec<PriceFeedId> = Vec::new(); // TODO: requires append for Vec
    let mut i = 0;
    while i < update_data.len {
        let data = update_data.get(i).unwrap();

        match UpdateType::determine_type(data) {
            UpdateType::Accumulator(accumulator_update) => {
                let (number_of_updates, _updated_ids) = accumulator_update.update_price_feeds(
                    current_guardian_set_index(),
                    storage
                        .wormhole_guardian_sets,
                    storage
                        .latest_price_feed,
                    storage
                        .is_valid_data_source,
                );
                // updated_price_feeds.append(updated_ids); // TODO: requires append for Vec
                total_number_of_updates += number_of_updates;
            },
            UpdateType::BatchAttestation(batch_attestation_update) => {
                let _updated_ids = batch_attestation_update.update_price_feeds(
                    current_guardian_set_index(),
                    storage
                        .wormhole_guardian_sets,
                    storage
                        .latest_price_feed,
                    storage
                        .is_valid_data_source,
                );
                // updated_price_feeds.append(updated_ids); // TODO: requires append for Vec
                total_number_of_updates += 1;
            },
        }

        i += 1;
    }

    let required_fee = total_fee(total_number_of_updates, storage.single_update_fee);
    require(msg_amount() >= required_fee, PythError::InsufficientFee);

    // log(UpdatedPriceFeedsEvent { // TODO: requires append for Vec
    //     updated_price_feeds,
    // })
}

#[storage(read)]
fn valid_time_period() -> u64 {
    storage.valid_time_period_seconds.read()
}

impl PythInit for Contract {
    #[storage(read, write)]
    fn constructor(
        data_sources: Vec<DataSource>,
        single_update_fee: u64,
        valid_time_period_seconds: u64,
        wormhole_guardian_set_upgrade: Bytes,
    ) {
        initialize_ownership(DEPLOYER);
        only_owner();

        require(data_sources.len > 0, PythError::InvalidDataSourcesLength);

        let mut i = 0;
        while i < data_sources.len {
            let data_source = data_sources.get(i).unwrap();
            storage.is_valid_data_source.insert(data_source, true);
            storage.valid_data_sources.push(data_source);

            i += 1;
        }

        storage
            .valid_time_period_seconds
            .write(valid_time_period_seconds);
        storage.single_update_fee.write(single_update_fee);

        let vm = WormholeVM::parse_initial_wormhole_vm(wormhole_guardian_set_upgrade);
        let upgrade = GuardianSetUpgrade::parse_encoded_upgrade(0, vm.payload);

        storage
            .wormhole_consumed_governance_actions
            .insert(vm.governance_action_hash, true);
        storage
            .wormhole_guardian_sets
            .insert(upgrade.new_guardian_set_index, upgrade.new_guardian_set);
        storage
            .wormhole_guardian_set_index
            .write(upgrade.new_guardian_set_index);
        storage
            .wormhole_provider
            .write(WormholeProvider::new(vm.emitter_chain_id, vm.emitter_address));

        renounce_ownership();

        log(ConstructedEvent {
            guardian_set_index: upgrade.new_guardian_set_index,
        })
    }
}

impl PythInfo for Contract {
    #[storage(read)]
    fn valid_data_sources() -> Vec<DataSource> {
        storage.valid_data_sources.load_vec()
    }

    #[storage(read)]
    fn latest_publish_time(price_feed_id: PriceFeedId) -> u64 {
        latest_publish_time(price_feed_id)
    }

    #[storage(read)]
    fn price_feed_exists(price_feed_id: PriceFeedId) -> bool {
        match storage.latest_price_feed.get(price_feed_id).try_read() {
            Some(_) => true,
            None => false,
        }
    }

    #[storage(read)]
    fn price_feed_unsafe(price_feed_id: PriceFeedId) -> PriceFeed {
        let price_feed = storage.latest_price_feed.get(price_feed_id).try_read();
        require(price_feed.is_some(), PythError::PriceFeedNotFound);
        price_feed.unwrap()
    }

    #[storage(read)]
    fn single_update_fee() -> u64 {
        storage.single_update_fee.read()
    }

    #[storage(read)]
    fn valid_data_source(data_source: DataSource) -> bool {
        data_source.is_valid(storage.is_valid_data_source)
    }
}

/// PythInfo Private Functions ///
#[storage(read)]
fn latest_publish_time(price_feed_id: PriceFeedId) -> u64 {
    match storage.latest_price_feed.get(price_feed_id).try_read() {
        Some(price_feed) => price_feed.price.publish_time,
        None => 0,
    }
}

impl WormholeGuardians for Contract {
    #[storage(read)]
    fn current_guardian_set_index() -> u32 {
        current_guardian_set_index()
    }

    #[storage(read)]
    fn current_wormhole_provider() -> WormholeProvider {
        current_wormhole_provider()
    }

    #[storage(read)]
    fn guardian_set(index: u32) -> GuardianSet {
        let stored_guardian_set = storage.wormhole_guardian_sets.get(index).try_read();
        require(
            stored_guardian_set
                .is_some(),
            PythError::GuardianSetNotFound,
        );
        GuardianSet::from_stored(stored_guardian_set.unwrap())
    }

    #[storage(read)]
    fn governance_action_is_consumed(governance_action_hash: b256) -> bool {
        governance_action_is_consumed(governance_action_hash)
    }

    #[storage(read, write)]
    fn submit_new_guardian_set(encoded_vm: Bytes) {
        submit_new_guardian_set(encoded_vm)
    }
}

/// WormholeGuardians Private Functions ///
#[storage(read)]
fn current_guardian_set_index() -> u32 {
    storage.wormhole_guardian_set_index.read()
}

#[storage(read)]
fn current_wormhole_provider() -> WormholeProvider {
    storage.wormhole_provider.read()
}

#[storage(read)]
fn governance_action_is_consumed(governance_action_hash: b256) -> bool {
    match storage.wormhole_consumed_governance_actions.get(governance_action_hash).try_read() {
        Some(bool_) => bool_,
        None => false,
    }
}

#[storage(read, write)]
fn submit_new_guardian_set(encoded_vm: Bytes) {
    let vm = WormholeVM::parse_and_verify_wormhole_vm(
        current_guardian_set_index(),
        encoded_vm,
        storage
            .wormhole_guardian_sets,
    );
    require(
        vm.guardian_set_index == current_guardian_set_index(),
        WormholeError::NotSignedByCurrentGuardianSet,
    );
    let current_wormhole_provider = current_wormhole_provider();
    require(
        vm.emitter_chain_id == current_wormhole_provider
            .governance_chain_id,
        WormholeError::InvalidGovernanceChain,
    );
    require(
        vm.emitter_address == current_wormhole_provider
            .governance_contract,
        WormholeError::InvalidGovernanceContract,
    );
    require(
        governance_action_is_consumed(vm.governance_action_hash) == false,
        WormholeError::GovernanceActionAlreadyConsumed,
    );

    let current_guardian_set_index = current_guardian_set_index();
    let upgrade = GuardianSetUpgrade::parse_encoded_upgrade(current_guardian_set_index, vm.payload);

    storage
        .wormhole_consumed_governance_actions
        .insert(vm.governance_action_hash, true);

    // Set expiry if current GuardianSet exists
    let current_guardian_set = storage.wormhole_guardian_sets.get(current_guardian_set_index).try_read();
    if current_guardian_set.is_some() {
        let mut current_guardian_set = current_guardian_set.unwrap();
        current_guardian_set.expiration_time = timestamp() + 86400;
        storage
            .wormhole_guardian_sets
            .insert(current_guardian_set_index, current_guardian_set);
    }

    storage
        .wormhole_guardian_sets
        .insert(upgrade.new_guardian_set_index, upgrade.new_guardian_set);
    storage
        .wormhole_guardian_set_index
        .write(upgrade.new_guardian_set_index);

    log(NewGuardianSetEvent {
        governance_action_hash: vm.governance_action_hash,
        new_guardian_set_index: upgrade.new_guardian_set_index,
    })
}
