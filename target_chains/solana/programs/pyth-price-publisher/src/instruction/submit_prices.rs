use {
    super::{validate_buffer, validate_publisher, validate_system, validate_vault},
    crate::accounts::publisher_prices,
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program_error::ProgramError,
        pubkey::Pubkey,
    },
};

/// Each time this is called it will append the new pricing information provided
/// by the Publisher and extend theeir PublisherPrices account for the validator
/// to read at the end of the slot.
pub fn submit_prices(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next())?;
    let _vault = validate_vault(accounts.next(), program_id)?;
    let buffer = validate_buffer(accounts.next(), publisher.key, program_id)?;
    let _system = validate_system(accounts.next())?;

    // Access and update PublisherPrices account with new data.
    let mut publisher_prices = buffer.0.data.borrow_mut();
    let publisher_prices = publisher_prices::read_mut(*publisher_prices)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    publisher_prices::extend(publisher_prices.0, publisher_prices.1, data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_submit_prices() {}
}
