use {
    super::{validate_config, validate_payer, validate_system, CONFIG_SEED},
    crate::accounts,
    bytemuck::{try_from_bytes, Pod, Zeroable},
    solana_program::program_error::ProgramError,
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program::invoke_signed,
        pubkey::Pubkey, rent::Rent, system_instruction, sysvar::Sysvar,
    },
};

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct Args {
    pub authority: Pubkey,
}

pub fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let args: &Args = try_from_bytes(data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let mut accounts = accounts.iter();
    let payer = validate_payer(accounts.next())?;
    let config = validate_config(accounts.next(), program_id, true)?;
    let system = validate_system(accounts.next())?;

    let lamports = (Rent::get()?).minimum_balance(accounts::config::SIZE);

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            config.0.key,
            lamports,
            accounts::config::SIZE
                .try_into()
                .expect("unexpected overflow"),
            program_id,
        ),
        &[payer.clone(), config.0.clone(), system.clone()],
        &[&[CONFIG_SEED.as_bytes(), &[config.1]]],
    )?;

    accounts::config::create(*config.0.data.borrow_mut(), args.authority.to_bytes())?;

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
            processor!(crate::entrypoint::process_instruction),
        )
        .start()
        .await;

        // Setup Accounts
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_bytes()], &id);
        let mut authority = [0u8; 32];
        authority[..3].copy_from_slice(&[1, 2, 3]);

        let mut data = vec![crate::instruction::Instruction::Initialize as u8];
        data.extend_from_slice(&authority);

        // Execute Transaction
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(config.0, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Validate Outcome
        let config = banks_client.get_account(config.0).await.unwrap().unwrap();
        assert_eq!(config.lamports, 1141440);
        assert_eq!(config.owner, id);
        let config = accounts::config::read(&config.data).unwrap();
        assert_eq!(config.authority, authority);
    }
}
