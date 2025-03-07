module wrapped_coin::coin {
    use iota::transfer::{Self};
    use iota::tx_context::{Self, TxContext};

    use token_bridge::create_wrapped::{Self};

    struct COIN has drop {}

    fun init(witness: COIN, ctx: &mut TxContext) {
        use token_bridge::version_control::{{{VERSION}}};

        transfer::public_transfer(
            create_wrapped::prepare_registration<COIN, {{VERSION}}>(
                witness,
                {{DECIMALS}},
                ctx
            ),
            tx_context::sender(ctx)
        );
    }
}
