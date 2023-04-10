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
    const E_PRICE_INFO_OBJECT_NOT_FOUND: u64 = 4;

    friend pyth::pyth_tests;

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
            // TODO - Construct an in-memory table to make look-ups faster?
            //        This loop might be expensive if there are a large number
            //        of updates and/or price_info_objects we are updating.
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
                };
                i = i + 1;
            };
            if (!found){
                abort(E_PRICE_INFO_OBJECT_NOT_FOUND)
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

module pyth::pyth_tests{
    use std::vector::{Self};

    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::test_scenario::{Self, Scenario, ctx, take_shared, return_shared};
    use sui::package::Self;
    use sui::object::{Self, ID};

    use pyth::state::{Self, State as PythState};
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo, PriceInfoObject};
    use pyth::price_feed::{Self};
    use pyth::data_source::{Self, DataSource};
    use pyth::i64::{Self};
    use pyth::price::{Self};
    use pyth::pyth::{Self};

    use wormhole::setup::{Self as wormhole_setup, DeployerCap};
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};
    use wormhole::state::{State as WormState};

    const DEPLOYER: address = @0x1234;

    #[test_only]
    /// A vector containing a single VAA with:
    /// - emitter chain ID 17
    /// - emitter address 0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b
    /// - payload corresponding to the batch price attestation of the prices returned by get_mock_price_infos()
    const TEST_VAAS: vector<vector<u8>> = vector[x"0100000000010036eb563b80a24f4253bee6150eb8924e4bdf6e4fa1dfc759a6664d2e865b4b134651a7b021b7f1ce3bd078070b688b6f2e37ce2de0d9b48e6a78684561e49d5201527e4f9b00000001001171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000001005032574800030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001"];

    #[test_only]
    /// Init Wormhole core bridge state.
    /// Init Pyth state.
    /// Set initial Sui clock time.
    /// Mint some SUI fee coins.
    fun setup_test(
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources: vector<DataSource>,
        base_update_fee: u64,
        to_mint: u64
    ): (Scenario, Coin<SUI>) {

        let scenario = test_scenario::begin(DEPLOYER);

        // Initialize Wormhole core bridge.
        wormhole_setup::init_test_only(ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        // Take the `DeployerCap` from the sender of the transaction.
        let deployer_cap =
            test_scenario::take_from_address<DeployerCap>(
                &scenario,
                DEPLOYER
            );

        // This will be created and sent to the transaction sender automatically
        // when the contract is published. This exists in place of grabbing
        // it from the sender.
        let upgrade_cap =
            package::test_publish(
                object::id_from_address(@wormhole),
                test_scenario::ctx(&mut scenario)
            );

        let governance_chain = 1234;
        let governance_contract =
            x"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
        let initial_guardians =
            vector[
                x"beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"
                //x"1337133713371337133713371337133713371337",
                //x"c0dec0dec0dec0dec0dec0dec0dec0dec0dec0de",
                //x"ba5edba5edba5edba5edba5edba5edba5edba5ed"
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
                object::id_from_address(@pyth),
                test_scenario::ctx(&mut scenario)
            );

        state::init_test_only(ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let pyth_deployer_cap = test_scenario::take_from_address<state::DeployerCap>(
            &scenario,
            DEPLOYER
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

     #[test_only]
    fun check_price_feeds_cached(expected: &vector<PriceInfo>, actual: &vector<PriceInfoObject>) {
        // Check that we can retrieve the correct current price and ema price for each price feed
        let i = 0;
        while (i < vector::length(expected)) {
            let price_feed = price_info::get_price_feed(vector::borrow(expected, i));
            let price = price_feed::get_price(price_feed);
            let ema_price = price_feed::get_ema_price(price_feed);
            let price_identifier = price_info::get_price_identifier(vector::borrow(expected, i));

            let actual_price_info = price_info::get_price_info_from_price_info_object(vector::borrow(actual, i));
            let actual_price_feed = price_info::get_price_feed(&actual_price_info);
            let actual_price = price_feed::get_price(actual_price_feed);
            let actual_ema_price = price_feed::get_ema_price(actual_price_feed);
            let actual_price_identifier = price_info::get_price_identifier(&actual_price_info);

            assert!(price == actual_price, 0);
            assert!(ema_price == actual_ema_price, 0);
            assert!(price_identifier::get_bytes(&price_identifier) == price_identifier::get_bytes(&actual_price_identifier), 0);

            i = i + 1;
        };
    }

    #[test]
    fun test_get_update_fee() {
        let single_update_fee = 50;
        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", vector[], single_update_fee, 0);
        test_scenario::next_tx(&mut scenario, DEPLOYER, );
        let pyth_state = take_shared<PythState>(&scenario);
        // Pass in a single VAA
        assert!(pyth::get_total_update_fee(&pyth_state, &vector[
            x"fb1543888001083cf2e6ef3afdcf827e89b11efd87c563638df6e1995ada9f93",
        ]) == single_update_fee, 1);

        // Pass in multiple VAAs
        assert!(pyth::get_total_update_fee(&pyth_state, &vector[
            x"4ee17a1a4524118de513fddcf82b77454e51be5d6fc9e29fc72dd6c204c0e4fa",
            x"c72fdf81cfc939d4286c93fbaaae2eec7bae28a5926fa68646b43a279846ccc1",
            x"d9a8123a793529c31200339820a3210059ecace6c044f81ecad62936e47ca049",
            x"84e4f21b3e65cef47fda25d15b4eddda1edf720a1d062ccbf441d6396465fbe6",
            x"9e73f9041476a93701a0b9c7501422cc2aa55d16100bec628cf53e0281b6f72f"
        ]) == 250, 1);

        return_shared(pyth_state);
        coin::burn_for_testing<SUI>(test_coins);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = wormhole::vaa::E_WRONG_VERSION)]
    fun test_create_price_feeds_corrupt_vaa() {
        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", vector[], 50, 0);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        // Pass in a corrupt VAA, which should fail deseriaizing
        let corrupt_vaa = x"90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";

        // Create Pyth price feed
        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            vector[corrupt_vaa],
            &clock,
            ctx(&mut scenario)
        );

        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(clock);
        coin::burn_for_testing<SUI>(test_coins);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = pyth::pyth::E_INVALID_DATA_SOURCE)]
    fun test_create_price_feeds_invalid_data_source() {
        // Initialize the contract with some valid data sources, excluding our test VAA's source
        let data_sources = vector<DataSource>[
            data_source::new(
                4, external_address::new(bytes32::new(x"0000000000000000000000000000000000000000000000000000000000007742"))
            ),
            data_source::new(
                5, external_address::new(bytes32::new(x"0000000000000000000000000000000000000000000000000000000000007637"))
            )
        ];

        let (scenario, test_coins) = setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, 50, 0);
        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &clock,
            ctx(&mut scenario)
        );

        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(clock);
        coin::burn_for_testing<SUI>(test_coins);
        test_scenario::end(scenario);
    }

    #[test_only]
    fun data_sources_for_test_vaa(): vector<DataSource> {
        // Set some valid data sources, including our test VAA's source
        vector<DataSource>[
            data_source::new(
                1, external_address::new(bytes32::from_bytes(x"0000000000000000000000000000000000000000000000000000000000000004"))),
                data_source::new(
                5, external_address::new(bytes32::new(x"0000000000000000000000000000000000000000000000000000000000007637"))),
                data_source::new(
                17, external_address::new(bytes32::new(x"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b")))
        ]
    }

    #[test]
    fun test_create_and_update_price_feeds_success() {
        let data_sources = data_sources_for_test_vaa();
        let base_update_fee = 50;
        let coins_to_mint = 5000;

        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, base_update_fee, coins_to_mint);
        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &clock,
            ctx(&mut scenario)
        );

        // Affirm that 4 objects, which correspond to the 4 new price info objects
        // containing the price feeds were created and shared.
        let effects = test_scenario::next_tx(&mut scenario, DEPLOYER);
        let shared_ids = test_scenario::shared(&effects);
        let created_ids = test_scenario::created(&effects);
        assert!(vector::length<ID>(&shared_ids)==4, 0);
        assert!(vector::length<ID>(&created_ids)==4, 0);

        let price_info_object_1 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_2 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_3 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_4 = take_shared<PriceInfoObject>(&scenario);

        // Create vector of price info objects (Sui objects with key ability and living in global store),
        // which contain the price feeds we want to update. Note that these can be passed into
        // update_price_feeds in any order!
        let price_info_object_vec = vector[price_info_object_1, price_info_object_2, price_info_object_3, price_info_object_4];

        pyth::update_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &mut price_info_object_vec,
            test_coins,
            &clock
        );

        price_info_object_1 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_2 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_3 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_4 = vector::pop_back(&mut price_info_object_vec);
        vector::destroy_empty(price_info_object_vec);

        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(price_info_object_1);
        return_shared(price_info_object_2);
        return_shared(price_info_object_3);
        return_shared(price_info_object_4);

        return_shared(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = pyth::pyth::E_PRICE_INFO_OBJECT_NOT_FOUND)]
    fun test_create_and_update_price_feeds_price_info_object_not_found_failure() {
        let data_sources = data_sources_for_test_vaa();
        let base_update_fee = 50;
        let coins_to_mint = 5000;

        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, base_update_fee, coins_to_mint);
        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &clock,
            ctx(&mut scenario)
        );

        // Affirm that 4 objects, which correspond to the 4 new price info objects
        // containing the price feeds were created and shared.
        let effects = test_scenario::next_tx(&mut scenario, DEPLOYER);
        let shared_ids = test_scenario::shared(&effects);
        let created_ids = test_scenario::created(&effects);
        assert!(vector::length<ID>(&shared_ids)==4, 0);
        assert!(vector::length<ID>(&created_ids)==4, 0);

        let price_info_object_1 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_2 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_3 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_4 = take_shared<PriceInfoObject>(&scenario);

        // Note that here we only pass in 3 price info objects corresponding to 3 out
        // of the 4 price feeds.
        let price_info_object_vec = vector[price_info_object_1, price_info_object_2, price_info_object_3];

        pyth::update_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &mut price_info_object_vec,
            test_coins,
            &clock
        );

        price_info_object_1 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_2 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_3 = vector::pop_back(&mut price_info_object_vec);

        vector::destroy_empty(price_info_object_vec);
        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(price_info_object_1);
        return_shared(price_info_object_2);
        return_shared(price_info_object_3);
        return_shared(price_info_object_4);

        return_shared(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = pyth::pyth::E_INSUFFICIENT_FEE)]
    fun test_create_and_update_price_feeds_insufficient_fee() {
        let data_sources = data_sources_for_test_vaa();
        let base_update_fee = 50;
        let coins_to_mint = 5;

        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, base_update_fee, coins_to_mint);
        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &clock,
            ctx(&mut scenario)
        );

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let price_info_object = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_vec = vector[price_info_object];

        pyth::update_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &mut price_info_object_vec,
            test_coins,
            &clock
        );

        price_info_object = vector::pop_back(&mut price_info_object_vec);
        vector::destroy_empty(price_info_object_vec);
        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(price_info_object);
        return_shared(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_cache(){
        let data_sources = data_sources_for_test_vaa();
        let base_update_fee = 50;
        let coins_to_mint = 5000;

        let (scenario, test_coins) =  setup_test(500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, base_update_fee, coins_to_mint);
        test_scenario::next_tx(&mut scenario, DEPLOYER);

        let pyth_state = take_shared<PythState>(&scenario);
        let worm_state = take_shared<WormState>(&scenario);
        let clock = take_shared<Clock>(&scenario);

        pyth::create_price_feeds(
            &mut worm_state,
            &mut pyth_state,
            TEST_VAAS,
            &clock,
            ctx(&mut scenario)
        );

        // Affirm that 4 objects, which correspond to the 4 new price info objects
        // containing the price feeds were created and shared.
        let effects = test_scenario::next_tx(&mut scenario, DEPLOYER);
        let shared_ids = test_scenario::shared(&effects);
        let created_ids = test_scenario::created(&effects);
        assert!(vector::length<ID>(&shared_ids)==4, 0);
        assert!(vector::length<ID>(&created_ids)==4, 0);

        let price_info_object_1 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_2 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_3 = take_shared<PriceInfoObject>(&scenario);
        let price_info_object_4 = take_shared<PriceInfoObject>(&scenario);

        let updates = get_mock_price_infos();
        let price_info_object_vec = vector[
            price_info_object_1,
            price_info_object_2,
            price_info_object_3,
            price_info_object_4
        ];

        check_price_feeds_cached(&updates, &price_info_object_vec);

        price_info_object_1 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_2 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_3 = vector::pop_back(&mut price_info_object_vec);
        price_info_object_4 = vector::pop_back(&mut price_info_object_vec);
        vector::destroy_empty(price_info_object_vec);

        return_shared(pyth_state);
        return_shared(worm_state);
        return_shared(price_info_object_1);
        return_shared(price_info_object_2);
        return_shared(price_info_object_3);
        return_shared(price_info_object_4);
        coin::burn_for_testing<SUI>(test_coins);

        return_shared(clock);
        test_scenario::end(scenario);
    }

}
