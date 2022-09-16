use anchor_lang::prelude::*;
use anchor_lang::account;
use anchor_lang::prelude::borsh::BorshSchema;

#[account]
#[derive(Default, BorshSchema)]
/// This struct records 
pub struct ClaimRecord{
    pub sequence : u64 
}