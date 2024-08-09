#![allow(warnings)]

use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

mod accounts;
mod error;
mod instruction;
use instruction::*;

solana_program::entrypoint!(process_instruction);
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match Instruction::parse(data) {
        Ok(Instruction::Initialize) => initialize(program_id, accounts),
        Ok(Instruction::SubmitPrices) => submit_prices(program_id, accounts, data),
        Ok(Instruction::InitializePublisher) => initialize_publisher(program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// Handler for the Init instruction
fn process_init(_program_id: &Pubkey, _accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Processing Init instruction");
    Ok(())
}

// Handler for the Disable instruction
fn process_disable(_program_id: &Pubkey, _accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Processing Disable instruction");
    Ok(())
}
