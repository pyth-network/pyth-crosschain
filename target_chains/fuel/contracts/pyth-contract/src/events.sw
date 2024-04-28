library;

use pyth_interface::data_structures::{
    data_source::DataSource,
    price::PriceFeedId,
    wormhole_light::WormholeProvider,
};

pub struct ConstructedEvent {
    guardian_set_index: u32,
}

pub struct NewGuardianSetEvent {
    governance_action_hash: b256,
    // new_guardian_set: GuardianSet, // TODO: Uncomment when SDK supports logs with nested Vecs https://github.com/FuelLabs/fuels-rs/issues/1046
    new_guardian_set_index: u32,
}

pub struct UpdatedPriceFeedsEvent {
    updated_price_feeds: Vec<PriceFeedId>,
}

pub struct ContractUpgradedEvent {
    old_implementation: Identity,
    new_implementation: Identity,
}

pub struct GovernanceDataSourceSetEvent {
    old_data_source: DataSource,
    new_data_source: DataSource,
    initial_sequence: u64,
}

pub struct DataSourcesSetEvent {
    old_data_sources: Vec<DataSource>,
    new_data_sources: Vec<DataSource>,
}

pub struct FeeSetEvent {
    old_fee: u64,
    new_fee: u64,
}

pub struct ValidPeriodSetEvent {
    old_valid_period: u64,
    new_valid_period: u64,
}

pub struct WormholeAddressSetEvent {
    old_wormhole_address: b256,
    new_wormhole_address: b256,
}
