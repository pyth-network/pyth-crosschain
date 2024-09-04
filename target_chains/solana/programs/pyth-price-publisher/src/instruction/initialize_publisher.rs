use {
    super::{
        validate_authority, validate_buffer, validate_config, validate_system, BUFFER_SEED,
        MAX_NUM_PRICES,
    },
    crate::accounts::publisher_prices,
    bytemuck::{try_from_bytes, Pod, Zeroable},
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed,
        program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction,
        sysvar::Sysvar,
    },
};

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct Args {
    pub publisher: Pubkey,
}

// TODO: restrict access?
pub fn initialize_publisher(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let args: &Args = try_from_bytes(data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let mut accounts = accounts.iter();
    let first_account = accounts.next();
    let config = validate_config(accounts.next(), program_id, false)?;
    let authority = validate_authority(first_account, &config.0)?;
    let buffer = validate_buffer(accounts.next(), &args.publisher, program_id)?;
    let system = validate_system(accounts.next())?;

    let size = publisher_prices::size(MAX_NUM_PRICES);
    // Deposit enough tokens to allocate the account.
    let lamports = (Rent::get()?).minimum_balance(size) * 2;

    invoke_signed(
        &system_instruction::create_account(
            authority.key,
            buffer.0.key,
            lamports,
            size.try_into().expect("unexpected overflow"),
            program_id,
        ),
        &[authority.clone(), buffer.0.clone(), system.clone()],
        &[&[
            BUFFER_SEED.as_bytes(),
            &args.publisher.to_bytes(),
            &[buffer.1],
        ]],
    )?;

    // Write an initial Header into the account to prepare it to receive prices.
    let mut data = buffer.0.data.borrow_mut();
    publisher_prices::create(*data, args.publisher.to_bytes())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        crate::{
            accounts::{
                self,
                publisher_prices::{PublisherPrice, PublisherPricesHeader},
            },
            instruction::{BUFFER_SEED, CONFIG_SEED},
        },
        bytemuck::{bytes_of, cast_slice},
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
    async fn test_initialize_and_publish() {
        let id = Pubkey::new_unique();
        let (mut banks_client, authority, recent_blockhash) = ProgramTest::new(
            "publishers",
            id,
            processor!(crate::entrypoint::process_instruction),
        )
        .start()
        .await;

        // Setup Accounts
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_bytes()], &id);

        let publisher = Keypair::new();

        let buffer = Pubkey::find_program_address(
            &[BUFFER_SEED.as_bytes(), &publisher.pubkey().to_bytes()],
            &id,
        );

        // First we need to initialize the vault PDA for use in the next instruction.
        let mut data = vec![crate::instruction::Instruction::Initialize as u8];
        data.extend_from_slice(&authority.pubkey().to_bytes());
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new_readonly(authority.pubkey(), true),
                    AccountMeta::new(config.0, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Create a publisher's buffer account.
        let mut data = vec![crate::instruction::Instruction::InitializePublisher as u8];
        data.extend_from_slice(&publisher.pubkey().to_bytes());
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new(authority.pubkey(), true),
                    AccountMeta::new_readonly(config.0, false),
                    AccountMeta::new(buffer.0, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&authority.pubkey()),
        );
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        let header = PublisherPricesHeader::new(publisher.pubkey().to_bytes());
        let header = bytes_of(&header);

        {
            // Validate the Allocation
            let buffer = banks_client.get_account(buffer.0).await.unwrap().unwrap();
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
        transaction.sign(&[&authority], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Publish some prices.
        let mut data = vec![crate::instruction::Instruction::SubmitPrices as u8];
        let prices = [
            PublisherPrice::new(1, 2, 200, 3).unwrap(),
            PublisherPrice::new(2, 3, 300, 4).unwrap(),
        ];
        data.extend_from_slice(&cast_slice(&prices));
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new(publisher.pubkey(), true),
                    AccountMeta::new(buffer.0, false),
                ],
            }],
            Some(&publisher.pubkey()),
        );
        transaction.sign(&[&publisher], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        {
            // Validate the Allocation
            let buffer = banks_client.get_account(buffer.0).await.unwrap().unwrap();
            assert_eq!(buffer.owner, id);
            let (out_header, out_prices) = accounts::publisher_prices::read(&buffer.data).unwrap();

            assert_eq!(&out_header.publisher, &publisher.pubkey().to_bytes());
            assert_eq!({ out_header.num_prices }, 2);
            assert_ne!({ out_header.slot }, 0);
            assert_eq!(&prices[..], out_prices);
        }
    }
}
