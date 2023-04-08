module pyth::pyth {
    use std::vector;
    use sui::tx_context::{TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::{SUI};
    use sui::transfer::{Self};
    use sui::clock::{Self, Clock};
    use sui::package::{UpgradeCap};

    use pyth::event::{Self as pyth_event};
    use pyth::data_source::{Self, DataSource};
    use pyth::state::{Self as state, State as PythState, DeployerCap};
    use pyth::price_info::{Self, PriceInfo, PriceInfoObject};
    use pyth::batch_price_attestation::{Self};
    use pyth::price_feed::{Self};
    use pyth::price::{Self, Price};
    use pyth::price_identifier::{PriceIdentifier};

    use wormhole::external_address::{Self};
    use wormhole::vaa::{Self};
    use wormhole::state::{State as WormState};
    use wormhole::bytes32::{Self};

    const E_DATA_SOURCE_EMITTER_ADDRESS_AND_CHAIN_IDS_DIFFERENT_LENGTHS: u64 = 0;
    const E_INVALID_DATA_SOURCE: u64 = 1;
    const E_INSUFFICIENT_FEE: u64 = 2;
    const E_STALE_PRICE_UPDATE: u64 = 3;

    /// Call init_and_share_state with deployer cap to initialize
    /// state and emit event corresponding to Pyth initialization.
    public entry fun init_pyth(
        deployer: DeployerCap,
        upgrade_cap: UpgradeCap,
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources_emitter_chain_ids: vector<u64>,
        data_sources_emitter_addresses: vector<vector<u8>>,
        update_fee: u64,
        ctx: &mut TxContext
    ) {
        state::init_and_share_state(
            deployer,
            upgrade_cap,
            stale_price_threshold,
            update_fee,
            data_source::new(
                governance_emitter_chain_id,
                external_address::new((bytes32::from_bytes(governance_emitter_address)))
            ),
            parse_data_sources(
                data_sources_emitter_chain_ids,
                data_sources_emitter_addresses,
            ),
            ctx
        );

        // Emit Pyth initialization event.
        pyth_event::emit_pyth_initialization_event();
    }

    fun parse_data_sources(
        emitter_chain_ids: vector<u64>,
        emitter_addresses: vector<vector<u8>>
    ): vector<DataSource> {

        assert!(vector::length(&emitter_chain_ids) == vector::length(&emitter_addresses),
            E_DATA_SOURCE_EMITTER_ADDRESS_AND_CHAIN_IDS_DIFFERENT_LENGTHS);

        let sources = vector::empty();
        let i = 0;
        while (i < vector::length(&emitter_chain_ids)) {
            vector::push_back(&mut sources, data_source::new(
                *vector::borrow(&emitter_chain_ids, i),
                external_address::new(bytes32::from_bytes(*vector::borrow(&emitter_addresses, i)))
            ));

            i = i + 1;
        };
        sources
    }

    /// Create and share new price feed objects if they don't already exist.
    public fun create_price_feeds(
        worm_state: &WormState,
        pyth_state: &mut PythState,
        vaas: vector<vector<u8>>,
        clock: &Clock,
        ctx: &mut TxContext
    ){
        while (!vector::is_empty(&vaas)) {
            let vaa = vector::pop_back(&mut vaas);

            // Deserialize the VAA
            let vaa = vaa::parse_and_verify(worm_state, vaa, clock);

            // Check that the VAA is from a valid data source (emitter)
            assert!(
                state::is_valid_data_source(
                    pyth_state,
                    data_source::new(
                        (vaa::emitter_chain(&vaa) as u64),
                        vaa::emitter_address(&vaa))
                    ),
            E_INVALID_DATA_SOURCE);

            // Deserialize the batch price attestation
            let price_infos = batch_price_attestation::destroy(batch_price_attestation::deserialize(vaa::take_payload(vaa), clock));
            while (!vector::is_empty(&price_infos)){
                let cur_price_info = vector::pop_back(&mut price_infos);

                // Only create new Sui PriceInfoObject if not already
                // registered with the Pyth State object.
                if (!state::price_feed_object_exists(
                        pyth_state,
                            price_feed::get_price_identifier(
                                price_info::get_price_feed(&cur_price_info)
                            )
                        )
                ){
                    // Create and share newly created Sui PriceInfoObject containing a price feed,
                    // and then register a copy of its ID with State.
                    let new_price_info_object = price_info::new_price_info_object(cur_price_info, ctx);
                    let price_identifier = price_info::get_price_identifier(&cur_price_info);
                    let id = price_info::uid_to_inner(&new_price_info_object);

                    state::register_price_info_object(pyth_state, price_identifier, id);

                    transfer::public_share_object(new_price_info_object);
                }
            }
        };
    }

    /// Update PriceInfo objects and corresponding price feeds with the
    /// data in the given VAAs.
    ///
    /// The vaas argument is a vector of VAAs encoded as bytes.
    ///
    /// The javascript https://github.com/pyth-network/pyth-js/tree/main/pyth-aptos-js package
    /// should be used to fetch these VAAs from the Price Service. More information about this
    /// process can be found at https://docs.pyth.network/consume-data.
    ///
    /// The given fee must contain a sufficient number of coins to pay the update fee for the given vaas.
    /// The update fee amount can be queried by calling get_update_fee(&vaas).
    ///
    /// Please read more information about the update fee here: https://docs.pyth.network/consume-data/on-demand#fees
    public fun update_price_feeds(
        worm_state: &WormState,
        pyth_state: &PythState,
        vaas: vector<vector<u8>>,
        price_info_objects: &mut vector<PriceInfoObject>,
        fee: Coin<SUI>,
        clock: &Clock
    ){
        // Charge the message update fee
        assert!(get_total_update_fee(pyth_state, &vaas) <= coin::value(&fee), E_INSUFFICIENT_FEE);

        // TODO: use Wormhole fee collector instead of transferring funds to deployer address.
        transfer::public_transfer(fee, @pyth);

        // Update the price feed from each VAA
        while (!vector::is_empty(&vaas)) {
            update_price_feed_from_single_vaa(
                worm_state,
                pyth_state,
                vector::pop_back(&mut vaas),
                price_info_objects,
                clock
            );
        };
    }

    /// Precondition: A Sui object of type PriceInfoObject must exist for each update
    /// encoded in the worm_vaa (batch_attestation_vaa). These should be passed in
    /// via the price_info_objects argument.
    fun update_price_feed_from_single_vaa(
        worm_state: &WormState,
        pyth_state: &PythState,
        worm_vaa: vector<u8>,
        price_info_objects: &mut vector<PriceInfoObject>,
        clock: &Clock
    ) {
        // Deserialize the VAA
        let vaa = vaa::parse_and_verify(worm_state, worm_vaa, clock);

        // Check that the VAA is from a valid data source (emitter)
        assert!(
            state::is_valid_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&vaa) as u64),
                    vaa::emitter_address(&vaa))
                ),
        E_INVALID_DATA_SOURCE);

        // Deserialize the batch price attestation
        let price_infos = batch_price_attestation::destroy(batch_price_attestation::deserialize(vaa::take_payload(vaa), clock));

        // Update price info objects.
        update_cache(price_infos, price_info_objects, clock);
    }

    /// Update PriceInfoObjects using up-to-date PriceInfos.
    fun update_cache(
        updates: vector<PriceInfo>,
        price_info_objects: &mut vector<PriceInfoObject>,
        clock: &Clock,
    ){
        while (!vector::is_empty(&updates)) {
            let update = vector::pop_back(&mut updates);
            let i = 0;
            let found = false;
            // Find PriceInfoObjects corresponding to the current update (PriceInfo).
            // TODO - This for loop might be expensive if there are a large
            //        number of updates and/or price_info_objects we are updating.
            while (i < vector::length<PriceInfoObject>(price_info_objects)){
                // Check if the current price info object corresponds to the price feed that
                // the update is meant for.
                let price_info = price_info::get_price_info_from_price_info_object(vector::borrow(price_info_objects, i));
                if (price_info::get_price_identifier(&price_info) ==
                    price_info::get_price_identifier(&update)){
                    found = true;
                    pyth_event::emit_price_feed_update(price_feed::from(price_info::get_price_feed(&update)), clock::timestamp_ms(clock)/1000);

                    // Update the price info object with the new updated price info.
                    if (is_fresh_update(&update, vector::borrow(price_info_objects, i))){
                        price_info::update_price_info_object(
                            vector::borrow_mut(price_info_objects, i),
                            update
                        );
                    }
                }
            };
            if (!found){
                // TODO - throw error, since the price_feeds in price_info_objects do
                //        not constitute a superset of the price_feeds to be updated
            }
        };
        vector::destroy_empty(updates);
    }

    /// Determine if the given price update is "fresh": we have nothing newer already cached for that
    /// price feed within a PriceInfoObject.
    fun is_fresh_update(update: &PriceInfo, price_info_object: &PriceInfoObject): bool {
        // Get the timestamp of the update's current price
        let price_feed = price_info::get_price_feed(update);
        let update_timestamp = price::get_timestamp(&price_feed::get_price(price_feed));

        // Get the timestamp of the cached data for the price identifier
        let cached_price_info = price_info::get_price_info_from_price_info_object(price_info_object);
        let cached_price_feed =  price_info::get_price_feed(&cached_price_info);
        let cached_timestamp = price::get_timestamp(&price_feed::get_price(cached_price_feed));

        update_timestamp > cached_timestamp
    }

    // -----------------------------------------------------------------------------
    // Query the cached prices
    //
    // It is strongly recommended to update the cached prices using the functions above,
    // before using the functions below to query the cached data.

    /// Get the number of AptosCoin's required to perform the given price updates.
    ///

    /// Determine if a price feed for the given price_identifier exists
    public fun price_feed_exists(state: &PythState, price_identifier: PriceIdentifier): bool {
        state::price_feed_object_exists(state, price_identifier)
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the stale price threshold.
    ///
    /// Please refer to the documentation at https://docs.pyth.network/consumers/best-practices for
    /// how to how this price safely.
    ///
    /// Important: Pyth uses an on-demand update model, where consumers need to update the
    /// cached prices before using them. Please read more about this at https://docs.pyth.network/consume-data/on-demand.
    /// get_price() is likely to abort unless you call update_price_feeds() to update the cached price
    /// beforehand, as the cached prices may be older than the stale price threshold.
    ///
    /// The price_info_object is a Sui object with the key ability that uniquely
    /// contains a price feed for a given price_identifier.
    ///
    public fun get_price(state: &PythState, price_info_object: &PriceInfoObject, clock: &Clock): Price {
        get_price_no_older_than(price_info_object, clock, state::get_stale_price_threshold_secs(state))
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the given age.
    public fun get_price_no_older_than(price_info_object: &PriceInfoObject, clock: &Clock, max_age_secs: u64): Price {
        let price = get_price_unsafe(price_info_object);
        check_price_is_fresh(&price, clock, max_age_secs);
        price
    }

    /// Get the latest available price cached for the given price identifier.
    ///
    /// WARNING: the returned price can be from arbitrarily far in the past.
    /// This function makes no guarantees that the returned price is recent or
    /// useful for any particular application. Users of this function should check
    /// the returned timestamp to ensure that the returned price is sufficiently
    /// recent for their application. The checked get_price_no_older_than()
    /// function should be used in preference to this.
    public fun get_price_unsafe(price_info_object: &PriceInfoObject): Price {
        // TODO: extract Price from this guy...
        let price_info = price_info::get_price_info_from_price_info_object(price_info_object);
        price_feed::get_price(
            price_info::get_price_feed(&price_info)
        )
    }

    fun abs_diff(x: u64, y: u64): u64 {
        if (x > y) {
            return x - y
        } else {
            return y - x
        }
    }

    /// Get the stale price threshold: the amount of time after which a cached price
    /// is considered stale and no longer returned by get_price()/get_ema_price().
    public fun get_stale_price_threshold_secs(state: &PythState): u64 {
        state::get_stale_price_threshold_secs(state)
    }

    fun check_price_is_fresh(price: &Price, clock: &Clock, max_age_secs: u64) {
        let age = abs_diff(clock::timestamp_ms(clock)/1000, price::get_timestamp(price));
        assert!(age < max_age_secs, E_STALE_PRICE_UPDATE);
    }

    /// Please read more information about the update fee here: https://docs.pyth.network/consume-data/on-demand#fees
    public fun get_total_update_fee(pyth_state: &PythState, update_data: &vector<vector<u8>>): u64 {
        state::get_base_update_fee(pyth_state) * vector::length(update_data)
    }
}




// TODO - pyth tests
// https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/aptos/contracts/sources/pyth.move#L384

module pyth::pyth_tests{
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::clock::{Self};
    use sui::test_scenario::{Self, Scenario, ctx};
    use sui::package::Self;
    use sui::object::Self;

    use pyth::state::{Self};
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use pyth::data_source::{Self, DataSource};
    use pyth::i64::{Self};
    use pyth::price::{Self};

    use wormhole::setup::{Self as wormhole_setup, DeployerCap};
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};

    #[test_only]
    /// Init Wormhole core bridge state.
    /// Init Pyth state.
    /// Set initial Sui clock time,
    /// Mint some SUI fee coins.
    fun setup_test(
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources: vector<DataSource>,
        base_update_fee: u64,
        to_mint: u64
    ): (Scenario, Coin<SUI>) {

        let deployer = @0x1234;
        let scenario = test_scenario::begin(deployer);

        // Initialize Wormhole core bridge.
        wormhole_setup::init_test_only(ctx(&mut scenario));

        // Take the `DeployerCap` from the sender of the transaction.
        let deployer_cap =
            test_scenario::take_from_address<DeployerCap>(
                &scenario,
                deployer
            );

        // This will be created and sent to the transaction sender automatically
        // when the contract is published. This exists in place of grabbing
        // it from the sender.
        let upgrade_cap =
            package::test_publish(
                object::id_from_address(@0x0),
                test_scenario::ctx(&mut scenario)
            );

        let governance_chain = 1234;
        let governance_contract =
            x"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
        let initial_guardians =
            vector[
                x"1337133713371337133713371337133713371337",
                x"c0dec0dec0dec0dec0dec0dec0dec0dec0dec0de",
                x"ba5edba5edba5edba5edba5edba5edba5edba5ed"
            ];
        let guardian_set_seconds_to_live = 5678;
        let message_fee = 350;

        wormhole_setup::complete(
            deployer_cap,
            upgrade_cap,
            governance_chain,
            governance_contract,
            initial_guardians,
            guardian_set_seconds_to_live,
            message_fee,
            test_scenario::ctx(&mut scenario)
        );

        // Create and share a global clock object for timekeeping.
        clock::create_for_testing(ctx(&mut scenario));

        // Initialize Pyth state.
        let pyth_upgrade_cap=
            package::test_publish(
                object::id_from_address(@0x123456),
                test_scenario::ctx(&mut scenario)
            );

        state::init_test_only(ctx(&mut scenario));

        let pyth_deployer_cap = test_scenario::take_from_address<state::DeployerCap>(
            &scenario,
            @pyth
        );

        state::init_and_share_state(
            pyth_deployer_cap,
            pyth_upgrade_cap,
            stale_price_threshold,
            base_update_fee,
            data_source::new(governance_emitter_chain_id, external_address::new(bytes32::from_bytes(governance_emitter_address))),
            data_sources,
            ctx(&mut scenario)
        );

        let coins = coin::mint_for_testing<SUI>(to_mint, ctx(&mut scenario));
        (scenario, coins)
    }

    #[test_only]
    fun get_mock_price_infos(): vector<PriceInfo> {
        vector<PriceInfo>[
                price_info::new_price_info(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1"),
                        price::new(i64::new(1557, false), 7, i64::new(5, true), 1663680740),
                        price::new(i64::new(1500, false), 3, i64::new(5, true), 1663680740),
                    ),
                ),
                price_info::new_price_info(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe"),
                        price::new(i64::new(1050, false), 3, i64::new(5, true), 1663680745),
                        price::new(i64::new(1483, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new_price_info(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d"),
                        price::new(i64::new(1010, false), 2, i64::new(5, true), 1663680745),
                        price::new(i64::new(1511, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new_price_info(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8"),
                        price::new(i64::new(1739, false), 1, i64::new(5, true), 1663680745),
                        price::new(i64::new(1508, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
            ]
    }
}