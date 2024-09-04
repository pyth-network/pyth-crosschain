use {
    crate::{
        accounts, ensure,
        instruction::{CONFIG_SEED, PUBLISHER_CONFIG_SEED},
    },
    solana_program::{
        account_info::AccountInfo, program_error::ProgramError, program_memory::sol_memcmp,
        pubkey::Pubkey, system_program,
    },
};

pub fn validate_publisher<'a>(
    account: Option<&AccountInfo<'a>>,
) -> Result<AccountInfo<'a>, ProgramError> {
    let publisher = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::MissingRequiredSignature, publisher.is_signer);
    ensure!(ProgramError::InvalidArgument, publisher.is_writable);
    Ok(publisher)
}

pub fn validate_system<'a>(
    account: Option<&AccountInfo<'a>>,
) -> Result<AccountInfo<'a>, ProgramError> {
    let system = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(
        ProgramError::InvalidArgument,
        pubkey_eq(system.key, &system_program::id())
    );
    Ok(system)
}

pub fn validate_payer<'a>(
    account: Option<&AccountInfo<'a>>,
) -> Result<AccountInfo<'a>, ProgramError> {
    let payer = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::MissingRequiredSignature, payer.is_signer);
    ensure!(ProgramError::InvalidArgument, payer.is_writable);
    Ok(payer)
}

fn pubkey_eq(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), 32) == 0
}

pub fn validate_config<'a>(
    account: Option<&AccountInfo<'a>>,
    bump: u8,
    program_id: &Pubkey,
    require_writable: bool,
) -> Result<AccountInfo<'a>, ProgramError> {
    let config = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let config_pda = Pubkey::create_program_address(&[CONFIG_SEED.as_bytes(), &[bump]], program_id)
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    ensure!(
        ProgramError::InvalidArgument,
        pubkey_eq(config.key, &config_pda)
    );
    if require_writable {
        ensure!(ProgramError::InvalidArgument, config.is_writable);
    }
    Ok(config)
}

pub fn validate_authority<'a>(
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

pub fn validate_publisher_config<'a>(
    account: Option<&AccountInfo<'a>>,
    bump: u8,
    publisher: &Pubkey,
    program_id: &Pubkey,
    require_writable: bool,
) -> Result<AccountInfo<'a>, ProgramError> {
    let publisher_config = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    let publisher_config_pda = Pubkey::create_program_address(
        &[
            PUBLISHER_CONFIG_SEED.as_bytes(),
            &publisher.to_bytes(),
            &[bump],
        ],
        program_id,
    )
    .map_err(|_| ProgramError::InvalidInstructionData)?;
    if require_writable {
        ensure!(ProgramError::InvalidArgument, publisher_config.is_writable);
    }
    ensure!(
        ProgramError::MissingRequiredSignature,
        pubkey_eq(publisher_config.key, &publisher_config_pda)
    );
    Ok(publisher_config)
}

pub fn validate_buffer<'a>(
    account: Option<&AccountInfo<'a>>,
    program_id: &Pubkey,
) -> Result<AccountInfo<'a>, ProgramError> {
    let buffer = account.cloned().ok_or(ProgramError::NotEnoughAccountKeys)?;
    ensure!(ProgramError::InvalidArgument, buffer.is_writable);
    ensure!(ProgramError::IllegalOwner, buffer.owner == program_id);
    Ok(buffer)
}
