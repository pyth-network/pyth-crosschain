module pyth::state {
    use pyth::price_identifier::PriceIdentifier;
    use pyth::contract_upgrade_hash::Hash;
    use pyth::data_source::DataSource;
    use pyth::price_info::PriceInfo;
    use std::table::{Self, Table};
    use pyth::set::{Self, Set};
    use std::vector;
    use pyth::error;
    use std::account;

    friend pyth::pyth;
    friend pyth::governance;
    friend pyth::contract_upgrade;
    friend pyth::set_governance_data_source;
    friend pyth::set_update_fee;
    friend pyth::set_stale_price_threshold;
    friend pyth::set_data_sources;

    #[test_only]
    friend pyth::governance_test;

    /// The valid data sources an attestation VAA can be emitted from
    struct DataSources has key {
        sources: Set<DataSource>,
    }

    /// How long a cached price is considered valid for
    struct StalePriceThreshold has key {
        threshold_secs: u64,
    }

    /// The update fee charged per VAA
    struct BaseUpdateFee has key {
        fee: u64,
    }

    /// The Pyth contract signer capability
    struct SignerCapability has key {
        signer_capability: account::SignerCapability,
    }

    /// Mapping of cached price information
    ///
    /// WARNING: do not directly read out of this table, instead use
    /// the checked `pyth::get_price` method. This ensures that the price
    /// is recent enough.
    struct LatestPriceInfo has key {
        info: Table<PriceIdentifier, PriceInfo>,
    }

    /// The allowed data source for governance VAAs
    struct GovernanceDataSource has key {
        source: DataSource,
    }

    /// The last executed governance VAA sequence number
    struct LastExecutedGovernanceSequence has key {
        sequence: u64,
    }

    /// The hash of the code of the authorized contract upgrade
    struct ContractUpgradeAuthorized has key {
        hash: Hash,
    }

    // Initialization
    public(friend) fun init(
        pyth: &signer,
        stale_price_threshold: u64,
        update_fee: u64,
        governance_data_source: DataSource,
        data_sources: vector<DataSource>,
        signer_capability: account::SignerCapability) {
            move_to(pyth, StalePriceThreshold{
                threshold_secs: stale_price_threshold,
            });
            move_to(pyth, BaseUpdateFee{
                fee: update_fee,
            });
            let sources = set::new<DataSource>();
            while (!vector::is_empty(&data_sources)) {
                set::add(&mut sources, vector::pop_back(&mut data_sources));
            };
            move_to(pyth, DataSources{
                sources,
            });
            move_to(pyth, GovernanceDataSource{
                source: governance_data_source,
            });
            move_to(pyth, LastExecutedGovernanceSequence{
                sequence: 0,
            });
            move_to(pyth, SignerCapability{
                signer_capability: signer_capability,
            });
            move_to(pyth, LatestPriceInfo{
                info: table::new<PriceIdentifier, PriceInfo>(),
            });
    }

    // Accessors
    public fun get_stale_price_threshold_secs(): u64 acquires StalePriceThreshold {
        borrow_global<StalePriceThreshold>(@pyth).threshold_secs
    }

    public fun get_base_update_fee(): u64 acquires BaseUpdateFee {
        borrow_global<BaseUpdateFee>(@pyth).fee
    }

    public fun is_valid_data_source(data_source: DataSource): bool acquires DataSources {
        set::contains(&borrow_global<DataSources>(@pyth).sources, data_source)
    }

    public fun is_valid_governance_data_source(source: DataSource): bool acquires GovernanceDataSource {
        let governance_data_source = borrow_global<GovernanceDataSource>(@pyth);
        governance_data_source.source == source
    }

    public fun get_last_executed_governance_sequence(): u64 acquires LastExecutedGovernanceSequence {
        let last_executed_governance_sequence = borrow_global<LastExecutedGovernanceSequence>(@pyth);
        last_executed_governance_sequence.sequence
    }

    public fun price_info_cached(price_identifier: PriceIdentifier): bool acquires LatestPriceInfo {
        let latest_price_info = borrow_global<LatestPriceInfo>(@pyth);
        table::contains(&latest_price_info.info, price_identifier)
    }

    public fun get_latest_price_info(price_identifier: PriceIdentifier): PriceInfo acquires LatestPriceInfo {
        assert!(price_info_cached(price_identifier), error::unknown_price_feed());

        let latest_price_info = borrow_global<LatestPriceInfo>(@pyth);
        *table::borrow(&latest_price_info.info, price_identifier)
    }

    public fun get_contract_upgrade_authorized_hash(): Hash acquires ContractUpgradeAuthorized {
        assert!(exists<ContractUpgradeAuthorized>(@pyth), error::unauthorized_upgrade());
        let ContractUpgradeAuthorized { hash } = move_from<ContractUpgradeAuthorized>(@pyth);
        hash
    }

    // Setters
    public(friend) fun set_data_sources(new_sources: vector<DataSource>) acquires DataSources {
        let sources = &mut borrow_global_mut<DataSources>(@pyth).sources;
        set::empty(sources);
        while (!vector::is_empty(&new_sources)) {
            set::add(sources, vector::pop_back(&mut new_sources));
        }
    }

    public(friend) fun set_latest_price_info(price_identifier: PriceIdentifier, price_info: PriceInfo) acquires LatestPriceInfo {
        let latest_price_info = borrow_global_mut<LatestPriceInfo>(@pyth);
        table::upsert(&mut latest_price_info.info, price_identifier, price_info)
    }

    public(friend) fun set_last_executed_governance_sequence(sequence: u64) acquires LastExecutedGovernanceSequence {
        let last_executed_governance_sequence = borrow_global_mut<LastExecutedGovernanceSequence>(@pyth);
        last_executed_governance_sequence.sequence = sequence
    }

    public(friend) fun pyth_signer(): signer acquires SignerCapability {
        account::create_signer_with_capability(&borrow_global<SignerCapability>(@pyth).signer_capability)
    }

    public(friend) fun set_contract_upgrade_authorized_hash(hash: Hash) acquires ContractUpgradeAuthorized, SignerCapability {
        if (exists<ContractUpgradeAuthorized>(@pyth)) {
            let ContractUpgradeAuthorized { hash: _ } = move_from<ContractUpgradeAuthorized>(@pyth);
        };

        move_to(&pyth_signer(), ContractUpgradeAuthorized { hash });
    }

    public(friend) fun set_governance_data_source(source: DataSource) acquires GovernanceDataSource {
        let valid_governance_data_source = borrow_global_mut<GovernanceDataSource>(@pyth);
        valid_governance_data_source.source = source;
    }

    public(friend) fun set_base_update_fee(fee: u64) acquires BaseUpdateFee {
        let update_fee = borrow_global_mut<BaseUpdateFee>(@pyth);
        update_fee.fee = fee
    }

    public(friend) fun set_stale_price_threshold_secs(threshold_secs: u64) acquires StalePriceThreshold {
        let stale_price_threshold = borrow_global_mut<StalePriceThreshold>(@pyth);
        stale_price_threshold.threshold_secs = threshold_secs
    }
}
