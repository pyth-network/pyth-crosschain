use {
    crate::{accounts, ensure},
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

/// Seed used to derive the config account.
const CONFIG_SEED: &str = "CONFIG";

/// Seed used to derive the associated buffer account that publishers can
/// write their updates into.
const PUBLISHER_CONFIG_SEED: &str = "PUBLISHER_CONFIG";

#[repr(u8)]
pub enum Instruction {
    // key[0] payer     [signer writable]
    // key[1] config    [writable]
    // key[2] system    []
    Initialize,
    // key[0] publisher        [signer writable]
    // key[1] publisher_config []
    // key[2] buffer           [writable]
    SubmitPrices,
    // key[0] autority         [signer writable]
    // key[1] config           []
    // key[2] publisher_config [writable]
    // key[3] buffer           [writable]
    // key[4] system           []
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
) -> Result<AccountInfo<'a>, ProgramError> {
    let publisher = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::MissingRequiredSignature, publisher.is_signer);
    ensure!(ProgramError::InvalidArgument, publisher.is_writable);
    Ok(publisher)
}

fn validate_system<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let system = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(
        ProgramError::InvalidArgument,
        pubkey_eq(system.key, &system_program::id())
    );
    Ok(system)
}

fn validate_payer<'a>(account: Option<&AccountInfo<'a>>) -> Result<AccountInfo<'a>, ProgramError> {
    let payer = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::MissingRequiredSignature, payer.is_signer);
    ensure!(ProgramError::InvalidArgument, payer.is_writable);
    Ok(payer)
}

fn pubkey_eq(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), 32) == 0
}

fn validate_config<'a>(
    account: Option<&AccountInfo<'a>>,
    program_id: &Pubkey,
    require_writable: bool,
) -> Result<(AccountInfo<'a>, u8), ProgramError> {
    let config = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let config_pda = Pubkey::find_program_address(&[CONFIG_SEED.as_bytes()], program_id);
    ensure!(
        ProgramError::InvalidArgument,
        pubkey_eq(config.key, &config_pda.0)
    );
    if require_writable {
        ensure!(ProgramError::InvalidArgument, config.is_writable);
    }
    Ok((config, config_pda.1))
}

fn validate_authority<'a>(
    account: Option<&AccountInfo<'a>>,
    config: &AccountInfo<'a>,
) -> Result<AccountInfo<'a>, ProgramError> {
    let authority = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::MissingRequiredSignature, authority.is_signer);
    ensure!(ProgramError::InvalidArgument, authority.is_writable);
    let config_data = config.data.borrow();
    let config = accounts::config::read(*config_data)?;
    ensure!(
        ProgramError::MissingRequiredSignature,
        authority.key.to_bytes() == config.authority
    );
    Ok(authority)
}

fn validate_publisher_config<'a>(
    account: Option<&AccountInfo<'a>>,
    publisher: &Pubkey,
    program_id: &Pubkey,
    require_writable: bool,
) -> Result<(AccountInfo<'a>, u8), ProgramError> {
    let publisher_config = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let publisher_config_pda = Pubkey::find_program_address(
        &[PUBLISHER_CONFIG_SEED.as_bytes(), &publisher.to_bytes()],
        program_id,
    );
    if require_writable {
        ensure!(ProgramError::InvalidArgument, publisher_config.is_writable);
    }
    ensure!(
        ProgramError::MissingRequiredSignature,
        pubkey_eq(publisher_config.key, &publisher_config_pda.0)
    );
    Ok((publisher_config, publisher_config_pda.1))
}

fn validate_buffer<'a>(
    account: Option<&AccountInfo<'a>>,
    program_id: &Pubkey,
) -> Result<AccountInfo<'a>, ProgramError> {
    let buffer = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::InvalidArgument, buffer.is_writable);
    ensure!(ProgramError::IllegalOwner, buffer.owner == program_id);
    Ok(buffer)
}
