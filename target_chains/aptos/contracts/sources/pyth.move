module pyth::pyth {
    use pyth::batch_price_attestation::{Self};
    use pyth::price_identifier::{Self, PriceIdentifier};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::{AptosCoin};
    use pyth::price::Price;
    use pyth::price;
    use pyth::data_source::{Self, DataSource};
    use aptos_framework::timestamp;
    use pyth::deserialize::{Self};
    use wormhole::cursor::{Self, Cursor};
    use std::vector;
    use pyth::state;
    use wormhole::vaa;
    use wormhole::u16;
    use wormhole::external_address;
    use std::account;
    use std::signer;
    use deployer::deployer;
    use pyth::error;
    use pyth::event;
    use pyth::merkle;
    use pyth::keccak160;

    #[test_only]
    friend pyth::pyth_test;

    const PYTHNET_ACCUMULATOR_UPDATE_MAGIC: u64 = 1347305813;
    const ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC: u64 = 1096111958;


    // -----------------------------------------------------------------------------
    // Initialisation functions

    public entry fun init(
        deployer: &signer,
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources_emitter_chain_ids: vector<u64>,
        data_sources_emitter_addresses: vector<vector<u8>>,
        update_fee: u64,
    ) {
        // Claim the signer capability from the deployer. Note that this is a one-time operation,
        // so that this function can only be called once.
        let signer_capability = deployer::claim_signer_capability(deployer, @pyth);
        init_internal(
            signer_capability,
            stale_price_threshold,
            governance_emitter_chain_id,
            governance_emitter_address,
            parse_data_sources(
                data_sources_emitter_chain_ids,
                data_sources_emitter_addresses,
            ),
            update_fee
        )
    }

    fun init_internal(
        signer_capability: account::SignerCapability,
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources: vector<DataSource>,
        update_fee: u64) {
        let pyth = account::create_signer_with_capability(&signer_capability);
        state::init(
            &pyth,
            stale_price_threshold,
            update_fee,
            data_source::new(
                governance_emitter_chain_id,
                external_address::from_bytes(governance_emitter_address)),
            data_sources,
            signer_capability
        );
        event::init(&pyth);
        if (!coin::is_account_registered<AptosCoin>(signer::address_of(&pyth))) {
            coin::register<AptosCoin>(&pyth);
        }
    }

    fun parse_data_sources(
        emitter_chain_ids: vector<u64>,
        emitter_addresses: vector<vector<u8>>): vector<DataSource> {

        assert!(vector::length(&emitter_chain_ids) == vector::length(&emitter_addresses),
            error::data_source_emitter_address_and_chain_ids_different_lengths());

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

    #[test_only]
    /// Expose a public initialization function for use in tests
    public fun init_test(
        signer_capability: account::SignerCapability,
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources: vector<DataSource>,
        update_fee: u64,
    ) {
        init_internal(
            signer_capability,
            stale_price_threshold,
            governance_emitter_chain_id,
            governance_emitter_address,
            data_sources,
            update_fee
        )
    }

// -----------------------------------------------------------------------------
// Update the cached prices
//
// Pyth uses an uses an on-demand update model, where consumers need to update the
/// cached prices before using them. Please read more about this at https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand.

    /// Update the cached price feeds with the data in the given VAAs. This is a
    /// convenience wrapper around update_price_feeds(), which allows you to update the price feeds
    /// using an entry function.
    ///
    /// If possible, it is recommended to use update_price_feeds() instead, which avoids the need
    /// to pass a signer account. update_price_feeds_with_funder() should only be used when
    /// you need to call an entry function.
    ///
    /// This function will charge an update fee, transferring some AptosCoin's
    /// from the given funder account to the Pyth contract. The amount of coins that will be transferred
    /// to perform this update can be queried with get_update_fee(&vaas). The signer must have sufficient
    /// account balance to pay this fee, otherwise the transaction will abort.
    ///
    /// Please read more information about the update fee here: https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees
    public entry fun update_price_feeds_with_funder(account: &signer, vaas: vector<vector<u8>>) {
        let total_updates = 0;
        // Update the price feed from each VAA
        while (!vector::is_empty(&vaas)) {
            total_updates = total_updates + update_price_feed_from_single_vaa(vector::pop_back(&mut vaas));
        };
        // Charge the message update fee
        let update_fee = state::get_base_update_fee() * total_updates;
        let fee = coin::withdraw<AptosCoin>(account, update_fee);
        coin::deposit(@pyth, fee);
    }

    /// Update the cached price feeds with the data in the given VAAs.
    /// The vaas argument is a vector of VAAs encoded as bytes.
    ///
    /// The javascript https://github.com/pyth-network/pyth-js/tree/main/pyth-aptos-js package
    /// should be used to fetch these VAAs from the Price Service. More information about this
    /// process can be found at https://docs.pyth.network/documentation/pythnet-price-feeds.
    ///
    /// The given fee must contain a sufficient number of coins to pay the update fee for the given vaas.
    /// The update fee amount can be queried by calling get_update_fee(&vaas).
    ///
    /// Please read more information about the update fee here: https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees
    public fun update_price_feeds(vaas: vector<vector<u8>>, fee: Coin<AptosCoin>) {
        let total_updates = 0;
        // Update the price feed from each VAA
        while (!vector::is_empty(&vaas)) {
            total_updates = total_updates + update_price_feed_from_single_vaa(vector::pop_back(&mut vaas));
        };
        // Charge the message update fee
        let update_fee = state::get_base_update_fee() * total_updates;
        assert!(update_fee <= coin::value(&fee), error::insufficient_fee());
        coin::deposit(@pyth, fee);
    }

    fun verify_data_source(vaa: &vaa::VAA) {
        assert!(
            state::is_valid_data_source(
                data_source::new(
                    u16::to_u64(vaa::get_emitter_chain(vaa)),
                    vaa::get_emitter_address(vaa))),
            error::invalid_data_source());
    }

    /// Given the payload of a VAA related to accumulator messages, asserts the verification variant is merkle and
    /// extracts the merkle root digest
    fun parse_accumulator_merkle_root_from_vaa_payload(message: vector<u8>): keccak160::Hash {
        let msg_payload_cursor = cursor::init(message);
        let payload_type = deserialize::deserialize_u32(&mut msg_payload_cursor);
        assert!(payload_type == ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC, error::invalid_wormhole_message());
        let wh_message_payload_type = deserialize::deserialize_u8(&mut msg_payload_cursor);
        assert!(wh_message_payload_type == 0, error::invalid_wormhole_message()); // Merkle variant
        let _merkle_root_slot = deserialize::deserialize_u64(&mut msg_payload_cursor);
        let _merkle_root_ring_size = deserialize::deserialize_u32(&mut msg_payload_cursor);
        let merkle_root_hash = deserialize::deserialize_vector(&mut msg_payload_cursor, 20);
        cursor::rest(msg_payload_cursor);
        keccak160::new(merkle_root_hash)
    }

    /// Given a single accumulator price update message, asserts that it is a PriceFeedMessage,
    /// parses the info and returns a PriceInfo representing the encoded information
    fun parse_accumulator_update_message(message: vector<u8>): PriceInfo {
        let message_cur = cursor::init(message);
        let message_type = deserialize::deserialize_u8(&mut message_cur);

        assert!(message_type == 0, error::invalid_accumulator_message()); // PriceFeedMessage variant
        let price_identifier = price_identifier::from_byte_vec(deserialize::deserialize_vector(&mut message_cur, 32));
        let price = deserialize::deserialize_i64(&mut message_cur);
        let conf = deserialize::deserialize_u64(&mut message_cur);
        let expo = deserialize::deserialize_i32(&mut message_cur);
        let publish_time = deserialize::deserialize_u64(&mut message_cur);
        let _prev_publish_time = deserialize::deserialize_i64(&mut message_cur);
        let ema_price = deserialize::deserialize_i64(&mut message_cur);
        let ema_conf = deserialize::deserialize_u64(&mut message_cur);
        let price_info = price_info::new(
            timestamp::now_seconds(), // not used anywhere kept for backward compatibility
            timestamp::now_seconds(),
            price_feed::new(
                price_identifier,
                pyth::price::new(price, conf, expo, publish_time),
                pyth::price::new(ema_price, ema_conf, expo, publish_time),
            )
        );
        cursor::rest(message_cur);
        price_info
    }

    /// Given a cursor at the beginning of accumulator price updates array data and a merkle_root hash,
    /// parses the price updates and proofs, verifies the proofs against the merkle_root and
    /// returns an array of PriceInfo representing the updates
    fun parse_and_verify_accumulator_updates(
        cursor: &mut Cursor<u8>,
        merkle_root: &keccak160::Hash
    ): vector<PriceInfo> {
        let update_size = deserialize::deserialize_u8(cursor);
        let updates: vector<PriceInfo> = vector[];
        while (update_size > 0) {
            let message_size = deserialize::deserialize_u16(cursor);
            let message = deserialize::deserialize_vector(cursor, message_size);
            let update = parse_accumulator_update_message(message);
            vector::push_back(&mut updates, update);
            let path_size = deserialize::deserialize_u8(cursor);
            let merkle_path: vector<keccak160::Hash> = vector[];
            while (path_size > 0) {
                let hash = deserialize::deserialize_vector(cursor, keccak160::get_hash_length());
                vector::push_back(&mut merkle_path, keccak160::new(hash));
                path_size = path_size - 1;
            };
            assert!(merkle::check(&merkle_path, merkle_root, message), error::invalid_proof());
            update_size = update_size - 1;
        };
        updates
    }


    /// Given a cursor at the beginning of an accumulator message, verifies the validity of the message and the
    /// embedded VAA, parses and verifies the price updates and returns an array of PriceInfo representing the updates
    fun parse_and_verify_accumulator_message(cursor: &mut Cursor<u8>): vector<PriceInfo> {
        let major = deserialize::deserialize_u8(cursor);
        assert!(major == 1, error::invalid_accumulator_payload());
        let _minor = deserialize::deserialize_u8(cursor);

        let trailing_size = deserialize::deserialize_u8(cursor);
        deserialize::deserialize_vector(cursor, (trailing_size as u64));

        let proof_type = deserialize::deserialize_u8(cursor);
        assert!(proof_type == 0, error::invalid_accumulator_payload());

        let vaa_size = deserialize::deserialize_u16(cursor);
        let vaa = deserialize::deserialize_vector(cursor, vaa_size);
        let msg_vaa = vaa::parse_and_verify(vaa);
        verify_data_source(&msg_vaa);
        let merkle_root_hash = parse_accumulator_merkle_root_from_vaa_payload(vaa::get_payload(&msg_vaa));
        vaa::destroy(msg_vaa);
        parse_and_verify_accumulator_updates(cursor, &merkle_root_hash)
    }

    fun update_price_feed_from_single_vaa(vaa: vector<u8>): u64 {
        let cur = cursor::init(vaa);
        let header: u64 = deserialize::deserialize_u32(&mut cur);
        let total_updates;
        let updates = if (header == PYTHNET_ACCUMULATOR_UPDATE_MAGIC) {
            let result = parse_and_verify_accumulator_message(&mut cur);
            total_updates = vector::length(&result);
            result
        }
        else {
            // Deserialize the VAA
            let vaa = vaa::parse_and_verify(vaa);
            // Check that the VAA is from a valid data source (emitter)
            verify_data_source(&vaa);
            // Deserialize the batch price attestation
            total_updates = 1;
            batch_price_attestation::destroy(batch_price_attestation::deserialize(vaa::destroy(vaa)))
        };
        update_cache(updates);
        cursor::rest(cur);
        total_updates
    }

    /// Update the cache with given price updates, if they are newer than the ones currently cached.
    public(friend) fun update_cache(updates: vector<PriceInfo>) {
        while (!vector::is_empty(&updates)) {
            let update = vector::pop_back(&mut updates);
            if (is_fresh_update(&update)) {
                let price_feed = *price_info::get_price_feed(&update);
                let price_identifier = price_feed::get_price_identifier(&price_feed);
                state::set_latest_price_info(
                    *price_identifier,
                    update,
                );
                event::emit_price_feed_update(price_feed, timestamp::now_microseconds());
            }
        };
        vector::destroy_empty(updates);
    }

    /// A convenience wrapper around update_price_feeds_if_fresh(), allowing you to conditionally
    /// update the price feeds using an entry function.
    ///
    /// If possible, it is recommended to use update_price_feeds_if_fresh() instead, which avoids the need
    /// to pass a signer account. update_price_feeds_if_fresh_with_funder() should only be used when
    /// you need to call an entry function.
    public entry fun update_price_feeds_if_fresh_with_funder(
        account: &signer,
        vaas: vector<vector<u8>>,
        price_identifiers: vector<vector<u8>>,
        publish_times: vector<u64>) {
        let coins = coin::withdraw<AptosCoin>(account, get_update_fee(&vaas));
        update_price_feeds_if_fresh(vaas, price_identifiers, publish_times, coins);
    }

    #[legacy_entry_fun]
    /// Update the cached price feeds with the data in the given VAAs, using
    /// update_price_feeds(). However, this function will only have an effect if any of the
    /// prices in the update are fresh. The price_identifiers and publish_times parameters
    /// are used to determine if the update is fresh without doing any serialisation or verification
    /// of the VAAs, potentially saving time and gas. If the update contains no fresh data, this function
    /// will revert with error::no_fresh_data().
    ///
    /// For a given price update i in the batch, that price is considered fresh if the current cached
    /// price for price_identifiers[i] is older than publish_times[i].
    public entry fun update_price_feeds_if_fresh(
        vaas: vector<vector<u8>>,
        price_identifiers: vector<vector<u8>>,
        publish_times: vector<u64>,
        fee: Coin<AptosCoin>) {

        assert!(vector::length(&price_identifiers) == vector::length(&publish_times),
            error::invalid_publish_times_length());

        let fresh_data = false;
        let i = 0;
        while (i < vector::length(&publish_times)) {
            let price_identifier = price_identifier::from_byte_vec(
                *vector::borrow(&price_identifiers, i));
            if (!state::price_info_cached(price_identifier)) {
                fresh_data = true;
                break
            };

            let cached_timestamp = price::get_timestamp(&get_price_unsafe(price_identifier));
            if (cached_timestamp < *vector::borrow(&publish_times, i)) {
                fresh_data = true;
                break
            };

            i = i + 1;
        };

        assert!(fresh_data, error::no_fresh_data());
        update_price_feeds(vaas, fee);
    }

    /// Determine if the given price update is "fresh": we have nothing newer already cached for that
    /// price feed.
    fun is_fresh_update(update: &PriceInfo): bool {
        // Get the timestamp of the update's current price
        let price_feed = price_info::get_price_feed(update);
        let update_timestamp = price::get_timestamp(&price_feed::get_price(price_feed));

        // Get the timestamp of the cached data for the price identifier
        let price_identifier = price_feed::get_price_identifier(price_feed);
        if (!price_feed_exists(*price_identifier)) {
            return true
        };
        let cached_timestamp = price::get_timestamp(&get_price_unsafe(*price_identifier));

        update_timestamp > cached_timestamp
    }

// -----------------------------------------------------------------------------
// Query the cached prices
//
// It is strongly recommended to update the cached prices using the functions above,
// before using the functions below to query the cached data.

    /// Determine if a price feed for the given price_identifier exists
    public fun price_feed_exists(price_identifier: PriceIdentifier): bool {
        state::price_info_cached(price_identifier)
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the stale price threshold.
    ///
    /// Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for
    /// how to how this price safely.
    ///
    /// Important: Pyth uses an on-demand update model, where consumers need to update the
    /// cached prices before using them. Please read more about this at https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand.
    /// get_price() is likely to abort unless you call update_price_feeds() to update the cached price
    /// beforehand, as the cached prices may be older than the stale price threshold.
    ///
    /// Note that the price_identifier does not correspond to a seperate Aptos account:
    /// all price feeds are stored in the single pyth account. The price identifier is an
    /// opaque identifier for a price feed.
    public fun get_price(price_identifier: PriceIdentifier): Price {
        get_price_no_older_than(price_identifier, state::get_stale_price_threshold_secs())
    }

    #[view]
    /// A view function version of get_price(...) that's available in offchain programming environments
    /// including aptos fullnode api, aptos cli, and aptos ts sdk.
    public fun get_price_by_feed_id(feed_id: vector<u8>): Price {
        let price_identifier = price_identifier::from_byte_vec(feed_id);
        get_price(price_identifier)
    }

    /// Get the latest available price cached for the given price identifier, if that price is
    /// no older than the given age.
    public fun get_price_no_older_than(price_identifier: PriceIdentifier, max_age_secs: u64): Price {
        let price = get_price_unsafe(price_identifier);
        check_price_is_fresh(&price, max_age_secs);

        price
    }

    #[view]
    public fun get_price_no_older_than_by_feed_id(feed_id: vector<u8>, max_age_secs: u64): Price {
        let price_identifier = price_identifier::from_byte_vec(feed_id);
        get_price_no_older_than(price_identifier, max_age_secs)
    }

    /// Get the latest available price cached for the given price identifier.
    ///
    /// WARNING: the returned price can be from arbitrarily far in the past.
    /// This function makes no guarantees that the returned price is recent or
    /// useful for any particular application. Users of this function should check
    /// the returned timestamp to ensure that the returned price is sufficiently
    /// recent for their application. The checked get_price_no_older_than()
    /// function should be used in preference to this.
    public fun get_price_unsafe(price_identifier: PriceIdentifier): Price {
        price_feed::get_price(
            price_info::get_price_feed(&state::get_latest_price_info(price_identifier)))
    }

    #[view]
    public fun get_price_unsafe_by_feed_id(feed_id: vector<u8>): Price {
        let price_identifier = price_identifier::from_byte_vec(feed_id);
        get_price_unsafe(price_identifier)
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
    public fun get_stale_price_threshold_secs(): u64 {
        state::get_stale_price_threshold_secs()
    }

    fun check_price_is_fresh(price: &Price, max_age_secs: u64) {
        let age = abs_diff(timestamp::now_seconds(), price::get_timestamp(price));
        assert!(age < max_age_secs, error::stale_price_update());
    }

    /// Get the latest available exponentially moving average price cached for the given
    /// price identifier, if that price is no older than the stale price threshold.
    ///
    /// Important: Pyth uses an on-demand update model, where consumers need to update the
    /// cached prices before using them. Please read more about this at https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand.
    /// get_ema_price() is likely to abort unless you call update_price_feeds() to update the cached price
    /// beforehand, as the cached prices may be older than the stale price threshold.
    public fun get_ema_price(price_identifier: PriceIdentifier): Price {
        get_ema_price_no_older_than(price_identifier, state::get_stale_price_threshold_secs())
    }

    /// Get the latest available exponentially moving average price cached for the given price identifier,
    /// if that price is no older than the given age.
    public fun get_ema_price_no_older_than(price_identifier: PriceIdentifier, max_age_secs: u64): Price {
        let price = get_ema_price_unsafe(price_identifier);
        check_price_is_fresh(&price, max_age_secs);

        price
    }

    /// Get the latest available exponentially moving average price cached for the given price identifier.
    ///
    /// WARNING: the returned price can be from arbitrarily far in the past.
    /// This function makes no guarantees that the returned price is recent or
    /// useful for any particular application. Users of this function should check
    /// the returned timestamp to ensure that the returned price is sufficiently
    /// recent for their application. The checked get_ema_price_no_older_than()
    /// function should be used in preference to this.
    public fun get_ema_price_unsafe(price_identifier: PriceIdentifier): Price {
        price_feed::get_ema_price(
            price_info::get_price_feed(&state::get_latest_price_info(price_identifier)))
    }

    /// Get the number of AptosCoin's required to perform the given price updates.
    ///
    /// Please read more information about the update fee here: https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees
    public fun get_update_fee(update_data: &vector<vector<u8>>): u64 {
        let i = 0;
        let total_updates = 0;
        while (i < vector::length(update_data)) {
            let cur = cursor::init(*vector::borrow(update_data, i));
            let header: u64 = deserialize::deserialize_u32(&mut cur);
            if (header == PYTHNET_ACCUMULATOR_UPDATE_MAGIC) {
                //TODO: this may be expensive and can be optimized by not verifying the messages
                let updates = parse_and_verify_accumulator_message(&mut cur);
                total_updates = total_updates + vector::length(&updates);
            }
            else {
                total_updates = total_updates + 1;
            };
            cursor::rest(cur);
            i = i + 1;
        };
        state::get_base_update_fee() * total_updates
    }
}

// -----------------------------------------------------------------------------
// Tests
#[test_only]
module pyth::pyth_test {
    use pyth::pyth;
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use aptos_framework::coin::{Self, Coin, BurnCapability, MintCapability};
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use pyth::i64;
    use pyth::price;
    use pyth::data_source::{Self, DataSource};
    use aptos_framework::timestamp;
    use std::vector;
    use wormhole::external_address;
    use std::account;
    use std::signer;
    use wormhole::wormhole;

    #[test_only]
    fun setup_test(
        aptos_framework: &signer,
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources: vector<DataSource>,
        update_fee: u64,
        to_mint: u64): (BurnCapability<AptosCoin>, MintCapability<AptosCoin>, Coin<AptosCoin>) {
        // Initialize wormhole with a large message collection fee
        wormhole::wormhole_test::setup(100000);

        // Set the current time
        timestamp::update_global_time_for_test_secs(1663680745);

        // Deploy and initialize a test instance of the Pyth contract
        let deployer = account::create_signer_with_capability(&
            account::create_test_signer_cap(@0x277fa055b6a73c42c0662d5236c65c864ccbf2d4abd21f174a30c8b786eab84b));
        let (_pyth, signer_capability) = account::create_resource_account(&deployer, b"pyth");
        pyth::init_test(signer_capability, stale_price_threshold, governance_emitter_chain_id, governance_emitter_address, data_sources, update_fee);

        let (burn_capability, mint_capability) = aptos_coin::initialize_for_test(aptos_framework);
        let coins = coin::mint(to_mint, &mint_capability);
        (burn_capability, mint_capability, coins)
    }

    #[test_only]
    fun cleanup_test(burn_capability: BurnCapability<AptosCoin>, mint_capability: MintCapability<AptosCoin>) {
        coin::destroy_mint_cap(mint_capability);
        coin::destroy_burn_cap(burn_capability);
    }

    #[test_only]
    fun get_mock_price_infos(): vector<PriceInfo> {
        vector<PriceInfo>[
                price_info::new(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1"),
                        price::new(i64::new(1557, false), 7, i64::new(5, true), 1663680740),
                        price::new(i64::new(1500, false), 3, i64::new(5, true), 1663680740),
                    ),
                ),
                price_info::new(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe"),
                        price::new(i64::new(1050, false), 3, i64::new(5, true), 1663680745),
                        price::new(i64::new(1483, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new(
                    1663680747,
                    1663074349,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d"),
                        price::new(i64::new(1010, false), 2, i64::new(5, true), 1663680745),
                        price::new(i64::new(1511, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new(
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
    /// A vector containing a single VAA with:
    /// - emitter chain ID 17
    /// - emitter address 0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b
    /// - payload corresponding to the batch price attestation of the prices returned by get_mock_price_infos()
    const TEST_VAAS: vector<vector<u8>> = vector[x"0100000000010036eb563b80a24f4253bee6150eb8924e4bdf6e4fa1dfc759a6664d2e865b4b134651a7b021b7f1ce3bd078070b688b6f2e37ce2de0d9b48e6a78684561e49d5201527e4f9b00000001001171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000001005032574800030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001"];

    #[test_only]
    const TEST_ACCUMULATOR: vector<u8> = x"504e41550100000000a0010000000001005d461ac1dfffa8451edda17e4b28a46c8ae912422b2dc0cb7732828c497778ea27147fb95b4d250651931845e7f3e22c46326716bcf82be2874a9c9ab94b6e42000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000000004155575600000000000000000000000000da936d73429246d131873a0bab90ad7b416510be01005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65f958f4883f9d2a8b5b1008d1fa01db95cf4a8c7000000006491cc757be59f3f377c0d3f423a695e81ad1eb504f8554c3620c3fd02f2ee15ea639b73fa3db9b34a245bdfa015c260c5a8a1180177cf30b2c0bebbb1adfe8f7985d051d2";
    #[test_only]
    const TEST_ACCUMULATOR_3_MSGS: vector<u8> = x"504e41550100000000a001000000000100d39b55fa311213959f91866d52624f3a9c07350d8956f6d42cfbb037883f31575c494a2f09fea84e4884dc9c244123fd124bc7825cd64d7c11e33ba5cfbdea7e010000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b000000000000000000415557560000000000000000000000000029da4c066b6e03b16a71e77811570dd9e19f258103005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf60000000000000064000000000000003200000009000000006491cc747be59f3f377c0d3f000000000000006300000000000000340436992facb15658a7e9f08c4df4848ca80750f61fadcd96993de66b1fe7aef94e29e3bbef8b12db2305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d950055006e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af000000000000006500000000000000330000000a000000006491cc7504f8554c3620c3fd0000000000000064000000000000003504171ed10ac4f1eacf3a4951e1da6b119f07c45da5adcd96993de66b1fe7aef94e29e3bbef8b12db2305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d9500550031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c68000000000000006600000000000000340000000b000000006491cc76e87d69c7b51242890000000000000065000000000000003604f2ee15ea639b73fa3db9b34a245bdfa015c260c5fe83e4772e0e346613de00e5348158a01bcb27b305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_3_MSGS_LATER: vector<u8> = x"504e41550100000000a00100000000010056c1b66d4c93315ace5b0d8f5cee8ff068226e8623d7774389083a0ddf9952124cdc90c36f064c4e2b613a0dfe440c48892cf430b232abdc4993ce32463e4a1a000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000000004155575600000000000000000000000000cff05501cdaa105762dfedd238329fa3a96706dd03005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6000000000000006e000000000000003c00000013000000006491cc7e7be59f3f377c0d3f000000000000006d000000000000003e0445fb6c6bcdc996d401388588879afee37bc9c721394c4cc20e3b10b0c72d37ab53b0d56880d2d37905a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d950055006e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af000000000000006f000000000000003d00000014000000006491cc7f04f8554c3620c3fd000000000000006e000000000000003f04f41f65577b25a78041be51a163e2e6e991c4c92b394c4cc20e3b10b0c72d37ab53b0d56880d2d37905a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d9500550031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c680000000000000070000000000000003e00000015000000006491cc80e87d69c7b5124289000000000000006f000000000000004004f2ee15ea639b73fa3db9b34a245bdfa015c260c512ff930a26f8bce92f17545a6d60502c7767e71e05a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_INVALID_PROOF_1: vector<u8> = x"504e41550100000000a001000000000100110db9cd8325ccfab0dae92eeb9ea70a1faba5c5e96dc21ff46a8ddc560afc9a60df096b8ff21172804692bbdc958153e838437d8b474cbf45f0dc2a8acae831000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000000004155575600000000000000000000000000a8bea2b5f12f3177ff9b3929d77c3476ab2d32c602005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6fa75cd3aa3bb5ace5e2516446f71f85be36bd19bb0703f3154bb3db07be59f3f377c0d3f44661d9a8736c68884c8169e8b636ee3043202397384073120dce9e5d0efe24b44b4a0d62da8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d950055006e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af5f958f4883f9d2a8b5b1008d1fa01db95cf4a8c7423a695e81ad1eb504f8554c3620c3fd40b40f7d581ac802e2de5cb82a9ae672043202397384073120dce9e5d0efe24b44b4a0d62da8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_INVALID_ACC_MSG: vector<u8> = x"504e41550100000000a0010000000001005d461ac1dfffa8451edda17e4b28a46c8ae912422b2dc0cb7732828c497778ea27147fb95b4d250651931845e7f3e22c46326716bcf82be2874a9c9ab94b6e42000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000000004155575600000000000000000000000000da936d73429246d131873a0bab90ad7b416510be01005540b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65f958f4883f9d2a8b5b1008d1fa01db95cf4a8c7000000006491cc757be59f3f377c0d3f423a695e81ad1eb504f8554c3620c3fd02f2ee15ea639b73fa3db9b34a245bdfa015c260c5a8a1180177cf30b2c0bebbb1adfe8f7985d051d2";
    #[test_only]
    const TEST_ACCUMULATOR_INVALID_WH_MSG: vector<u8> = x"504e41550100000000a001000000000100e87f98238c5357730936cfdfde3a37249e5219409a4f41b301924b8eb10815a43ea2f96e4fe1bc8cd398250f39448d3b8ca57c96f9cf7a2be292517280683caa010000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b00000000000000000041555755000000000000000000000000000fb6f9f2b3b6cc1c9ef6708985fef226d92a3c0801005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6fa75cd3aa3bb5ace5e2516446f71f85be36bd19b000000006491cc747be59f3f377c0d3f44661d9a8736c68884c8169e8b636ee301f2ee15ea639b73fa3db9b34a245bdfa015c260c5";
    #[test_only]
    const TEST_ACCUMULATOR_INVALID_MAJOR_VERSION: vector<u8> = x"504e41553c00000000a001000000000100496b7fbd18dca2f0e690712fd8ca522ff79ca7d9d6d22e9f5d753fba4bd16fff440a811bad710071c79859290bcb1700de49dd8400db90b048437b521200123e010000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b000000000000000000415557560000000000000000000000000005f5db4488a7cae9f9a6c1938340c0fbf4beb9090200550031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c6879bc5a3617ec3444d93c06501cf6a0909c38d4ec81d96026b71ec475e87d69c7b5124289adbf24212bed8c15db354391d2378d2e0454d2655c6c34e7e50580fd8c94511322968bbc6da8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95005500944998273e477b495144fb8794c914197f3ccb46be2900f4698fd0ef743c9695a573a6ff665ff63edb5f9a85ad579dc14500a2112c09680fc146134f9a539ca82cb6e3501c801278fd08d80732a24118292866bb049e6e88181a1e1e8b6d3c6bbb95135a73041f3b56a8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_INCREASED_MINOR_VERSION: vector<u8> = x"504e4155010a000000a001000000000100496b7fbd18dca2f0e690712fd8ca522ff79ca7d9d6d22e9f5d753fba4bd16fff440a811bad710071c79859290bcb1700de49dd8400db90b048437b521200123e010000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b000000000000000000415557560000000000000000000000000005f5db4488a7cae9f9a6c1938340c0fbf4beb9090200550031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c6879bc5a3617ec3444d93c06501cf6a0909c38d4ec81d96026b71ec475e87d69c7b5124289adbf24212bed8c15db354391d2378d2e0454d2655c6c34e7e50580fd8c94511322968bbc6da8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95005500944998273e477b495144fb8794c914197f3ccb46be2900f4698fd0ef743c9695a573a6ff665ff63edb5f9a85ad579dc14500a2112c09680fc146134f9a539ca82cb6e3501c801278fd08d80732a24118292866bb049e6e88181a1e1e8b6d3c6bbb95135a73041f3b56a8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_EXTRA_PAYLOAD: vector<u8> = x"504e41550100000000a001000000000100b2d11f181d81b4ff10beca30091754b464dc48bc1f7432d114f64a7a8f660e7964f2a0c6121bae6c1977514d46ee7a29d9395b20a45f2086071715c1dc19ab74000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b000000000000000000415557560000000000000000000000000013f83cfdf63a5a1b3189182fa0a52e6de53ba7d002005d0031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c6879bc5a3617ec3444d93c06501cf6a0909c38d4ec81d96026b71ec475e87d69c7b5124289adbf24212bed8c15db354391d2378d2e000000000000000004a576f4a87f443f7d961a682f508c4f7b06ee1595a8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95005d00944998273e477b495144fb8794c914197f3ccb46be2900f4698fd0ef743c9695a573a6ff665ff63edb5f9a85ad579dc14500a2112c09680fc146134f9a539ca82cb6e3501c801278fd08d80732a24118292866bb0000000000000000045be67ba87a8dfbea404827ccbf07790299b6c023a8a1180177cf30b2c0bebbb1adfe8f7985d051d205a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";


    #[test_only]
    /// Allow anyone to update the cache with given updates. For testing purpose only.
    public fun update_cache_for_test(updates: vector<PriceInfo>) {
        pyth::update_cache(updates);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_get_update_fee(aptos_framework: &signer) {
        let single_update_fee = 50;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", vector[], 50, 0);

        // Pass in a single VAA
        assert!(pyth::get_update_fee(&vector[
            x"fb1543888001083cf2e6ef3afdcf827e89b11efd87c563638df6e1995ada9f93",
        ]) == single_update_fee, 1);

        // Pass in multiple VAAs
        assert!(pyth::get_update_fee(&vector[
            x"4ee17a1a4524118de513fddcf82b77454e51be5d6fc9e29fc72dd6c204c0e4fa",
            x"c72fdf81cfc939d4286c93fbaaae2eec7bae28a5926fa68646b43a279846ccc1",
            x"d9a8123a793529c31200339820a3210059ecace6c044f81ecad62936e47ca049",
            x"84e4f21b3e65cef47fda25d15b4eddda1edf720a1d062ccbf441d6396465fbe6",
            x"9e73f9041476a93701a0b9c7501422cc2aa55d16100bec628cf53e0281b6f72f"
        ]) == 250, 1);

        coin::destroy_zero(coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 6, location = wormhole::vaa)]
    fun test_update_price_feeds_corrupt_vaa(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", vector[], 50, 100);

        // Pass in a corrupt VAA, which should fail deseriaizing
        let corrupt_vaa = x"90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
        pyth::update_price_feeds(vector[corrupt_vaa], coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65539, location = pyth::pyth)]
    fun test_update_price_feeds_invalid_data_source(aptos_framework: &signer) {
        // Initialize the contract with some valid data sources, excluding our test VAA's source
        let data_sources = vector<DataSource>[
            data_source::new(
                4, external_address::from_bytes(x"0000000000000000000000000000000000000000000000000000000000007742")),
                data_source::new(
                5, external_address::from_bytes(x"0000000000000000000000000000000000000000000000000000000000007637"))
        ];
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources, 50, 100);

        pyth::update_price_feeds(TEST_VAAS, coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test_only]
    fun data_sources_for_test_vaa(): vector<DataSource> {
        // Set some valid data sources, including our test VAA's source
        vector<DataSource>[
            data_source::new(
                1, external_address::from_bytes(x"0000000000000000000000000000000000000000000000000000000000000004")),
            data_source::new(
                5, external_address::from_bytes(x"0000000000000000000000000000000000000000000000000000000000007637")),
            data_source::new(
                17, external_address::from_bytes(x"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b")),
            data_source::new(
                1, external_address::from_bytes(x"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b")),
        ]
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65542, location = pyth::pyth)]
    fun test_update_price_feeds_insufficient_fee(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1,
            x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92",
            data_sources_for_test_vaa(),
            // Update fee
            50,
            // Coins provided to update < update fee
            20);

        pyth::update_price_feeds(TEST_VAAS, coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_update_price_feeds_success(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 100);

        // Update the price feeds from the VAA
        pyth::update_price_feeds(TEST_VAAS, coins);

        // Check that the cache has been updated
        let expected = get_mock_price_infos();
        check_price_feeds_cached(&expected);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test_only]
    fun setup_accumulator_test(
        aptos_framework: &signer,
        data_sources: vector<DataSource>,
        to_mint: u64
    ): (BurnCapability<AptosCoin>, MintCapability<AptosCoin>, Coin<AptosCoin>) {
        let aptos_framework_account = std::account::create_account_for_test(@aptos_framework);
        std::timestamp::set_time_has_started_for_testing(&aptos_framework_account);
        wormhole::init_test(
            22,
            1,
            x"0000000000000000000000000000000000000000000000000000000000000004",
            x"7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
            100000
        );

        // Set the current time
        timestamp::update_global_time_for_test_secs(1687276659);

        // Deploy and initialize a test instance of the Pyth contract
        let deployer = account::create_signer_with_capability(
            &account::create_test_signer_cap(@0x277fa055b6a73c42c0662d5236c65c864ccbf2d4abd21f174a30c8b786eab84b)
        );
        let (_pyth, signer_capability) = account::create_resource_account(&deployer, b"pyth");
        pyth::init_test(signer_capability,
            500,
            1,
            x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92",
            data_sources,
            50);

        let (burn_capability, mint_capability) = aptos_coin::initialize_for_test(aptos_framework);
        let coins = coin::mint(to_mint, &mint_capability);
        (burn_capability, mint_capability, coins)
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_update_price(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            50
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR], coins);

        let expected = vector<PriceInfo>[
            price_info::new(
                1663680747,
                1663074349,
                price_feed::new(
                    price_identifier::from_byte_vec(
                        x"b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6"
                    ),
                    price::new(
                        i64::new(6887568746747646632, false),
                        13092246197863718329,
                        i64::new(1559537863, false),
                        1687276661
                    ),
                    price::new(
                        i64::new(4772242609775910581, false),
                        358129956189946877,
                        i64::new(1559537863, false),
                        1687276661
                    ),
                ),
            )];
        check_price_feeds_cached(&expected);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test_only]
    fun check_accumulator_test_price_feeds(offset: u64) {
        let i = 0;
        let feed_ids = vector[x"b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
            x"6e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af",
            x"31ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c68"];
        let expected: vector<PriceInfo> = vector[];
        while (i < 3) {
            vector::push_back(&mut expected, price_info::new(
                1663680747,
                1663074349,
                price_feed::new(
                    price_identifier::from_byte_vec(
                        *vector::borrow(&feed_ids, i)
                    ),
                    price::new(
                        i64::new(100 + i + offset, false),
                        50 + i + offset,
                        i64::new(9 + i + offset, false),
                        1687276660 + i + offset
                    ),
                    price::new(
                        i64::new(99 + i + offset, false),
                        52 + i + offset,
                        i64::new(9 + i + offset, false),
                        1687276660 + i + offset
                    ),
                ),
            ));
            i = i + 1;
        };
        check_price_feeds_cached(&expected);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65542, location = pyth::pyth)]
    fun test_accumulator_update_price_feeds_insufficient_fee(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            149
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS], coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_update_price_multi_feed(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            150
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS], coins);
        check_accumulator_test_price_feeds(0);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_update_price_out_of_order(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            300
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS_LATER, TEST_ACCUMULATOR_3_MSGS], coins);
        check_accumulator_test_price_feeds(10);

        // we pass the old message again in a separate call to make sure it will not overwrite the recent values in neither case
        let coins_second_call = coin::mint(150, &mint_capability);
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS], coins_second_call);
        check_accumulator_test_price_feeds(10);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_update_price_multi_msg(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            150
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS], coins);
        check_accumulator_test_price_feeds(0);
        let coins_second_call = coin::mint(150, &mint_capability);
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_3_MSGS_LATER], coins_second_call);
        check_accumulator_test_price_feeds(10);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65562, location = pyth::pyth)]
    fun test_accumulator_invalid_payload(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );
        pyth::update_price_feeds(vector[x"504e415500000000"], coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65563, location = pyth::pyth)]
    fun test_accumulator_invalid_accumulator_message(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_INVALID_ACC_MSG], coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65564, location = pyth::pyth)]
    fun test_accumulator_invalid_wormhole_message(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_INVALID_WH_MSG], coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65562, location = pyth::pyth)]
    fun test_accumulator_invalid_major_version(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_INVALID_MAJOR_VERSION], coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_forward_compatibility(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );

        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_INCREASED_MINOR_VERSION], coins);
        let coins_second_call = coin::mint(100, &mint_capability);
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_EXTRA_PAYLOAD], coins_second_call);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65539, location = pyth::pyth)]
    fun test_accumulator_invalid_data_source(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(aptos_framework, vector[data_source::new(
            2, // correct emitter chain is 1
            external_address::from_bytes(x"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b")
        )], 100);
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR], coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_accumulator_update_fee(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            0
        );
        let single_update_fee = 50;
        assert!(pyth::get_update_fee(&vector[
            TEST_ACCUMULATOR,
        ]) == single_update_fee, 1);

        assert!(pyth::get_update_fee(&vector[
            TEST_ACCUMULATOR,
            TEST_ACCUMULATOR,
        ]) == single_update_fee * 2, 1);

        assert!(pyth::get_update_fee(&vector[
            TEST_ACCUMULATOR,
            TEST_ACCUMULATOR_3_MSGS,
        ]) == single_update_fee * 4, 1);

        assert!(pyth::get_update_fee(&vector[
            TEST_ACCUMULATOR,
            TEST_ACCUMULATOR_3_MSGS,
            x"deaddeaddead", // random non-accumulator data
        ]) == single_update_fee * 5, 1);

        coin::destroy_zero(coins);
        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65565, location = pyth::pyth)]
    fun test_accumulator_invalid_proof(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_accumulator_test(
            aptos_framework,
            data_sources_for_test_vaa(),
            100
        );
        pyth::update_price_feeds(vector[TEST_ACCUMULATOR_INVALID_PROOF_1], coins);
        cleanup_test(burn_capability, mint_capability);
    }


    #[test(aptos_framework = @aptos_framework)]
    fun test_update_price_feeds_with_funder(aptos_framework: &signer) {
        let update_fee = 50;
        let initial_balance = 75;
        let (burn_capability, mint_capability, coins) = setup_test(
            aptos_framework,
            500,
            23,
            x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92",
            data_sources_for_test_vaa(),
            update_fee,
            initial_balance
        );

        // Create a test funder account and register it to store funds
        let funder_addr = @0xbfbffd8e2af9a3e3ce20d2d2b22bd640;
        let funder = account::create_account_for_test(funder_addr);
        coin::register<AptosCoin>(&funder);
        coin::deposit(funder_addr, coins);

        assert!(pyth::get_update_fee(&TEST_VAAS) == update_fee, 1);
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance, 1);
        assert!(coin::balance<AptosCoin>(@pyth) == 0, 1);

        // Update the price feeds using the funder
        pyth::update_price_feeds_with_funder(&funder, TEST_VAAS);

        // Check that the price feeds are now cached
        check_price_feeds_cached(&get_mock_price_infos());

        // Check that the funder's balance has decreased by the update_fee amount
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance - pyth::get_update_fee(&TEST_VAAS), 1);

        // Check that the amount has been transferred to the Pyth contract
        assert!(coin::balance<AptosCoin>(@pyth) == pyth::get_update_fee(&TEST_VAAS), 1);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65542, location = aptos_framework::coin)]
    fun test_update_price_feeds_with_funder_insufficient_balance(aptos_framework: &signer) {
        let update_fee = 50;
        let initial_balance = 25;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), update_fee, initial_balance);

        // Create a test funder account and register it to store funds
        let funder_addr = @0xbfbffd8e2af9a3e3ce20d2d2b22bd640;
        let funder = account::create_account_for_test(funder_addr);
        coin::register<AptosCoin>(&funder);
        coin::deposit(funder_addr, coins);

        assert!(pyth::get_update_fee(&TEST_VAAS) == update_fee, 1);
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance, 1);
        assert!(coin::balance<AptosCoin>(@pyth) == 0, 1);

        // Update the price feeds using the funder
        pyth::update_price_feeds_with_funder(&funder, TEST_VAAS);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test_only]
    fun check_price_feeds_cached(expected: &vector<PriceInfo>) {

        // Check that we can retrieve the correct current price and ema price for each price feed
        let i = 0;
        while (i < vector::length(expected)) {
            let price_feed = price_info::get_price_feed(vector::borrow(expected, i));
            let price = price_feed::get_price(price_feed);

            let price_identifier = *price_feed::get_price_identifier(price_feed);
            assert!(pyth::price_feed_exists(price_identifier), 1);
            let cached_price = pyth::get_price(price_identifier);

            assert!(cached_price == price, 1);

            let ema_price = price_feed::get_ema_price(price_feed);
            let cached_ema_price = pyth::get_ema_price(price_identifier);

            assert!(cached_ema_price == ema_price, 1);

            i = i + 1;
        };

    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_update_cache(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 0);

        let updates = get_mock_price_infos();

        // Check that initially the price feeds are not cached
        let i = 0;
        while (i < vector::length(&updates)) {
            let price_feed = price_info::get_price_feed(vector::borrow(&updates, i));
            assert!(!pyth::price_feed_exists(*price_feed::get_price_identifier(price_feed)), 1);
            i = i + 1;
        };

        // Submit the updates
        pyth::update_cache(updates);

        // Check that the price feeds are now cached
        check_price_feeds_cached(&updates);

        cleanup_test(burn_capability, mint_capability);
        coin::destroy_zero(coins);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_update_cache_old_update(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 1000, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 0);

        // Submit a price update
        let timestamp = 1663680700;
        let price_identifier = price_identifier::from_byte_vec(x"baa284eaf23edf975b371ba2818772f93dbae72836bbdea28b07d40f3cf8b485");
        let price = price::new(i64::new(7648, false), 674, i64::new(8, true), timestamp);
        let ema_price = price::new(i64::new(1536, true), 869, i64::new(100, false), timestamp);
        let update = price_info::new(
            1257278600,
            1690226180,
            price_feed::new(
                    price_identifier,
                    price,
                    ema_price,
            )
        );
        pyth::update_cache(vector<PriceInfo>[update]);

        // Check that we can retrieve the current price
        assert!(pyth::get_price(price_identifier) == price, 1);

        // Attempt to update the price with an update older than the current cached one
        let old_price = price::new(i64::new(1243, true), 9802, i64::new(6, false), timestamp - 200);
        let old_ema_price = price::new(i64::new(8976, true), 234, i64::new(897, false), timestamp - 200);
        let old_update = price_info::new(
            1257278600,
            1690226180,
            price_feed::new(
                    price_identifier,
                    old_price,
                    old_ema_price,
            )
        );
        pyth::update_cache(vector<PriceInfo>[old_update]);

        // Confirm that the current price and ema price didn't change
        assert!(pyth::get_price(price_identifier) == price, 1);
        assert!(pyth::get_ema_price(price_identifier) == ema_price, 1);

        // Update the cache with a fresh update
        let fresh_price = price::new(i64::new(4857, true), 9979, i64::new(243, false), timestamp + 200);
        let fresh_ema_price = price::new(i64::new(74637, false), 9979, i64::new(1433, false), timestamp + 1);
        let fresh_update = price_info::new(
            1257278600,
            1690226180,
            price_feed::new(
                    price_identifier,
                    fresh_price,
                    fresh_ema_price,
            )
        );
        pyth::update_cache(vector<PriceInfo>[fresh_update]);

        // Confirm that the current price was updated
        assert!(pyth::get_price(price_identifier) == fresh_price, 1);
        assert!(pyth::get_ema_price(price_identifier) == fresh_ema_price, 1);

        cleanup_test(burn_capability, mint_capability);
        coin::destroy_zero(coins);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 524292, location = pyth::pyth)]
    fun test_stale_price_threshold_exceeded(aptos_framework: &signer) {
        let stale_price_threshold = 500;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, stale_price_threshold, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 0);

        // Submit a price update
        let current_timestamp = timestamp::now_seconds();
        let price_identifier = price_identifier::from_byte_vec(x"baa284eaf23edf975b371ba2818772f93dbae72836bbdea28b07d40f3cf8b485");
        let price = price::new(i64::new(7648, false), 674, i64::new(8, true), current_timestamp);
        let update = price_info::new(
            1257278600,
            1690226180,
            price_feed::new(
                    price_identifier,
                    price,
                    price::new(i64::new(1536, true), 869, i64::new(100, false), 1257212500),
            )
        );
        pyth::update_cache(vector<PriceInfo>[update]);
        assert!(pyth::get_price(price_identifier) == price, 1);

        // Now advance the clock on the target chain, until the age of the cached update exceeds the
        // stale_price_threshold.
        timestamp::update_global_time_for_test_secs(current_timestamp + stale_price_threshold);

        // Check that we can access the price if we increase the threshold by 1
        assert!(pyth::get_price_no_older_than(
            price_identifier, pyth::get_stale_price_threshold_secs() + 1) == price, 1);

        // However, retrieving the latest price fails
        assert!(pyth::get_price(price_identifier) == price, 1);

        cleanup_test(burn_capability, mint_capability);
        coin::destroy_zero(coins);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 524292, location = pyth::pyth)]
    fun test_stale_price_threshold_exceeded_ema(aptos_framework: &signer) {
        let stale_price_threshold = 500;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, stale_price_threshold, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 0);

        // Submit a price update
        let current_timestamp = timestamp::now_seconds();
        let price_identifier = price_identifier::from_byte_vec(x"baa284eaf23edf975b371ba2818772f93dbae72836bbdea28b07d40f3cf8b485");
        let ema_price = price::new(i64::new(1536, true), 869, i64::new(100, false), current_timestamp);
        let update = price_info::new(
            1257278600,
            1690226180,
            price_feed::new(
                    price_identifier,
                    price::new(i64::new(7648, false), 674, i64::new(8, true), 1257212500),
                    ema_price,
            )
        );
        pyth::update_cache(vector<PriceInfo>[update]);

        // Check that the EMA price has been updated
        assert!(pyth::get_ema_price(price_identifier) == ema_price, 1);

        // Now advance the clock on the target chain, until the age of the cached update exceeds the
        // stale_price_threshold.
        timestamp::update_global_time_for_test_secs(current_timestamp + stale_price_threshold);

        // Check that we can access the EMA price if we increase the threshold by 1
        assert!(pyth::get_ema_price_no_older_than(
            price_identifier, pyth::get_stale_price_threshold_secs() + 1) == ema_price, 1);

        // However, retrieving the latest EMA price fails
        assert!(pyth::get_ema_price(price_identifier) == ema_price, 1);

        cleanup_test(burn_capability, mint_capability);
        coin::destroy_zero(coins);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 65541, location = pyth::pyth)]
    fun test_update_price_feeds_if_fresh_invalid_length(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 0);

        // Update the price feeds
        let bytes = vector[vector[0u8, 1u8, 2u8]];
        let price_identifiers = vector[
            x"baa284eaf23edf975b371ba2818772f93dbae72836bbdea28b07d40f3cf8b485",
            x"c9d5fe0d836688f4c88c221415d23e4bcabee21a6a21124bfcc9a5410a297818",
            x"eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        ];
        let publish_times = vector[
            734639463
        ];
        pyth::update_price_feeds_if_fresh(bytes, price_identifiers, publish_times, coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_update_price_feeds_if_fresh_fresh_data(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 50);

        // Update the price feeds
        let bytes = TEST_VAAS;
        let price_identifiers = vector[
            x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1",
            x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe",
            x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d",
            x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8",
        ];
        let publish_times = vector[
            1663680745, 1663680730, 1663680760, 1663680720
        ];
        pyth::update_price_feeds_if_fresh(bytes, price_identifiers, publish_times, coins);

        // Check that the cache has been updated
        let expected = get_mock_price_infos();
        check_price_feeds_cached(&expected);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_update_price_feeds_if_fresh_with_funder_fresh_data(aptos_framework: &signer) {
        let update_fee = 50;
        let initial_balance = 75;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), update_fee, initial_balance);

        // Create a test funder account and register it to store funds
        let funder_addr = @0xbfbffd8e2af9a3e3ce20d2d2b22bd640;
        let funder = account::create_account_for_test(funder_addr);
        coin::register<AptosCoin>(&funder);
        coin::deposit(funder_addr, coins);

        assert!(pyth::get_update_fee(&TEST_VAAS) == update_fee, 1);
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance, 1);
        assert!(coin::balance<AptosCoin>(@pyth) == 0, 1);

        // Update the price feeds using the funder
        let bytes = TEST_VAAS;
        let price_identifiers = vector[
            x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1",
            x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe",
            x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d",
            x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8",
        ];
        let publish_times = vector[
            1663680790, 1663680730, 1663680760, 1663680720
        ];
        pyth::update_price_feeds_if_fresh_with_funder(&funder, bytes, price_identifiers, publish_times);

        // Check that the price feeds are now cached
        check_price_feeds_cached(&get_mock_price_infos());

        // Check that the funder's balance has decreased by the update_fee amount
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance - pyth::get_update_fee(&TEST_VAAS), 1);

        // Check that the amount has been transferred to the Pyth contract
        assert!(coin::balance<AptosCoin>(@pyth) == pyth::get_update_fee(&TEST_VAAS), 1);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 524295, location = pyth::pyth)]
    fun test_update_price_feeds_if_fresh_stale_data(aptos_framework: &signer) {
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 1, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), 50, 50);

        // First populate the cache
        pyth::update_cache(get_mock_price_infos());

        // Now attempt to update the price feeds with publish_times that are older than those we have cached
        // This should abort with error::no_fresh_data()
        let bytes = TEST_VAAS;
        let price_identifiers = vector[
            x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1",
            x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe",
            x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d",
            x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8",
        ];
        let publish_times = vector[
            67, 35, 26, 64
        ];
        pyth::update_price_feeds_if_fresh(bytes, price_identifiers, publish_times, coins);

        cleanup_test(burn_capability, mint_capability);
    }

    #[test(aptos_framework = @aptos_framework)]
    #[expected_failure(abort_code = 524295, location = pyth::pyth)]
    fun test_update_price_feeds_if_fresh_with_funder_stale_data(aptos_framework: &signer) {
        let update_fee = 50;
        let initial_balance = 75;
        let (burn_capability, mint_capability, coins) = setup_test(aptos_framework, 500, 23, x"5d1f252d5de865279b00c84bce362774c2804294ed53299bc4a0389a5defef92", data_sources_for_test_vaa(), update_fee, initial_balance);

        // Create a test funder account and register it to store funds
        let funder_addr = @0xbfbffd8e2af9a3e3ce20d2d2b22bd640;
        let funder = account::create_account_for_test(funder_addr);
        coin::register<AptosCoin>(&funder);
        coin::deposit(funder_addr, coins);

        assert!(pyth::get_update_fee(&TEST_VAAS) == update_fee, 1);
        assert!(coin::balance<AptosCoin>(signer::address_of(&funder)) == initial_balance, 1);
        assert!(coin::balance<AptosCoin>(@pyth) == 0, 1);

        // First populate the cache
        pyth::update_cache(get_mock_price_infos());

        // Now attempt to update the price feeds with publish_times that are older than those we have cached
        // This should abort with error::no_fresh_data()
        let bytes = TEST_VAAS;
        let price_identifiers = vector[
            x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1",
            x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe",
            x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d",
            x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8",
        ];
        let publish_times = vector[
            100, 76, 29, 64
        ];
        pyth::update_price_feeds_if_fresh_with_funder(&funder, bytes, price_identifiers, publish_times);

        cleanup_test(burn_capability, mint_capability);
    }
}
