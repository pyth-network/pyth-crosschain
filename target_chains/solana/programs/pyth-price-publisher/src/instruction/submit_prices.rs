use {
    super::{validate_buffer, validate_publisher},
    crate::accounts::publisher_prices,
    solana_program::{
        account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, pubkey::Pubkey,
        sysvar::Sysvar,
    },
};

/// Each time this is called it will append the new pricing information provided
/// by the Publisher and extend their PublisherPrices account for the validator
/// to read at the end of the slot. If there are old prices in the account, they
/// will be removed first.
pub fn submit_prices(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next())?;
    let buffer = validate_buffer(accounts.next(), publisher.key, program_id)?;

    // Access and update PublisherPrices account with new data.
    let mut publisher_prices = buffer.0.data.borrow_mut();
    let (header, prices) = publisher_prices::read_mut(*publisher_prices)?;
    let current_slot = Clock::get()?.slot;
    if header.slot != current_slot {
        header.slot = current_slot;
        header.num_prices = 0;
    }
    publisher_prices::extend(header, prices, data)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_submit_prices() {}
}
