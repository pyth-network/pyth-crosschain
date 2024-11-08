use {
    borsh::BorshDeserialize,
    solana_program::{
        hash::Hash,
        instruction::{Instruction, InstructionError},
        native_token::LAMPORTS_PER_SOL,
        program_error::ProgramError,
        pubkey::Pubkey,
        system_instruction,
    },
    solana_program_test::{BanksClient, BanksClientError, ProgramTest, ProgramTestBanksClientExt},
    solana_sdk::{
        clock::Clock,
        compute_budget,
        signature::{Keypair, Signer},
        transaction::{Transaction, TransactionError},
    },
};

pub struct ProgramSimulator {
    banks_client: BanksClient,
    /// Hash used to submit the last transaction. The hash must be advanced for each new
    /// transaction; otherwise, replayed transactions in different states can return stale
    /// results.
    last_blockhash: Hash,
    genesis_keypair: Keypair,
}

impl ProgramSimulator {
    pub async fn start_from_program_test(program_test: ProgramTest) -> ProgramSimulator {
        let (banks_client, genesis_keypair, recent_blockhash) = program_test.start().await;
        ProgramSimulator {
            banks_client,
            genesis_keypair,
            last_blockhash: recent_blockhash,
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
            .banks_client
            .get_new_latest_blockhash(&self.last_blockhash)
            .await
            .unwrap();
        self.last_blockhash = blockhash;

        transaction.partial_sign(&[actual_payer], self.last_blockhash);
        transaction.partial_sign(signers, self.last_blockhash);

        self.banks_client.process_transaction(transaction).await
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
            .banks_client
            .get_account(pubkey)
            .await
            .unwrap()
            .unwrap();

        Ok(T::deserialize(&mut &account.data[8..])?)
    }

    pub async fn get_balance(&mut self, pubkey: Pubkey) -> Result<u64, BanksClientError> {
        let lamports = self.banks_client.get_balance(pubkey).await.unwrap();
        Ok(lamports)
    }

    pub async fn get_clock(&mut self) -> Result<Clock, BanksClientError> {
        self.banks_client.get_sysvar::<Clock>().await
    }
}

pub fn into_transaction_error<T: Into<anchor_lang::prelude::Error>>(error: T) -> TransactionError {
    TransactionError::InstructionError(
        0,
        InstructionError::try_from(u64::from(ProgramError::from(error.into()))).unwrap(),
    )
}
