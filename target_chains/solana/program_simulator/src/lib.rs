use {
    borsh::BorshDeserialize,
    solana_compute_budget_interface as compute_budget,
    solana_program::{
        hash::Hash,
        instruction::{Instruction, InstructionError},
        native_token::LAMPORTS_PER_SOL,
        program_error::ProgramError,
        pubkey::Pubkey,
    },
    solana_program_test::{
        BanksClientError, ProgramTest, ProgramTestBanksClientExt, ProgramTestContext,
    },
    solana_sdk::{
        account::Account,
        clock::Clock,
        signature::{Keypair, Signer},
        transaction::{Transaction, TransactionError},
    },
    solana_system_interface::instruction as system_instruction,
};

pub struct ProgramSimulator {
    context: ProgramTestContext,
    /// Hash used to submit the last transaction. The hash must be advanced for each new
    /// transaction; otherwise, replayed transactions in different states can return stale
    /// results.
    last_blockhash: Hash,
    genesis_keypair: Keypair,
}

impl ProgramSimulator {
    pub async fn start_from_program_test(program_test: ProgramTest) -> ProgramSimulator {
        let context = program_test.start_with_context().await;
        ProgramSimulator {
            genesis_keypair: context.payer.insecure_clone(),
            last_blockhash: context.last_blockhash,
            context,
        }
    }

    /// Process a transaction containing `instruction` signed by `signers`.
    /// `payer` is used to pay for and sign the transaction.
    pub async fn process_ix_with_default_compute_limit(
        &mut self,
        instruction: Instruction,
        signers: &Vec<&Keypair>,
        payer: Option<&Keypair>,
    ) -> Result<(), BanksClientError> {
        let compute_units_ixs =
            compute_budget::ComputeBudgetInstruction::set_compute_unit_limit(2000000);
        let actual_payer = payer.unwrap_or(&self.genesis_keypair);
        let mut transaction = Transaction::new_with_payer(
            &[instruction, compute_units_ixs],
            Some(&actual_payer.pubkey()),
        );

        let blockhash = self
            .context
            .banks_client
            .get_new_latest_blockhash(&self.last_blockhash)
            .await
            .unwrap();
        self.last_blockhash = blockhash;

        transaction.partial_sign(&[actual_payer], self.last_blockhash);
        transaction.partial_sign(signers, self.last_blockhash);

        self.context
            .banks_client
            .process_transaction(transaction)
            .await
    }

    /// Send `lamports` worth of SOL to the pubkey `to`.
    pub async fn airdrop(&mut self, to: &Pubkey, lamports: u64) -> Result<(), BanksClientError> {
        let instruction =
            system_instruction::transfer(&self.genesis_keypair.pubkey(), to, lamports);

        self.process_ix_with_default_compute_limit(instruction, &vec![], None)
            .await
    }

    pub async fn get_funded_keypair(&mut self) -> Result<Keypair, BanksClientError> {
        let keypair = Keypair::new();
        self.airdrop(&keypair.pubkey(), LAMPORTS_PER_SOL).await?;
        Ok(keypair)
    }

    pub async fn get_anchor_account_data<T: BorshDeserialize>(
        &mut self,
        pubkey: Pubkey,
    ) -> Result<T, BanksClientError> {
        let account = self
            .context
            .banks_client
            .get_account(pubkey)
            .await
            .unwrap()
            .unwrap();

        Ok(T::deserialize(&mut &account.data[8..])?)
    }

    /// Fetch the raw account at `pubkey`, or `None` if it does not exist.
    pub async fn get_account(
        &mut self,
        pubkey: Pubkey,
    ) -> Result<Option<Account>, BanksClientError> {
        self.context.banks_client.get_account(pubkey).await
    }

    pub async fn get_balance(&mut self, pubkey: Pubkey) -> Result<u64, BanksClientError> {
        let lamports = self.context.banks_client.get_balance(pubkey).await.unwrap();
        Ok(lamports)
    }

    /// Advance the bank by one slot. Programs deployed or upgraded in a slot only become
    /// executable in the slot after it, so an upgrade must be followed by this before the new
    /// code can be invoked.
    pub async fn advance_slot(&mut self) -> Result<(), BanksClientError> {
        let slot = self.get_clock().await?.slot;
        self.context.warp_to_slot(slot + 1).unwrap();
        Ok(())
    }

    pub async fn get_clock(&mut self) -> Result<Clock, BanksClientError> {
        self.context.banks_client.get_sysvar::<Clock>().await
    }
}

pub fn into_transaction_error<T: Into<anchor_lang::prelude::Error>>(error: T) -> TransactionError {
    TransactionError::InstructionError(
        0,
        InstructionError::from(u64::from(ProgramError::from(error.into()))),
    )
}
