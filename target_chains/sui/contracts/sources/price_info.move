module pyth::price_info {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{TxContext};
    use sui::dynamic_object_field::{Self};
    use sui::table::{Self};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    use pyth::price_feed::{Self, PriceFeed};
    use pyth::price_identifier::{PriceIdentifier};

    const KEY: vector<u8> = b"price_info";
    const FEE_STORAGE_KEY: vector<u8> = b"fee_storage";
    const E_PRICE_INFO_REGISTRY_ALREADY_EXISTS: u64 = 0;
    const E_PRICE_IDENTIFIER_ALREADY_REGISTERED: u64 = 1;
    const E_PRICE_IDENTIFIER_NOT_REGISTERED: u64 = 2;

    friend pyth::pyth;
    friend pyth::state;

    /// Sui object version of PriceInfo.
    /// Has a key ability, is unique for each price identifier, and lives in global store.
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
    public(friend) fun new_price_info_registry(parent_id: &mut UID, ctx: &mut TxContext) {
        assert!(
            !dynamic_object_field::exists_(parent_id, KEY),
            E_PRICE_INFO_REGISTRY_ALREADY_EXISTS
        );
        dynamic_object_field::add(
            parent_id,
            KEY,
            table::new<PriceIdentifier, ID>(ctx)
        )
    }

    public(friend) fun add(parent_id: &mut UID, price_identifier: PriceIdentifier, id: ID) {
        assert!(
            !contains(parent_id, price_identifier),
            E_PRICE_IDENTIFIER_ALREADY_REGISTERED
        );
        table::add(
            dynamic_object_field::borrow_mut(parent_id, KEY),
            price_identifier,
            id
        )
    }


    /// Returns ID of price info object corresponding to price_identifier as a byte vector.
    public fun get_id_bytes(parent_id: &UID, price_identifier: PriceIdentifier): vector<u8> {
        assert!(
            contains(parent_id, price_identifier),
            E_PRICE_IDENTIFIER_NOT_REGISTERED
        );
        object::id_to_bytes(
            table::borrow<PriceIdentifier, ID>(
                dynamic_object_field::borrow(parent_id, KEY),
                price_identifier
            )
        )
    }

    /// Returns ID of price info object corresponding to price_identifier as an ID.
    public fun get_id(parent_id: &UID, price_identifier: PriceIdentifier): ID {
        assert!(
            contains(parent_id, price_identifier),
            E_PRICE_IDENTIFIER_NOT_REGISTERED
        );
        object::id_from_bytes(
            object::id_to_bytes(
                table::borrow<PriceIdentifier, ID>(
                    dynamic_object_field::borrow(parent_id, KEY),
                    price_identifier
                )
            )
        )
    }

    public fun contains(parent_id: &UID, price_identifier: PriceIdentifier): bool {
        let ref = dynamic_object_field::borrow(parent_id, KEY);
        table::contains<PriceIdentifier, ID>(ref, price_identifier)
    }

    public fun get_balance(price_info_object: &PriceInfoObject): u64 {
        if (!dynamic_object_field::exists_with_type<vector<u8>, Coin<SUI>>(&price_info_object.id, FEE_STORAGE_KEY)) {
            return 0
        };
        let fee = dynamic_object_field::borrow<vector<u8>, Coin<SUI>>(&price_info_object.id, FEE_STORAGE_KEY);
        coin::value(fee)
    }

    public fun deposit_fee_coins(price_info_object: &mut PriceInfoObject, fee_coins: Coin<SUI>) {
        if (!dynamic_object_field::exists_with_type<vector<u8>, Coin<SUI>>(&price_info_object.id, FEE_STORAGE_KEY)) {
            dynamic_object_field::add(&mut price_info_object.id, FEE_STORAGE_KEY, fee_coins);
        }
        else {
            let current_fee = dynamic_object_field::borrow_mut<vector<u8>, Coin<SUI>>(
                &mut price_info_object.id,
                FEE_STORAGE_KEY
            );
            coin::join(current_fee, fee_coins);
        };
    }

    public(friend) fun new_price_info_object(
        price_info: PriceInfo,
        ctx: &mut TxContext
    ): PriceInfoObject {
        PriceInfoObject {
            id: object::new(ctx),
            price_info
        }
    }

    public fun new_price_info(
        attestation_time: u64,
        arrival_time: u64,
        price_feed: PriceFeed,
    ): PriceInfo {
        PriceInfo {
            attestation_time,
            arrival_time,
            price_feed,
        }
    }

    #[test]
    public fun test_get_price_info_object_id_from_price_identifier(){
        use sui::object::{Self};
        use sui::test_scenario::{Self, ctx};
        use pyth::price_identifier::{Self};
        let scenario = test_scenario::begin(@pyth);
        let uid = object::new(ctx(&mut scenario));

        // Create a new price info object registry.
        new_price_info_registry(&mut uid, ctx(&mut scenario));

        // Register a price info object in the registry.
        let price_identifier = price_identifier::from_byte_vec(x"ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace");

        // Create a new ID.
        let id = object::id_from_bytes(x"19f253b07e88634bfd5a3a749f60bfdb83c9748910646803f06b60b76319e7ba");

        add(&mut uid, price_identifier, id);

        let result = get_id_bytes(&uid, price_identifier);

        // Assert that ID matches original.
        assert!(result==x"19f253b07e88634bfd5a3a749f60bfdb83c9748910646803f06b60b76319e7ba", 0);

        // Clean up.
        object::delete(uid);
        test_scenario::end(scenario);
    }

    #[test_only]
    public fun destroy(price_info: PriceInfoObject) {
        let PriceInfoObject {
            id,
            price_info: _,
        } = price_info;
        object::delete(id);
    }

    #[test_only]
    public fun new_price_info_object_for_test(
        price_info: PriceInfo,
        ctx: &mut TxContext
    ): PriceInfoObject {
        PriceInfoObject {
            id: object::new(ctx),
            price_info
        }
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
        price_info: &PriceInfo
    ) {
        price_info_object.price_info = new_price_info(
            price_info.attestation_time,
            price_info.arrival_time,
            price_info.price_feed
        );
    }
}
