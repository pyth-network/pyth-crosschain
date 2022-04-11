//! Trivial program for mocking other programs easily
use solana_program::{
    account_info::AccountInfo,
    msg,
    program_error::ProgramError,
};
use solana_sdk::pubkey::Pubkey;

use solana_program_test::*;

pub fn passthrough_entrypoint(
    program_id: &Pubkey,
    account_infos: &[AccountInfo],
    data: &[u8],
) -> Result<(), ProgramError> {
    msg!(&format!("Program {}", program_id));
    msg!(&format!("account_infos {:?}", account_infos));
    Ok(())
}

pub fn add_passthrough(pt: &mut ProgramTest, name: &str, prog_id: Pubkey) {
    pt.add_program(name, prog_id, processor!(passthrough_entrypoint))
}
