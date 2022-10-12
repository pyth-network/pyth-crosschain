module pyth::pyth {
    use sui::object::{UID};

    // TODO: handle multiple prices
    //  (some deterministic id generation scheme?)

    struct PythPriceId {
        id: u64,
    }

    struct Update {
        uid:    UID,
        price: u64,
    }

    // How to store prices, with an ID
    fun get_price(): Price {
        // Publish price object for everyone to consume


        // Return this to the user
    }

    fun get_price_and_publish(): Price {
        // Look up price stored at pyth address
        // Share object globally
        // Return to user
        
    }

    fun update_price(ctx: &mut TxContext, price: u64):  {
        let update = Update{
            uid: object::new(ctx),
            price: price,
        }

        transfer(update, @pyth);
    }

    // Ran when module is published
    fun init(ctx: &mut TxContext) {
        // TODO
    }

}

#[test_only]
module pyth::pyth_test {

    #[test]
    fun test_update_price() {
        let pyth_address = @pyth;
    }

}
