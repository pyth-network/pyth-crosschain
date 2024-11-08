use {
    crate::{
        accounts::{buffer, publisher_config},
        ensure,
        instruction::SubmitPricesArgsHeader,
        validate::{validate_buffer, validate_publisher, validate_publisher_config_for_access},
    },
    solana_program::{
        account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult,
        program_error::ProgramError, program_memory::sol_memcmp, pubkey::Pubkey, sysvar::Sysvar,
    },
};

/// Append the new pricing information provided by the publisher to
/// its buffer account. The buffer account will be read and applied by the validator
/// to read at the end of the slot.
/// If there are old prices in the account, they will be removed before adding new data.
/// See `Instruction` for the list of required accounts.
/// The publisher config account must be an initialized PDA account with an expected seed
/// (depending on the publisher account that signed the instruction).
/// The buffer account must match the buffer key stored in the publisher config account.
pub fn submit_prices(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &SubmitPricesArgsHeader,
    prices_data: &[u8],
) -> ProgramResult {
    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next())?;
    let publisher_config = validate_publisher_config_for_access(
        accounts.next(),
        args.publisher_config_bump,
        publisher.key,
        program_id,
    )?;
    let buffer = validate_buffer(accounts.next(), program_id)?;

    let publisher_config_data = publisher_config.data.borrow();
    let publisher_config = publisher_config::read(*publisher_config_data)?;
    // Required to ensure that `find_program_address` returned the same account as
    // `create_program_address` in `initialize_publisher`.
    ensure!(
        ProgramError::InvalidArgument,
        sol_memcmp(&publisher.key.to_bytes(), &publisher_config.publisher, 32) == 0
    );
    ensure!(
        ProgramError::InvalidArgument,
        sol_memcmp(&buffer.key.to_bytes(), &publisher_config.buffer_account, 32) == 0
    );

    // Access and update PublisherPrices account with new data.
    let mut buffer_data = buffer.data.borrow_mut();
    let (header, prices) = buffer::read_mut(*buffer_data)?;
    buffer::update(header, prices, Clock::get()?.slot, prices_data)?;

    Ok(())
}
