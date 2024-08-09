use {
    crate::ensure,
    solana_program::{
        account_info::AccountInfo,
        entrypoint::{
            self,
            ProgramResult,
        },
        msg,
        program::invoke_signed,
        program_error::ProgramError,
        pubkey::Pubkey,
        rent::Rent,
        system_instruction,
        sysvar::Sysvar,
    },
};

mod initialize;
mod initialize_publisher;
mod submit_prices;

pub use {
    initialize::initialize,
    initialize_publisher::initialize_publisher,
    submit_prices::submit_prices,
};

/// Seed used to derive the vault account holding funds for initializing
/// publisher accounts. They cannot afford to pay for allocating accounts
/// on PythNet without this account helping fund it.
const VAULT_SEED: &'static str = "VAULT";

/// Seed used to derive the associated buffer account that publishers can
/// write their updates into. That account will be cleared at the end of
/// each slot.
const BUFFER_SEED: &'static str = "BUFFER";

/// Amount of space to allocate to buffer publisher prices during a slot.
///
/// Each Price sent by the publisher will be:
/// - 4 byte PriceFeedIdentifier
/// - 8 byte Price
/// - 8 byte Confidence
///
/// As a conservative initial size we allocate enough space for a total
/// of 128 uncompressed prices.
const BUFFER_SIZE: u64 = (4 + 8 + 8) * 128;

#[repr(u8)]
pub enum Instruction {
    Initialize,
    SubmitPrices,
    InitializePublisher,
}

impl Instruction {
    pub fn parse(input: &[u8]) -> Result<Instruction, ProgramError> {
        match input.get(0) {
            Some(0) => Ok(Instruction::Initialize),
            Some(1) => Ok(Instruction::SubmitPrices),
            Some(2) => Ok(Instruction::InitializePublisher),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

fn validate_publisher<'a>(
    account: Option<&AccountInfo<'a>>,
) -> Result<AccountInfo<'a>, ProgramError> {
    let system = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    Ok(system)
}

fn validate_system<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let system = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    Ok(system)
}

fn validate_payer<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let payer = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    ensure!(ProgramError::InvalidInstructionData, payer.is_signer);
    Ok(payer)
}

fn validate_vault<'a>(
    account: Option<&AccountInfo<'a>>,
    program_id: &Pubkey,
) -> Result<(AccountInfo<'a>, u8), ProgramError> {
    let vault = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    let vault_pda = Pubkey::find_program_address(&[VAULT_SEED.as_bytes()], program_id);
    ensure!(
        ProgramError::InvalidInstructionData,
        vault.key.eq(&vault_pda.0)
    );
    Ok((vault, vault_pda.1))
}

fn validate_buffer<'a>(
    account: Option<&AccountInfo<'a>>,
    publisher: &Pubkey,
    program_id: &Pubkey,
) -> Result<(AccountInfo<'a>, u8), ProgramError> {
    let buffer = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    let buffer_pda =
        Pubkey::find_program_address(&[BUFFER_SEED.as_bytes(), &publisher.to_bytes()], program_id);
    ensure!(
        ProgramError::InvalidInstructionData,
        buffer.is_writable,
        buffer.key.eq(&buffer_pda.0)
    );
    Ok((buffer, buffer_pda.1))
}
