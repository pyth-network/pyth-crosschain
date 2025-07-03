module pyth::pyth;

use pyth::accumulator;
use pyth::batch_price_attestation;
use pyth::data_source::{Self, DataSource};
use pyth::event as pyth_event;
use pyth::hot_potato_vector::{Self, HotPotatoVector};
use pyth::price::{Self, Price};
use pyth::price_feed;
use pyth::price_identifier::PriceIdentifier;
use pyth::price_info::{Self, PriceInfo, PriceInfoObject};
use pyth::setup::{Self, DeployerCap};
use pyth::state::{Self as state, State as PythState, LatestOnly};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::package::UpgradeCap;
use sui::sui::SUI;
use wormhole::bytes32;
use wormhole::cursor;
use wormhole::external_address;
use wormhole::vaa::{Self, VAA};

const EDataSourceEmitterAddressAndChainIdsDifferentLengths: u64 = 0;
const EInvalidDataSource: u64 = 1;
const EInsufficientFee: u64 = 2;
const EStalePriceUpdate: u64 = 3;
const EUpdateAndPriceInfoObjectMismatch: u64 = 4;
const EPriceUpdateNotFoundForPriceInfoObject: u64 = 5;

/* #[test_only] */
/* friend pyth::pyth_tests; */

/// Init state and emit event corresponding to Pyth initialization.
public entry fun init_pyth(
    deployer: DeployerCap,
    upgrade_cap: UpgradeCap,
    stale_price_threshold: u64,
    governance_emitter_chain_id: u64,
    governance_emitter_address: vector<u8>,
    data_sources_emitter_chain_ids: vector<u64>,
    data_sources_emitter_addresses: vector<vector<u8>>,
    update_fee: u64,
    ctx: &mut TxContext,
) {
    setup::init_and_share_state(
        deployer,
        upgrade_cap,
        stale_price_threshold,
        update_fee,
        data_source::new(
            governance_emitter_chain_id,
            external_address::new((bytes32::from_bytes(governance_emitter_address))),
        ),
        parse_data_sources(
            data_sources_emitter_chain_ids,
            data_sources_emitter_addresses,
        ),
        ctx,
    );

    // Emit Pyth initialization event.
    pyth_event::emit_pyth_initialization_event();
}

fun parse_data_sources(
    emitter_chain_ids: vector<u64>,
    emitter_addresses: vector<vector<u8>>,
): vector<DataSource> {
    assert!(
        vector::length(&emitter_chain_ids) == vector::length(&emitter_addresses),
        EDataSourceEmitterAddressAndChainIdsDifferentLengths,
    );

    let mut sources = vector::empty();
    let mut i = 0;
    while (i < vector::length(&emitter_chain_ids)) {
        vector::push_back(
            &mut sources,
            data_source::new(
                *vector::borrow(&emitter_chain_ids, i),
                external_address::new(
                    bytes32::from_bytes(*vector::borrow(&emitter_addresses, i)),
                ),
            ),
        );

        i = i + 1;
    };
    sources
}

/// Create and share new price feed objects if they don't already exist using accumulator message.
public fun create_price_feeds_using_accumulator(
    pyth_state: &mut PythState,
    accumulator_message: vector<u8>,
    vaa: VAA, // the verified version of the vaa bytes encoded within the accumulator_message
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // This capability ensures that the current build version is used.
    let latest_only = state::assert_latest_only(pyth_state);

    // Check that the VAA is from a valid data source (emitter)
    assert!(
        state::is_valid_data_source(
            pyth_state,
            data_source::new(
                (vaa::emitter_chain(&vaa) as u64),
                vaa::emitter_address(&vaa),
            ),
        ),
        EInvalidDataSource,
    );

    // decode the price info updates from the VAA payload (first check if it is an accumulator or batch price update)
    let mut accumulator_message_cursor = cursor::new(accumulator_message);
    let price_infos = accumulator::parse_and_verify_accumulator_message(
        &mut accumulator_message_cursor,
        vaa::take_payload(vaa),
        clock,
    );

    // Create and share new price info objects, if not already exists.
    create_and_share_price_feeds_using_verified_price_infos(
        &latest_only,
        pyth_state,
        price_infos,
        ctx,
    );

    // destroy rest of cursor
    cursor::take_rest(accumulator_message_cursor);
}

