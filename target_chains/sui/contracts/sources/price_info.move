module pyth::price_info {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{TxContext};
    use sui::dynamic_object_field::{Self};
    use sui::table::{Self};

    use pyth::price_feed::{Self, PriceFeed};
    use pyth::price_identifier::{PriceIdentifier};

    const KEY: vector<u8> = b"price_info";

    friend pyth::pyth;

    /// Sui Object version of PriceInfo.
    /// Has a key and lives in global store.
    struct PriceInfoObject has key, store {
        id: UID,
        price_info: PriceInfo
    }

    /// Copyable and droppable.
    struct PriceInfo has copy, drop, store {
        attestation_time: u64,
        arrival_time: u64,
        price_feed: PriceFeed,
    }

    /// Creates a table which maps a PriceIdentifier to the
    /// UID (in bytes) of the corresponding Sui PriceInfoObject.
    public fun new_price_info_registry(parent_id: &mut UID, ctx: &mut TxContext) {
        assert!(
            !dynamic_object_field::exists_(parent_id, KEY),
            0 // TODO - add custom error message
        );
        dynamic_object_field::add(
            parent_id,
            KEY,
            table::new<PriceIdentifier, ID>(ctx)
        )
    }

    public fun add(parent_id: &mut UID, price_identifier: PriceIdentifier, id: ID) {
        assert!(
            !contains(parent_id, price_identifier),
            0 // TODO - add custom error message
        );
        table::add(
            dynamic_object_field::borrow_mut(parent_id, KEY),
            price_identifier,
            id
        )
    }

    public fun contains(parent_id: &UID, price_identifier: PriceIdentifier): bool {
        let ref = dynamic_object_field::borrow(parent_id, KEY);
        table::contains<PriceIdentifier, ID>(ref, price_identifier)
    }

    public fun new_price_info_object(
        price_info: PriceInfo,
        ctx: &mut TxContext
    ): PriceInfoObject {
        PriceInfoObject {
            id: object::new(ctx),
            price_info: price_info
        }
    }

    public fun new_price_info(
        attestation_time: u64,
        arrival_time: u64,
        price_feed: PriceFeed,
    ): PriceInfo {
        PriceInfo {
            attestation_time: attestation_time,
            arrival_time: arrival_time,
            price_feed: price_feed,
        }
    }

    #[test_only]
    public fun destroy(price_info: PriceInfoObject){
        let PriceInfoObject {
            id: id,
            price_info: _,
        } = price_info;
        object::delete(id);
    }

    public fun uid_to_inner(price_info: &PriceInfoObject): ID {
        object::uid_to_inner(&price_info.id)
    }

    public fun get_price_info_from_price_info_object(price_info: &PriceInfoObject): PriceInfo {
        price_info.price_info
    }

    public fun get_price_identifier(price_info: &PriceInfo): PriceIdentifier {
        price_feed::get_price_identifier(&price_info.price_feed)
    }

    public fun get_price_feed(price_info: &PriceInfo): &PriceFeed {
        &price_info.price_feed
    }

    public fun get_attestation_time(price_info: &PriceInfo): u64 {
        price_info.attestation_time
    }

    public fun get_arrival_time(price_info: &PriceInfo): u64 {
        price_info.arrival_time
    }

    public(friend) fun update_price_info_object(
        price_info_object: &mut PriceInfoObject,
        price_info: PriceInfo
    ) {
        price_info_object.price_info = price_info;
    }
}
