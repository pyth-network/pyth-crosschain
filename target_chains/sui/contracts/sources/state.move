module pyth::state {
    use std::vector;
    use sui::object::{Self, UID};
    use sui::transfer::{Self};
    use sui::tx_context::{Self, TxContext};
    use sui::test_scenario::{Self};

    //use pyth::price_identifier::PriceIdentifier;
    use pyth::data_source::{Self, DataSource};
    //use pyth::price_info::PriceInfo;

    use wormhole::set::{Self, Set};
    use wormhole::external_address::{Self};

    friend pyth::pyth;

    struct State has key {
        id: UID,
        // TODO - Make data_sources a dynamic field of State,
        // inside of something embedded in State, because there will be
        // 10k+ data sources in the future, and we want to minimize the
        // size of State.
        data_sources: Set<DataSource>,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        stale_price_threshold: u64,
        base_update_fee: u64
    }

    // Initialization
    public(friend) fun init_and_share_state(
        stale_price_threshold: u64,
        base_update_fee: u64,
        governance_data_source: DataSource,
        sources: vector<DataSource>,
        ctx: &mut TxContext
    ) {
        // Convert the vector of DataSource objects into a set
        // of DataSource objects
        let data_sources = set::new<DataSource>(ctx);
        while (!vector::is_empty(&sources)) {
            set::add(&mut data_sources, vector::pop_back(&mut sources));
        };
            transfer::share_object(
                State {
                    id: object::new(ctx),
                    data_sources,
                    governance_data_source,
                    last_executed_governance_sequence: 0,
                    stale_price_threshold,
                    base_update_fee
                }
            );
    }

    // Accessors
    public fun get_stale_price_threshold_secs(s: &State): u64 {
        s.stale_price_threshold
    }

    public fun get_base_update_fee(s: &State): u64 {
        s.base_update_fee
    }

    public fun is_valid_data_source(s: &State, data_source: DataSource): bool {
        set::contains<DataSource>(&s.data_sources, data_source)
    }

    public fun is_valid_governance_data_source(s: &State, source: DataSource): bool {
        s.governance_data_source == source
    }

    public fun get_last_executed_governance_sequence(s: &State): u64 {
        s.last_executed_governance_sequence
    }

    // Setters
    public(friend) fun set_data_sources(s: &mut State, new_sources: vector<DataSource>, ctx: &mut TxContext) {
        //let sources = &mut s.data_sources;
        let new_set = set::new<DataSource>(ctx);
        //set::empty<DataSource>(sources);
        while (!vector::is_empty(&new_sources)) {
            set::add(&mut new_set, vector::pop_back(&mut new_sources));
        };
        s.data_sources = new_set;
    }

    // public(friend) fun set_latest_price_info(price_identifier: PriceIdentifier, price_info: PriceInfo) acquires LatestPriceInfo {
    //     let latest_price_info = borrow_global_mut<LatestPriceInfo>(@pyth);
    //     table::upsert(&mut latest_price_info.info, price_identifier, price_info)
    // }

    // public(friend) fun set_last_executed_governance_sequence(sequence: u64) acquires LastExecutedGovernanceSequence {
    //     let last_executed_governance_sequence = borrow_global_mut<LastExecutedGovernanceSequence>(@pyth);
    //     last_executed_governance_sequence.sequence = sequence
    // }

    // public(friend) fun pyth_signer(): signer acquires SignerCapability {
    //     account::create_signer_with_capability(&borrow_global<SignerCapability>(@pyth).signer_capability)
    // }

    // public(friend) fun set_contract_upgrade_authorized_hash(hash: Hash) acquires ContractUpgradeAuthorized, SignerCapability {
    //     if (exists<ContractUpgradeAuthorized>(@pyth)) {
    //         let ContractUpgradeAuthorized { hash: _ } = move_from<ContractUpgradeAuthorized>(@pyth);
    //     };

    //     move_to(&pyth_signer(), ContractUpgradeAuthorized { hash });
    // }

    // public(friend) fun set_governance_data_source(source: DataSource) acquires GovernanceDataSource {
    //     let valid_governance_data_source = borrow_global_mut<GovernanceDataSource>(@pyth);
    //     valid_governance_data_source.source = source;
    // }

    // public(friend) fun set_base_update_fee(fee: u64) acquires BaseUpdateFee {
    //     let update_fee = borrow_global_mut<BaseUpdateFee>(@pyth);
    //     update_fee.fee = fee
    // }

    // public(friend) fun set_stale_price_threshold_secs(threshold_secs: u64) acquires StalePriceThreshold {
    //     let stale_price_threshold = borrow_global_mut<StalePriceThreshold>(@pyth);
    //     stale_price_threshold.threshold_secs = threshold_secs
    // }
}