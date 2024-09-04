use {
    crate::{
        accounts::{buffer, publisher_config},
        ensure,
        instruction::SubmitPricesArgsHeader,
        validate::{validate_buffer, validate_publisher, validate_publisher_config},
    },
    bytemuck::try_from_bytes,
    solana_program::{
        account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult,
        program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
    },
    std::mem::size_of,
};

/// Each time this is called it will append the new pricing information provided
/// by the Publisher and extend their PublisherPrices account for the validator
/// to read at the end of the slot. If there are old prices in the account, they
/// will be removed first.
pub fn submit_prices(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    ensure!(
        ProgramError::InvalidInstructionData,
        data.len() >= size_of::<SubmitPricesArgsHeader>()
    );
    let (args_data, prices_data) = data.split_at(size_of::<SubmitPricesArgsHeader>());
    let args: &SubmitPricesArgsHeader =
        try_from_bytes(args_data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next())?;
    let publisher_config = validate_publisher_config(
        accounts.next(),
        args.publisher_config_bump,
        publisher.key,
        program_id,
        false,
    )?;
    let buffer = validate_buffer(accounts.next(), program_id)?;

    let publisher_config_data = publisher_config.data.borrow();
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
    buffer::extend(header, prices, prices_data)?;

    Ok(())
}
