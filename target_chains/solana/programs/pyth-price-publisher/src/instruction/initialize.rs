//! Initialize Instruction
//!
//! The Initialize instruction sets up the Publisher price bridge with a rent
//! vault that can pay for the creation of Publisher accounts. The payer will
//! do the initial funding of the vault, future topups can be done simply by
//! sending tokens from any account to the vault.
//!
use {
    super::{
        validate_payer,
        validate_system,
        validate_vault,
        Instruction,
        VAULT_SEED,
    },
    crate::ensure,
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

pub fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let mut accounts = accounts.into_iter();
    let payer = validate_payer(accounts.next())?;
    let vault = validate_vault(accounts.next(), program_id)?;
    let system = validate_system(accounts.next())?;
    initialize_vault(vault, payer, system, program_id)
}

fn initialize_vault<'a>(
    (vault, vault_bump): (AccountInfo<'a>, u8),
    payer: AccountInfo<'a>,
    system: AccountInfo<'a>,
    program_id: &Pubkey,
) -> ProgramResult {
    // Calculate minimum lamports to transfer to initialize the account.
    let lamports = (Rent::get()?).minimum_balance(0);

    // By Initializing the account with `create_account` it will be owned by
    // the system account, system accounts are allowed to act as payers. This
    // is the trick we use to use the PDA as a payer later.
    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            vault.key,
            lamports,
            0,
            &solana_program::system_program::id(),
        ),
        &[payer.clone(), vault.clone(), system.clone()],
        &[&[VAULT_SEED.as_bytes(), &[vault_bump]]],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use {
        super::initialize,
        crate::{
            instruction::VAULT_SEED,
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
    async fn test_initialize() {
        // Initialize ProgramTest
        let id = Pubkey::new_unique();
        let (mut banks_client, payer, recent_blockhash) =
            ProgramTest::new("publishers", id, processor!(crate::process_instruction))
                .start()
                .await;

        // Setup Accounts
        let vault = Pubkey::find_program_address(&[VAULT_SEED.as_bytes()], &id);

        // Execute Transaction
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id: id,
                data:       vec![crate::instruction::Instruction::Initialize as u8],
                accounts:   vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(vault.0, false),
                    AccountMeta::new(system_program::id(), false),
                ],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);
        banks_client.process_transaction(transaction).await.unwrap();

        // Validate Outcome
        let vault = banks_client.get_account(vault.0).await.unwrap().unwrap();
        assert_eq!(vault.lamports, 890880);
        assert_eq!(vault.owner, system_program::id());
    }
}
