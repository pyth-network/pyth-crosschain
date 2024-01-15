use {
    borsh::BorshDeserialize,
    solana_program::{
        hash::Hash,
        instruction::Instruction,
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
        system_instruction,
    },
    solana_program_test::{
        BanksClient,
        BanksClientError,
        ProgramTest,
        ProgramTestBanksClientExt,
    },
    solana_sdk::{
        signature::{
            Keypair,
            Signer,
        },
        transaction::Transaction,
    },
};

pub struct ProgramSimulator {
    banks_client:    BanksClient,
    /// Hash used to submit the last transaction. The hash must be advanced for each new
    /// transaction; otherwise, replayed transactions in different states can return stale
    /// results.
    last_blockhash:  Hash,
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
    pub async fn process_ix(
        &mut self,
        instruction: Instruction,
        signers: &Vec<&Keypair>,
        payer: Option<&Keypair>,
    ) -> Result<(), BanksClientError> {
        let actual_payer = payer.unwrap_or(&self.genesis_keypair);
        let mut transaction =
            Transaction::new_with_payer(&[instruction], Some(&actual_payer.pubkey()));

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

        self.process_ix(instruction, &vec![], None).await
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
        Ok(T::try_from_slice(&account.data[..8])?)
    }
}
