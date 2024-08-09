use {
    super::{
        validate_buffer,
        validate_payer,
        validate_publisher,
        validate_system,
        validate_vault,
        Instruction,
        BUFFER_SEED,
        BUFFER_SIZE,
        VAULT_SEED,
    },
    crate::{
        accounts::publisher_prices::PublisherPricesHeader,
        ensure,
    },
    bytemuck::bytes_of,
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

pub fn initialize_publisher(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let mut accounts = accounts.into_iter();
    let publisher = validate_publisher(accounts.next())?;
    let vault = validate_vault(accounts.next(), program_id)?;
    let buffer = validate_buffer(accounts.next(), &publisher.key, program_id)?;
    let system = validate_system(accounts.next())?;

    // Deposit enough tokens to allocate the account.
    let lamports = (Rent::get()?).minimum_balance(BUFFER_SIZE as usize) * 2;

    invoke_signed(
        &system_instruction::create_account(
            vault.0.key,
            buffer.0.key,
            lamports,
            BUFFER_SIZE,
            program_id,
        ),
        &[vault.0.clone(), buffer.0.clone(), system.clone()],
        &[
            &[VAULT_SEED.as_bytes(), &[vault.1]],
            &[BUFFER_SEED.as_bytes(), &publisher.key.to_bytes(), &[buffer.1]],
        ],
    )?;

    // Write an initial Header into the account to prepare it to receive prices.
    let mut data = buffer
        .0
        .data
        .borrow_mut();

    let header = PublisherPricesHeader::new(publisher.key.to_bytes());
    let header = bytes_of(&header);
    data[..header.len()].copy_from_slice(header);

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        bytemuck::bytes_of,
        crate::instruction::initialize_publisher::PublisherPricesHeader,
        crate::instruction,
        crate::{
            instruction::VAULT_SEED,
            instruction::BUFFER_SEED,
            AccountInfo,
        },
        solana_program::{
            instruction::{
                AccountMeta,
                Instruction,
            },
            pubkey::Pubkey,
            stake_history::Epoch,
            system_program,
        },
        solana_program_test::*,
        solana_sdk::{
            signature::{
                Keypair,
                Signer,
            },
            transaction::Transaction,
        },
    };

    #[tokio::test]
    async fn test_initialize_publisher() {
        let id = Pubkey::new_unique();
        let (mut banks_client, payer, recent_blockhash) =
            ProgramTest::new("publishers", id, processor!(crate::process_instruction))
                .start()
                .await;

        // Setup Accounts
        let vault = Pubkey::find_program_address(&[VAULT_SEED.as_bytes()], &id);
        let publisher = Keypair::new();
        let buffer = Pubkey::find_program_address(&[BUFFER_SEED.as_bytes(), &publisher.pubkey().to_bytes()], &id);

        // First we need to initialize the vault PDA for use in the next instruction.
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data:       vec![instruction::Instruction::Initialize as u8],
                accounts:   vec![
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
                data:       vec![instruction::Instruction::InitializePublisher as u8],
                accounts:   vec![
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
