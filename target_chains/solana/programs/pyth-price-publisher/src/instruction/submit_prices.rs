use {
    super::{validate_buffer, validate_publisher, validate_publisher_config},
    crate::{
        accounts::{buffer, publisher_config},
        ensure,
    },
    solana_program::{
        account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult,
        program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
    },
};

/// Each time this is called it will append the new pricing information provided
/// by the Publisher and extend their PublisherPrices account for the validator
/// to read at the end of the slot. If there are old prices in the account, they
/// will be removed first.
pub fn submit_prices(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next())?;
    let publisher_config =
        validate_publisher_config(accounts.next(), publisher.key, program_id, false)?;
    let buffer = validate_buffer(accounts.next(), program_id)?;

    let publisher_config_data = publisher_config.0.data.borrow();
    let publisher_config = publisher_config::read(*publisher_config_data)?;
    ensure!(
        ProgramError::InvalidArgument,
        buffer.key.to_bytes() == publisher_config.buffer_account
    );

    // Access and update PublisherPrices account with new data.
    let mut buffer_data = buffer.data.borrow_mut();
    let (header, prices) = buffer::read_mut(*buffer_data)?;
    let current_slot = Clock::get()?.slot;
    if header.slot != current_slot {
        header.slot = current_slot;
        header.num_prices = 0;
    }
    buffer::extend(header, prices, data)?;

    Ok(())
}
