mod initialize;
mod initialize_publisher;
mod submit_prices;

use crate::instruction::Instruction;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, program_error::ProgramError,
    pubkey::Pubkey,
};
use {
    initialize::initialize, initialize_publisher::initialize_publisher,
    submit_prices::submit_prices,
};

solana_program::entrypoint!(process_instruction);
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match Instruction::parse(data) {
        Ok(Instruction::Initialize) => initialize(program_id, accounts, &data[1..]),
        Ok(Instruction::SubmitPrices) => submit_prices(program_id, accounts, &data[1..]),
        Ok(Instruction::InitializePublisher) => {
            initialize_publisher(program_id, accounts, &data[1..])
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
