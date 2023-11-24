use {
    pyth_solana_receiver::ID,
    solana_program::{
        bpf_loader_upgradeable::{
            self,
            UpgradeableLoaderState,
        },
        hash::Hash,
        instruction::Instruction,
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
        rent::Rent,
        stake_history::Epoch,
        system_instruction,
    },
    solana_program_test::{
        read_file,
        BanksClient,
        BanksClientError,
        ProgramTest,
        ProgramTestBanksClientExt,
    },
    solana_sdk::{
        account::Account,
        signature::{
            Keypair,
            Signer,
        },
        transaction::Transaction,
    },
    std::path::Path,
};

/// Simulator for the state of the target chain program on Solana. You can run solana transactions against
/// this struct to test how pyth instructions execute in the Solana runtime.
pub struct ProgramSimulator {
    pub program_id:        Pubkey,
    banks_client:          BanksClient,
    /// Hash used to submit the last transaction. The hash must be advanced for each new
    /// transaction; otherwise, replayed transactions in different states can return stale
    /// results.
    last_blockhash:        Hash,
    pub upgrade_authority: Keypair,
    pub genesis_keypair:   Keypair,
}

impl ProgramSimulator {
    /// Deploys the target chain contract as upgradable
    pub async fn new() -> ProgramSimulator {
        let mut program_test = ProgramTest::new("pyth_solana_receiver", ID, None);

        let upgrade_authority_keypair = Keypair::new();

        // Start validator
        let (banks_client, genesis_keypair, recent_blockhash) = program_test.start().await;

        let mut result = ProgramSimulator {
            program_id: pyth_solana_receiver::ID,
            banks_client,
            last_blockhash: recent_blockhash,
            upgrade_authority: upgrade_authority_keypair,
            genesis_keypair,
        };

        // Transfer money to upgrade_authority so it can call the instructions
        result
            .airdrop(&result.upgrade_authority.pubkey(), 1000 * LAMPORTS_PER_SOL)
            .await
            .unwrap();

        result
    }

    /// Process a transaction containing `instruction` signed by `signers`.
    /// `payer` is used to pay for and sign the transaction.
    pub async fn process_ix(
        &mut self,
        instruction: Instruction,
        signers: &Vec<&Keypair>,
        payer: &Keypair,
    ) -> Result<(), BanksClientError> {
        let mut transaction = Transaction::new_with_payer(&[instruction], Some(&payer.pubkey()));

        let blockhash = self
            .banks_client
            .get_new_latest_blockhash(&self.last_blockhash)
            .await
            .unwrap();
        self.last_blockhash = blockhash;

        transaction.partial_sign(&[payer], self.last_blockhash);
        transaction.partial_sign(signers, self.last_blockhash);

        self.banks_client.process_transaction(transaction).await
    }

    /// Send `lamports` worth of SOL to the pubkey `to`.
    pub async fn airdrop(&mut self, to: &Pubkey, lamports: u64) -> Result<(), BanksClientError> {
        let instruction =
            system_instruction::transfer(&self.genesis_keypair.pubkey(), to, lamports);

        self.process_ix(instruction, &vec![], &self.genesis_keypair.insecure_clone())
            .await
    }
}
