module pyth::governance_witness {

    friend pyth::set_data_sources;
    friend pyth::set_stale_price_threshold;
    friend pyth::set_update_fee;
    friend pyth::set_governance_data_source;
    friend pyth::set_fee_recipient;
    friend pyth::contract_upgrade;

    /// A hot potato that ensures that only DecreeTickets
    /// and DecreeReceipts associated with Sui Pyth governance
    /// are passed to execute_governance_instruction or
    /// execute_contract_upgrade_governance_instruction.
    ///
    /// DecreeTickets and DecreeReceipts are Wormhole structs
    /// that are used in the VAA verification process.
    struct GovernanceWitness has drop {}

    public(friend) fun new_governance_witness(): GovernanceWitness{
        GovernanceWitness{}
    }
}
