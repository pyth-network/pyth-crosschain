use {
    crate::{
        accounts,
        instruction::{InitializeArgs, CONFIG_SEED},
        validate::{validate_config, validate_payer, validate_system},
    },
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed,
        pubkey::Pubkey, rent::Rent, system_instruction, sysvar::Sysvar,
    },
};

/// Creates a config account that stores the authority pubkey.
/// The authority is the account that will be allowed to modify publisher configs.
/// See `Instruction` for the list of required accounts.
/// The config account must be a non-existing PDA account with an expected seed.
pub fn initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitializeArgs,
) -> ProgramResult {
    let mut accounts = accounts.iter();
    let payer = validate_payer(accounts.next())?;
    let config = validate_config(accounts.next(), args.config_bump, program_id, true)?;
    let system = validate_system(accounts.next())?;

    let lamports = (Rent::get()?).minimum_balance(accounts::config::SIZE);

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            config.key,
            lamports,
            accounts::config::SIZE
                .try_into()
                .expect("unexpected overflow"),
            program_id,
        ),
        &[payer.clone(), config.clone(), system.clone()],
        &[&[CONFIG_SEED.as_bytes(), &[args.config_bump]]],
    )?;

    accounts::config::create(*config.data.borrow_mut(), args.authority)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        crate::{accounts, instruction::CONFIG_SEED},
        solana_program::{
            instruction::{AccountMeta, Instruction},
            pubkey::Pubkey,
            system_program,
        },
        solana_program_test::*,
        solana_sdk::{signature::Signer, transaction::Transaction},
    };

    #[tokio::test]
    async fn test_initialize() {
        // Initialize ProgramTest
        let id = Pubkey::new_unique();
        let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
            "publishers",
            id,
            processor!(crate::processor::process_instruction),
        )
        .start()
        .await;

        // Setup Accounts
        let (config, config_bump) = Pubkey::find_program_address(&[CONFIG_SEED.as_bytes()], &id);
        let mut authority = [0u8; 32];
        authority[..3].copy_from_slice(&[1, 2, 3]);

        let mut data = vec![
            crate::instruction::Instruction::Initialize as u8,
            config_bump,
        ];
        data.extend_from_slice(&authority);

        // Execute Transaction
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(config, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Validate Outcome
        let config = banks_client.get_account(config).await.unwrap().unwrap();
        assert_eq!(config.lamports, 1141440);
        assert_eq!(config.owner, id);
        let config = accounts::config::read(&config.data).unwrap();
        assert_eq!(config.authority, authority);
    }
}
