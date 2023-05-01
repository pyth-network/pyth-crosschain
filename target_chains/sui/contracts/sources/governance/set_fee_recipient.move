module pyth::set_fee_recipient {
    use wormhole::cursor;
    use wormhole::external_address::{Self};
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    struct PythFeeRecipient {
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
            governance_action::get_value(governance_action::new_set_fee_recipient())
        )
    }

    public(friend) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>) {
        let PythFeeRecipient { recipient } = from_byte_vec(payload);
        state::set_fee_recipient(latest_only, state, recipient);
    }

    fun from_byte_vec(payload: vector<u8>): PythFeeRecipient {
        let cur = cursor::new(payload);

        // Recipient must be non-zero address.
        let recipient = external_address::take_nonzero(&mut cur);

        cursor::destroy_empty(cur);

        PythFeeRecipient {
            recipient: external_address::to_address(recipient)
        }
    }
}
