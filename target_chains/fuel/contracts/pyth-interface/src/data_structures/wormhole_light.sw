library;

pub struct GuardianSet {
    expiration_time: u64,
    keys: Vec<b256>,
}

pub struct WormholeProvider {
    governance_chain_id: u16,
    governance_contract: b256,
}
