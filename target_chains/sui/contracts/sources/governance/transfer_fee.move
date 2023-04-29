module pyth::transfer_fee {

    use sui::transfer::Self;
    use sui::coin::Self;
    use sui::tx_context::TxContext;

    use wormhole::cursor;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};

    use pyth::state::{Self, State, LatestOnly};

    friend pyth::governance;

    struct PythFee {
        amount: u64,
        recipient: address
    }

    public(friend) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>, ctx: &mut TxContext) {

        let PythFee { amount, recipient } = from_byte_vec(payload);

        transfer::public_transfer(
            coin::from_balance(
                state::withdraw_fee(latest_only, state, amount),
                ctx
            ),
            recipient
        );
    }

    fun from_byte_vec(payload: vector<u8>): PythFee {
        let cur = cursor::new(payload);

        // This amount cannot be greater than max u64.
        let amount = bytes32::to_u64_be(bytes32::take_bytes(&mut cur));

        // Recipient must be non-zero address.
        let recipient = external_address::take_nonzero(&mut cur);

        cursor::destroy_empty(cur);

        PythFee {
            amount: (amount as u64),
            recipient: external_address::to_address(recipient)
        }
    }
}
