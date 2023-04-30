module pyth::transfer_fee {

    use sui::transfer::Self;
    use sui::coin::Self;
    use sui::tx_context::TxContext;

    use wormhole::cursor;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    struct PythFee {
        amount: u64,
        recipient: address
    }

    public fun authorize_governance(
        pyth_state: &State
    ): DecreeTicket<GovernanceWitness> {
        governance_message::authorize_verify_local(
            governance_witness::new_governance_witness(),
            state::governance_chain(pyth_state),
            state::governance_contract(pyth_state),
            state::governance_module(),
            governance_action::get_value(governance_action::new_set_transfer_fee())
        )
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
