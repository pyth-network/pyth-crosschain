use {
    crate::ensure,
    solana_program::{
        account_info::AccountInfo, program_error::ProgramError, program_memory::sol_memcmp,
        pubkey::Pubkey, system_program,
    },
};

mod initialize;
mod initialize_publisher;
mod submit_prices;

pub use {
    initialize::initialize, initialize_publisher::initialize_publisher,
    submit_prices::submit_prices,
};

/// Seed used to derive the vault account holding funds for initializing
/// publisher accounts. They cannot afford to pay for allocating accounts
/// on PythNet without this account helping fund it.
const VAULT_SEED: &str = "VAULT";

/// Seed used to derive the associated buffer account that publishers can
/// write their updates into.
const BUFFER_SEED: &str = "BUFFER";

/// Max number of prices allowed to be stored in a single publisher account.
const MAX_NUM_PRICES: usize = 128;

#[repr(u8)]
pub enum Instruction {
    // key[0] payer     [signer writable]
    // key[1] vault     [writable]
    // key[2] system    []
    Initialize,
    // key[0] publisher [signer writable]
    // key[1] buffer    [writable]
    SubmitPrices,
    // key[0] publisher []
    // key[1] vault     [writable]
    // key[2] buffer    [writable]
    // key[3] system    []
    InitializePublisher,
}

impl Instruction {
    pub fn parse(input: &[u8]) -> Result<Instruction, ProgramError> {
        match input.first() {
            Some(0) => Ok(Instruction::Initialize),
            Some(1) => Ok(Instruction::SubmitPrices),
            Some(2) => Ok(Instruction::InitializePublisher),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

fn validate_publisher<'a>(
    account: Option<&AccountInfo<'a>>,
    require_signer_writable: bool,
) -> Result<AccountInfo<'a>, ProgramError> {
    let publisher = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    if require_signer_writable {
        ensure!(
            ProgramError::InvalidInstructionData,
            publisher.is_signer,
            publisher.is_writable
        );
    }
    Ok(publisher)
}

fn validate_system<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let system = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    ensure!(
        ProgramError::InvalidInstructionData,
        system_program::check_id(system.key)
    );
    Ok(system)
}

fn validate_payer<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let payer = account
        .cloned()
        .ok_or(ProgramError::InvalidInstructionData)?;
    ensure!(
        ProgramError::InvalidInstructionData,
        payer.is_signer,
        payer.is_writable
    );
    Ok(payer)
}

fn pubkey_eq(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), 32) == 0
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
        pubkey_eq(&vault.key, &vault_pda.0),
        vault.is_writable
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
        pubkey_eq(&buffer.key, &buffer_pda.0)
    );
    Ok((buffer, buffer_pda.1))
}