/// Create and share new price feed objects if they don't already exist using batch price attestation.
/// The name of the function is kept as is to remain backward compatible
public fun create_price_feeds(
    pyth_state: &mut PythState,
    // These vaas have been verified and consumed, so we don't have to worry about
    // doing replay protection for them.
    mut verified_vaas: vector<VAA>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // This capability ensures that the current build version is used.
    let latest_only = state::assert_latest_only(pyth_state);

    while (!vector::is_empty(&verified_vaas)) {
        let vaa = vector::pop_back(&mut verified_vaas);

        // Check that the VAA is from a valid data source (emitter)
        assert!(
            state::is_valid_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&vaa) as u64),
                    vaa::emitter_address(&vaa),
                ),
            ),
            EInvalidDataSource,
        );

        // Deserialize the batch price attestation
        let price_infos = batch_price_attestation::destroy(
            batch_price_attestation::deserialize(vaa::take_payload(vaa), clock),
        );

        // Create and share new price info objects, if not already exists.
        create_and_share_price_feeds_using_verified_price_infos(
            &latest_only,
            pyth_state,
            price_infos,
            ctx,
        );
    };
    vector::destroy_empty(verified_vaas);
}

#[allow(lint(share_owned))]
// create_and_share_price_feeds_using_verified_price_infos is a private function used by
// 1) create_price_feeds
// 2) create_price_feeds_using_accumulator
// to create new price feeds for symbols.
fun create_and_share_price_feeds_using_verified_price_infos(
    latest_only: &LatestOnly,
    pyth_state: &mut PythState,
    mut price_infos: vector<PriceInfo>,
    ctx: &mut TxContext,
) {
    while (!vector::is_empty(&price_infos)) {
        let cur_price_info = vector::pop_back(&mut price_infos);

        // Only create new Sui PriceInfoObject if not already
        // registered with the Pyth State object.
        if (
            !state::price_feed_object_exists(
                pyth_state,
                price_feed::get_price_identifier(
                    price_info::get_price_feed(&cur_price_info),
                ),
            )
        ) {
            // Create and share newly created Sui PriceInfoObject containing a price feed,
            // and then register a copy of its ID with State.
            let new_price_info_object = price_info::new_price_info_object(cur_price_info, ctx);
            let price_identifier = price_info::get_price_identifier(&cur_price_info);
            let id = price_info::uid_to_inner(&new_price_info_object);

            state::register_price_info_object(latest_only, pyth_state, price_identifier, id);

            transfer::public_share_object(new_price_info_object);
        }
    }
}

// verified_vaa is the verified version of the VAA encoded within the accumulator_message
public fun create_authenticated_price_infos_using_accumulator(
    pyth_state: &PythState,
    accumulator_message: vector<u8>,
    verified_vaa: VAA,
    clock: &Clock,
): HotPotatoVector<PriceInfo> {
    state::assert_latest_only(pyth_state);

    // verify that the VAA originates from a valid data source
    assert!(
        state::is_valid_data_source(
            pyth_state,
            data_source::new(
                (vaa::emitter_chain(&verified_vaa) as u64),
                vaa::emitter_address(&verified_vaa),
            ),
        ),
        EInvalidDataSource,
    );

    // decode the price info updates from the VAA payload (first check if it is an accumulator or batch price update)
    let mut accumulator_message_cursor = cursor::new(accumulator_message);
    let price_infos = accumulator::parse_and_verify_accumulator_message(
        &mut accumulator_message_cursor,
        vaa::take_payload(verified_vaa),
        clock,
    );

    // check that accumulator message has been fully consumed
    cursor::destroy_empty(accumulator_message_cursor);
    hot_potato_vector::new(price_infos)
}

/// Creates authenticated price infos using batch price attestation
/// Name is kept as is to remain backward compatible
public fun create_price_infos_hot_potato(
    pyth_state: &PythState,
    mut verified_vaas: vector<VAA>,
    clock: &Clock,
): HotPotatoVector<PriceInfo> {
    state::assert_latest_only(pyth_state);

    let mut price_updates = vector::empty<PriceInfo>();
    while (vector::length(&verified_vaas) != 0) {
        let cur_vaa = vector::pop_back(&mut verified_vaas);

        assert!(
            state::is_valid_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&cur_vaa) as u64),
                    vaa::emitter_address(&cur_vaa),
                ),
            ),
            EInvalidDataSource,
        );
        let mut price_infos = batch_price_attestation::destroy(
            batch_price_attestation::deserialize(vaa::take_payload(cur_vaa), clock),
        );
        while (vector::length(&price_infos) !=0) {
            let cur_price_info = vector::pop_back(&mut price_infos);
            vector::push_back(&mut price_updates, cur_price_info);
        }
    };
    vector::destroy_empty(verified_vaas);
    return hot_potato_vector::new(price_updates)
}

