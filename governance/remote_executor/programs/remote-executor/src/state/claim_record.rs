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
