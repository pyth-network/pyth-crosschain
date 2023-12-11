use {
    anchor_lang::prelude::*,
    solana_program::pubkey::Pubkey,
};

#[account]
pub struct Config {
    pub governance_authority:          Pubkey,
    pub target_governance_authority:   Option<Pubkey>,
    pub wormhole:                      Pubkey,
    pub valid_data_sources:            Vec<DataSource>,
    pub single_update_fee_in_lamports: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DataSource {
    pub chain:   u16,
    pub emitter: Pubkey,
}

impl Config {
    pub const LEN: usize = 1000; // PLACEHOLDER LEN, DECIDE HOW BIG WE WANT TO MAKE IT
}
