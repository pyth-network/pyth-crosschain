module pyth::set_stale_price_threshold {
    use wormhole::cursor;
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    struct StalePriceThreshold {
        threshold: u64,
    }

    public fun authorize_governance(
        pyth_state: &State,
        global: bool
    ): DecreeTicket<GovernanceWitness> {
        if (global){
            governance_message::authorize_verify_global(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_stale_price_threshold())
            )
        } else{
            governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_stale_price_threshold())
            )
        }
    }

    public(friend) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>) {
        let StalePriceThreshold { threshold } = from_byte_vec(payload);
        state::set_stale_price_threshold_secs(latest_only, state, threshold);
    }

    fun from_byte_vec(bytes: vector<u8>): StalePriceThreshold {
        let cursor = cursor::new(bytes);
        let threshold = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        StalePriceThreshold {
            threshold
        }
    }
}
