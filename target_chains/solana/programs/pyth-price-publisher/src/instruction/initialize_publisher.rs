use {
    super::{
        validate_buffer, validate_publisher, validate_system, validate_vault, BUFFER_SEED,
        MAX_NUM_PRICES, VAULT_SEED,
    },
    crate::accounts::publisher_prices::{self},
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed,
        program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction,
        sysvar::Sysvar,
    },
};

// TODO: restrict access?
pub fn initialize_publisher(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let mut accounts = accounts.iter();
    let publisher = validate_publisher(accounts.next(), false)?;
    let vault = validate_vault(accounts.next(), program_id)?;
    let buffer = validate_buffer(accounts.next(), publisher.key, program_id)?;
    let system = validate_system(accounts.next())?;

    let size = publisher_prices::size(MAX_NUM_PRICES);
    // Deposit enough tokens to allocate the account.
    let lamports = (Rent::get()?).minimum_balance(size) * 2;

    invoke_signed(
        &system_instruction::create_account(
            vault.0.key,
            buffer.0.key,
            lamports,
            size.try_into().expect("unexpected overflow"),
            program_id,
        ),
        &[vault.0.clone(), buffer.0.clone(), system.clone()],
        &[
            &[VAULT_SEED.as_bytes(), &[vault.1]],
            &[
                BUFFER_SEED.as_bytes(),
                &publisher.key.to_bytes(),
                &[buffer.1],
            ],
        ],
    )?;

    // Write an initial Header into the account to prepare it to receive prices.
    let mut data = buffer.0.data.borrow_mut();
    publisher_prices::create(&mut *data, publisher.key.to_bytes())
        .map_err(|_| ProgramError::AccountDataTooSmall)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        crate::{
            accounts::publisher_prices::PublisherPricesHeader,
            instruction::{self, BUFFER_SEED, VAULT_SEED},
        },
        bytemuck::bytes_of,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            pubkey::Pubkey,
            system_program,
        },
        solana_program_test::*,
        solana_sdk::{
            signature::{Keypair, Signer},
            transaction::Transaction,
        },
    };

    #[tokio::test]
    async fn test_initialize_publisher() {
        let id = Pubkey::new_unique();
        let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
            "publishers",
            id,
            processor!(crate::entrypoint::process_instruction),
        )
        .start()
        .await;

        // Setup Accounts
        let vault = Pubkey::find_program_address(&[VAULT_SEED.as_bytes()], &id);
        let publisher = Keypair::new();
        let buffer = Pubkey::find_program_address(
            &[BUFFER_SEED.as_bytes(), &publisher.pubkey().to_bytes()],
            &id,
        );

        // First we need to initialize the vault PDA for use in the next instruction.
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data: vec![instruction::Instruction::Initialize as u8],
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(vault.0, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Topup the PDA signer.
        let mut transaction = Transaction::new_with_payer(
            &[solana_program::system_instruction::transfer(
                &payer.pubkey(),
                &vault.0,
                1_000_000_000,
            )],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Allocate Publisher using PDA signer.
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data: vec![instruction::Instruction::InitializePublisher as u8],
                accounts: vec![
                    AccountMeta::new_readonly(publisher.pubkey(), true),
                    AccountMeta::new(vault.0, false),
                    AccountMeta::new(buffer.0, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &publisher], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        let header = PublisherPricesHeader::new(publisher.pubkey().to_bytes());
        let header = bytes_of(&header);

        // Validate the Allocation
        let buffer = banks_client.get_account(buffer.0).await.unwrap().unwrap();
        assert_eq!(buffer.owner, id);
        assert_eq!(&buffer.data[..header.len()], header);
    }
}