/// Update a singular Pyth PriceInfoObject (containing a price feed) with the
/// price data in the authenticated price infos vector (a vector of PriceInfo objects).
///
/// For more information on the end-to-end process for updating a price feed, please see the README.
///
/// The given fee must contain a sufficient number of coins to pay the update fee for the given vaas.
/// The update fee amount can be queried by calling get_update_fee(&vaas).
///
/// Please read more information about the update fee here: https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees
public fun update_single_price_feed(
    pyth_state: &PythState,
    price_updates: HotPotatoVector<PriceInfo>,
    price_info_object: &mut PriceInfoObject,
    fee: Coin<SUI>,
    clock: &Clock,
): HotPotatoVector<PriceInfo> {
    let latest_only = state::assert_latest_only(pyth_state);

    // On Sui, users get to choose which price feeds to update. They specify a single price feed to
    // update at a time. We therefore charge the base fee for each such individual update.
    // This is a departure from Eth, where users don't get to necessarily choose.
    assert!(state::get_base_update_fee(pyth_state) <= coin::value(&fee), EInsufficientFee);

    // store fee coins within price info object
    price_info::deposit_fee_coins(price_info_object, fee);

    // Find price update corresponding to PriceInfoObject within the array of price_updates
    // and use it to update PriceInfoObject.
    let mut i = 0;
    let mut found = false;
    while (i < hot_potato_vector::length<PriceInfo>(&price_updates)) {
        let cur_price_info = hot_potato_vector::borrow<PriceInfo>(&price_updates, i);
        if (has_same_price_identifier(cur_price_info, price_info_object)) {
            found = true;
            update_cache(latest_only, cur_price_info, price_info_object, clock);
            break
        };
        i = i + 1;
    };
    assert!(found, EPriceUpdateNotFoundForPriceInfoObject);
    price_updates
}

fun has_same_price_identifier(price_info: &PriceInfo, price_info_object: &PriceInfoObject): bool {
    let price_info_from_object = price_info::get_price_info_from_price_info_object(
        price_info_object,
    );
    let price_identifier_from_object = price_info::get_price_identifier(
        &price_info_from_object,
    );
    let price_identifier_from_price_info = price_info::get_price_identifier(price_info);
    price_identifier_from_object == price_identifier_from_price_info
}

/// Update PriceInfoObject with updated data from a PriceInfo
public(package) fun update_cache(
    _: LatestOnly,
    update: &PriceInfo,
    price_info_object: &mut PriceInfoObject,
    clock: &Clock,
) {
    let has_same_price_identifier = has_same_price_identifier(update, price_info_object);
    assert!(has_same_price_identifier, EUpdateAndPriceInfoObjectMismatch);

    // Update the price info object with the new updated price info.
    if (is_fresh_update(update, price_info_object)) {
        pyth_event::emit_price_feed_update(
            price_feed::from(price_info::get_price_feed(update)),
            clock::timestamp_ms(clock)/1000,
        );
        price_info::update_price_info_object(
            price_info_object,
            update,
        );
    }
}

/// Determine if the given price update is "fresh": we have nothing newer already cached for that
/// price feed within a PriceInfoObject.
fun is_fresh_update(update: &PriceInfo, price_info_object: &PriceInfoObject): bool {
    // Get the timestamp of the update's current price
    let price_feed = price_info::get_price_feed(update);
    let update_timestamp = price::get_timestamp(&price_feed::get_price(price_feed));

    // Get the timestamp of the cached data for the price identifier
    let cached_price_info = price_info::get_price_info_from_price_info_object(
        price_info_object,
    );
    let cached_price_feed = price_info::get_price_feed(&cached_price_info);
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
/// Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for
/// how to how this price safely.
///
/// Important: Pyth uses an on-demand update model, where consumers need to update the
/// cached prices before using them. Please read more about this at https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand.
/// get_price() is likely to abort unless you call update_price_feeds() to update the cached price
/// beforehand, as the cached prices may be older than the stale price threshold.
///
/// The price_info_object is a Sui object with the key ability that uniquely
/// contains a price feed for a given price_identifier.
///
public fun get_price(state: &PythState, price_info_object: &PriceInfoObject, clock: &Clock): Price {
    get_price_no_older_than(
        price_info_object,
        clock,
        state::get_stale_price_threshold_secs(state),
    )
}

/// Get the latest available price cached for the given price identifier, if that price is
/// no older than the given age.
public fun get_price_no_older_than(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_age_secs: u64,
): Price {
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
        price_info::get_price_feed(&price_info),
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
    assert!(age < max_age_secs, EStalePriceUpdate);
}

/// Please read more information about the update fee here: https://docs.pyth.network/documentation/pythnet-price-feeds/on-demand#fees
public fun get_total_update_fee(pyth_state: &PythState, n: u64): u64 {
    state::get_base_update_fee(pyth_state) * n
}
