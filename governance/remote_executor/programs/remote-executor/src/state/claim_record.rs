use anchor_lang::{
    account,
    prelude::{borsh::BorshSchema, *},
};

#[account]
#[derive(Default, BorshSchema)]
/// This struct records
pub struct ClaimRecord {
    pub sequence: u64,
}

impl ClaimRecord {
    pub const LEN: usize = 8;
}
