module pyth::contract_upgrade {
    use pyth::state::{State};

    use wormhole::state::{State as WormState};

    friend pyth::governance;

    /// Payload should be the bytes digest of the new contract.
    public(friend) fun execute(_worm_state: &WormState, _pyth_state: &State, _payload: vector<u8>){
        // TODO
    }
}