module pyth::pyth {
    use std::vector;
    use sui::tx_context::{TxContext};
    use sui::coin::{Coin};
    use sui::sui::{SUI};
    use sui::transfer::{Self};
    use sui::tx_context::{Self};

    use pyth::event::{Self as pyth_event};
    use pyth::data_source::{Self, DataSource};
    use pyth::state::{Self as state, State as PythState, DeployerCap};
    use pyth::price_info::{Self, PriceInfo, PriceInfoObject};
    use pyth::batch_price_attestation::{Self};
    use pyth::price_feed::{Self};
    use pyth::price::{Self};

    use wormhole::external_address::{Self};
    use wormhole::vaa::{Self};
    use wormhole::state::{State as WormState};


    /// Call init_and_share_state with deployer cap to initialize
    /// state and emit event corresponding to Pyth initialization.
    public entry fun init_pyth(
        deployer: DeployerCap,
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
            stale_price_threshold,
            update_fee,
            data_source::new(
                governance_emitter_chain_id,
                external_address::from_bytes(governance_emitter_address)),
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

        // TODO - add custom error type error::data_source_emitter_address_and_chain_ids_different_lengths()
        assert!(vector::length(&emitter_chain_ids) == vector::length(&emitter_addresses), 0);

        let sources = vector::empty();
        let i = 0;
        while (i < vector::length(&emitter_chain_ids)) {
            vector::push_back(&mut sources, data_source::new(
                *vector::borrow(&emitter_chain_ids, i),
                external_address::from_bytes(*vector::borrow(&emitter_addresses, i))
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
        ctx: &mut TxContext
    ){
        while (!vector::is_empty(&vaas)) {
            let vaa = vector::pop_back(&mut vaas);

            // Deserialize the VAA
            let vaa = vaa::parse_and_verify(worm_state, vaa, ctx);

            // Check that the VAA is from a valid data source (emitter)
            assert!(
                state::is_valid_data_source(
                    pyth_state,
                    data_source::new(
                        (vaa::emitter_chain(&vaa) as u64),
                        vaa::emitter_address(&vaa))
                    ),
            0); // TODO - use custom error message - error::invalid_data_source()

            // Deserialize the batch price attestation
            let price_infos = batch_price_attestation::destroy(batch_price_attestation::deserialize(vaa::take_payload(vaa), ctx));
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
        ctx: &mut TxContext
    ) {
        // Charge the message update fee
        // TODO - error::insufficient_fee()
        //assert!(get_update_fee(&vaas) <= coin::value(&fee), 0);
        transfer::public_transfer(fee, @pyth);

        // Update the price feed from each VAA
        while (!vector::is_empty(&vaas)) {
            update_price_feed_from_single_vaa(
                worm_state,
                pyth_state,
                vector::pop_back(&mut vaas),
                price_info_objects,
                ctx
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
        ctx: &mut TxContext
    ) {
        // Deserialize the VAA
        let vaa = vaa::parse_and_verify(worm_state, worm_vaa, ctx);

        // Check that the VAA is from a valid data source (emitter)
        assert!(
            state::is_valid_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&vaa) as u64),
                    vaa::emitter_address(&vaa))
                ),
        0); // TODO - use custom error message - error::invalid_data_source()

        // Deserialize the batch price attestation
        let price_infos = batch_price_attestation::destroy(batch_price_attestation::deserialize(vaa::take_payload(vaa), ctx));

        // Update price info objects.
        update_cache(price_infos, price_info_objects, ctx);
    }

    /// Update PriceInfoObjects using up-to-date PriceInfos.
    fun update_cache(
        updates: vector<PriceInfo>,
        price_info_objects: &mut vector<PriceInfoObject>,
        ctx: &mut TxContext
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
                    // TODO: use clock timestamp instead of epoch in the future
                    pyth_event::emit_price_feed_update(price_feed::from(price_info::get_price_feed(&update)), tx_context::epoch(ctx));

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
}
