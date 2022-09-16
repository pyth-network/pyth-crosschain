#![deny(warnings)]

use anchor_lang::{prelude::*, solana_program::borsh::get_packed_len};
use state::{claim_record::ClaimRecord, posted_vaa::PostedVaa};

mod state;
mod error;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod remote_executor {
    use anchor_lang::solana_program::{program::invoke_signed, instruction::Instruction};

    use crate::{state::{posted_vaa::CHAIN_ID_SOLANA, governance_payload::ExecutorPayload}, error::ExecutorError};

    use super::*;

    pub fn execute_posted_vaa(ctx: Context<ExecutePostedVaa>) -> Result<()> {
        let posted_vaa = &ctx.accounts.posted_vaa;
        let claim_record = &mut ctx.accounts.claim_record;
        assert_or_err(posted_vaa.emitter_chain == CHAIN_ID_SOLANA, err!(ExecutorError::EmitterChainNotSolana))?;
        assert_or_err(posted_vaa.sequence > claim_record.sequence, err!(ExecutorError::NonIncreasingSequence))?;
        claim_record.sequence = posted_vaa.sequence;

        let payload = ExecutorPayload::try_from_slice(&posted_vaa.payload)?;
        payload.check_header()?;
        
        for instruction in payload.instructions.iter().map(Instruction::from) {
            // TO DO: We currently pass `remaining_accounts` down to the CPIs, is there a more efficient way to do it?
            // TO DO: We don't pass ctx.accounts so executor_key needs to be both in the anchor context and in remaining accounts
            invoke_signed(&instruction, ctx.remaining_accounts, &[&[EXECUTOR_KEY_SEED.as_bytes(), &posted_vaa.emitter_address, &[*ctx.bumps.get("executor_key").unwrap()]]])?;
        }
        Ok(())
    }
}

const EXECUTOR_KEY_SEED : &str = "EXECUTOR_KEY";
const CLAIM_RECORD_SEED : &str = "CLAIM_RECORD";


#[derive(Accounts)]
pub struct ExecutePostedVaa<'info> {
    #[account(mut)]
    pub payer : Signer<'info>,
    pub posted_vaa : Account<'info, PostedVaa>,
    #[account(seeds = [EXECUTOR_KEY_SEED.as_bytes(), &posted_vaa.emitter_address], bump)]
    pub executor_key : UncheckedAccount<'info>,
    /// The reason claim record is separated from executor_key is that executor key might need to pay in the CPI, so we want it to be a wallet
    #[account(init_if_needed, space = 8 + get_packed_len::<ClaimRecord>(), payer=payer, seeds = [CLAIM_RECORD_SEED.as_bytes(), &posted_vaa.emitter_address], bump)]
    pub claim_record : Account<'info, ClaimRecord>,
    pub system_program: Program<'info, System>
}

pub fn assert_or_err(condition : bool, error : Result<()>) -> Result<()>{
    if !condition {
        error
    } else {
        Result::Ok(())
    }
}