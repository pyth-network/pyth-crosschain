use {
    crate::{
        accounts::{buffer, publisher_config},
        ensure,
        instruction::{InitializePublisherArgs, PUBLISHER_CONFIG_SEED},
        validate::{
            validate_authority, validate_buffer, validate_config,
            validate_publisher_config_for_init, validate_system,
        },
    },
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed,
        program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction,
        sysvar::Sysvar,
    },
};

/// Creates a publisher config account and stores the buffer account pubkey in it.
/// Verifies and initializes the buffer account.
/// See `Instruction` for the list of required accounts.
/// The config account must be an initialized PDA account with an expected seed.
/// The authority account that signed the instruction
/// must match the authority key stored in the config account.
/// The publisher config account must be a non-existing PDA account with an expected seed.
/// The buffer config must be an existing, zero-filled account owned by the program.
/// Note: we aren't using a PDA for the buffer because the program can't create
/// a PDA larger than 10240 bytes in a single transaction.
/// Note: currently, the publisher config can only be set once and can only contain
/// a single buffer key. If we need to modify the buffer key or create multiple buffer keys
/// per publisher, we'll need to upgrade the program.
pub fn initialize_publisher(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitializePublisherArgs,
) -> ProgramResult {
    let mut accounts = accounts.iter();
    let first_account = accounts.next();
    let config = validate_config(accounts.next(), args.config_bump, program_id, false)?;
    let authority = validate_authority(first_account, config)?;
    let publisher_config = validate_publisher_config_for_init(
        accounts.next(),
        args.publisher_config_bump,
        &args.publisher.into(),
        program_id,
    )?;
    let buffer = validate_buffer(accounts.next(), program_id)?;
    let system = validate_system(accounts.next())?;

    // Deposit enough tokens to allocate the account.
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(publisher_config::SIZE);

    invoke_signed(
        &system_instruction::create_account(
            authority.key,
            publisher_config.key,
            lamports,
            publisher_config::SIZE
                .try_into()
                .expect("unexpected overflow"),
            program_id,
        ),
        &[authority.clone(), publisher_config.clone(), system.clone()],
        &[&[
            PUBLISHER_CONFIG_SEED.as_bytes(),
            &args.publisher,
            &[args.publisher_config_bump],
        ]],
    )?;

    let mut publisher_config_data = publisher_config.data.borrow_mut();
    publisher_config::create(
        *publisher_config_data,
        args.publisher,
        buffer.key.to_bytes(),
    )?;

    // Write an initial Header into the buffer account to prepare it to receive prices.
    let mut buffer_data = buffer.data.borrow_mut();
    ensure!(
        ProgramError::AccountNotRentExempt,
        buffer.lamports() >= rent.minimum_balance(buffer_data.len())
    );
    buffer::create(*buffer_data, args.publisher)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        crate::{
            accounts::{
                self,
                buffer::{BufferHeader, BufferedPrice},
            },
            instruction::{CONFIG_SEED, PUBLISHER_CONFIG_SEED},
        },
        bytemuck::{bytes_of, cast_slice},
        solana_program::{
            instruction::{AccountMeta, Instruction},
            pubkey::Pubkey,
            system_program,
        },
        solana_program_test::*,
        solana_sdk::{
            rent::Rent,
            signature::{Keypair, Signer},
            transaction::Transaction,
        },
    };

    #[tokio::test]
    async fn test_initialize_and_publish() {
        let id = Pubkey::new_unique();
        let (mut banks_client, authority, recent_blockhash) = ProgramTest::new(
            "publishers",
            id,
            processor!(crate::processor::process_instruction),
        )
        .start()
        .await;

        // Setup Accounts
        let (config, config_bump) = Pubkey::find_program_address(&[CONFIG_SEED.as_bytes()], &id);

        let publisher = Keypair::new();

        let (publisher_config, publisher_config_bump) = Pubkey::find_program_address(
            &[
                PUBLISHER_CONFIG_SEED.as_bytes(),
                &publisher.pubkey().to_bytes(),
            ],
            &id,
        );

        // First we need to initialize the vault PDA for use in the next instruction.
        let mut data = vec![
            crate::instruction::Instruction::Initialize as u8,
            config_bump,
        ];
        data.extend_from_slice(&authority.pubkey().to_bytes());
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new_readonly(authority.pubkey(), true),
                    AccountMeta::new(config, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create a buffer account.
        let buffer_space = accounts::buffer::size(5000);
        let buffer_lamports = Rent::default().minimum_balance(buffer_space);
        let buffer_key = Pubkey::create_with_seed(&authority.pubkey(), "seed1", &id).unwrap();
        let mut transaction = Transaction::new_with_payer(
            &[
                solana_program::system_instruction::create_account_with_seed(
                    &authority.pubkey(),
                    &buffer_key,
                    &authority.pubkey(),
                    "seed1",
                    buffer_lamports,
                    buffer_space as u64,
                    &id,
                ),
            ],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create a publisher's buffer account.
        let mut data = vec![
            crate::instruction::Instruction::InitializePublisher as u8,
            config_bump,
            publisher_config_bump,
        ];
        data.extend_from_slice(&publisher.pubkey().to_bytes());
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new(authority.pubkey(), true),
                    AccountMeta::new_readonly(config, false),
                    AccountMeta::new(publisher_config, false),
                    AccountMeta::new(buffer_key, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        {
            // Validate the publisher config PDA allocation.
            let buffer = banks_client
                .get_account(publisher_config)
                .await
                .unwrap()
                .unwrap();
            assert_eq!(buffer.owner, id);
            let actual = accounts::publisher_config::read(&buffer.data).unwrap();
            assert_eq!(actual.buffer_account, buffer_key.to_bytes());
            assert_eq!(actual.publisher, publisher.pubkey().to_bytes());
        }

        {
            let header = BufferHeader::new(publisher.pubkey().to_bytes());
            let header = bytes_of(&header);
            // Validate the buffer initialization.
            let buffer = banks_client.get_account(buffer_key).await.unwrap().unwrap();
            assert_eq!(buffer.owner, id);
            assert_eq!(&buffer.data[..header.len()], header);
        }

        // Topup the publisher account
        let mut transaction = Transaction::new_with_payer(
            &[solana_program::system_instruction::transfer(
                &authority.pubkey(),
                &publisher.pubkey(),
                1_000_000_000,
            )],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Publish some prices.
        let mut data = vec![
            crate::instruction::Instruction::SubmitPrices as u8,
            publisher_config_bump,
        ];
        let prices = [
            BufferedPrice::new(1, 2, 200, 3).unwrap(),
            BufferedPrice::new(2, 3, 300, 4).unwrap(),
        ];
        data.extend_from_slice(&cast_slice(&prices));
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new(publisher.pubkey(), true),
                    AccountMeta::new_readonly(publisher_config, false),
                    AccountMeta::new(buffer_key, false),
                ],
            }],
            Some(&publisher.pubkey()),
        );
        transaction.sign(&[&publisher], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        {
            // Validate the Allocation
            let buffer = banks_client.get_account(buffer_key).await.unwrap().unwrap();
            assert_eq!(buffer.owner, id);
            let (out_header, out_prices) = accounts::buffer::read(&buffer.data).unwrap();

            assert_eq!(&out_header.publisher, &publisher.pubkey().to_bytes());
            assert_eq!({ out_header.num_prices }, 2);
            assert_ne!({ out_header.slot }, 0);
            assert_eq!(&prices[..], out_prices);
        }
    }
}
