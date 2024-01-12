use {
    solana_program::{
        bpf_loader_upgradeable::{
            self,
            UpgradeableLoaderState,
        },
        hash::Hash,
        instruction::Instruction,
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


pub struct ProgramBench {
    program_test:      ProgramTest,
    upgrade_authority: Keypair,
}

impl ProgramBench {
    pub fn new() -> ProgramBench {
        let program_test = ProgramTest::default();
        let upgrade_authority = Keypair::new();
        ProgramBench {
            program_test,
            upgrade_authority,
        }
    }

    pub fn add_account(&mut self, pubkey: Pubkey, account: Account) {
        self.program_test.add_account(pubkey, account);
    }

    pub fn add_bpf_upgradable_program_from_path(&mut self, address: Pubkey, path: &Path) {
        let bpf_data = read_file(std::env::current_dir().unwrap().join(path));
        self.add_bpf_upgradable_program(address, bpf_data)
    }

    pub fn add_bpf_upgradable_program(&mut self, address: Pubkey, bpf_data: Vec<u8>) {
        let programdata_key = Pubkey::new_unique();
        let upgrade_authority_keypair = Keypair::new();

        let program_deserialized = UpgradeableLoaderState::Program {
            programdata_address: programdata_key,
        };
        let programdata_deserialized = UpgradeableLoaderState::ProgramData {
            slot:                      1,
            upgrade_authority_address: Some(upgrade_authority_keypair.pubkey()),
        };

        // Program contains a pointer to progradata
        let program_vec = bincode::serialize(&program_deserialized).unwrap();
        // Programdata contains a header and the binary of the program
        let mut programdata_vec = bincode::serialize(&programdata_deserialized).unwrap();
        programdata_vec.extend(bpf_data);

        let program_account = Account {
            lamports:   Rent::default().minimum_balance(program_vec.len()),
            data:       program_vec,
            owner:      bpf_loader_upgradeable::ID,
            executable: true,
            rent_epoch: Epoch::default(),
        };
        let programdata_account = Account {
            lamports:   Rent::default().minimum_balance(programdata_vec.len()),
            data:       programdata_vec,
            owner:      bpf_loader_upgradeable::ID,
            executable: false,
            rent_epoch: Epoch::default(),
        };

        // Add both accounts to program test, now the program is deployed as upgradable
        self.add_account(address, program_account);
        self.add_account(programdata_key, programdata_account);
    }

    pub async fn start(self) -> ProgramSimulator {
        // Start validator
        let (banks_client, genesis_keypair, recent_blockhash) = self.program_test.start().await;

        ProgramSimulator {
            banks_client,
            genesis_keypair,
            upgrade_authority: self.upgrade_authority,
            last_blockhash: recent_blockhash,
        }
    }
}

/// Simulator for the state of the target chain program on Solana. You can run solana transactions against
/// this struct to test how pyth instructions execute in the Solana runtime.
pub struct ProgramSimulator {
    banks_client:          BanksClient,
    /// Hash used to submit the last transaction. The hash must be advanced for each new
    /// transaction; otherwise, replayed transactions in different states can return stale
    /// results.
    last_blockhash:        Hash,
    pub upgrade_authority: Keypair,
    pub genesis_keypair:   Keypair,
}

impl ProgramSimulator {
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
}
