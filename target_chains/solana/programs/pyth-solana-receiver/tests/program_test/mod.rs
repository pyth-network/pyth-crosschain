use {
    pyth_solana_receiver::ID,
    solana_bpf_loader_program::process_instruction,
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
        ProgramTestContext,
    },
    solana_sdk::{
        account::{
            Account,
            AccountSharedData,
        },
        account_utils::StateMut,
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
    pub async fn setup_test_context() -> ProgramTestContext {
        let program_test =
            ProgramTest::new("", bpf_loader_upgradeable::ID, Some(process_instruction));
        program_test.start_with_context().await
    }
    /// Deploys the target chain contract as upgradable
    pub async fn new() -> ProgramSimulator {
        // let mut program_test = ProgramTest::new("pyth_solana_receiver", ID, None);
        //
        // let upgrade_authority_keypair = Keypair::new();
        // let mut program_test = Self::setup_test_context().await;
        // let program_file =
        //     find_file("pyth_solana_receiver.so").expect("Failed to locate program file");
        // let mut bpf_data = read_file(program_file);
        let mut bpf_data = read_file(
            std::env::current_dir()
                .unwrap()
                .join(Path::new("../../target/deploy/pyth_solana_receiver.so")),
        );
        println!("got bpf data");

        let mut program_test = ProgramTest::default();
        // let mut program_test =
        //     ProgramTest::new("", bpf_loader_upgradeable::ID, Some(process_instruction));

        println!("created program_test");

        let program_key = Pubkey::try_from(ID).unwrap();
        // This PDA is the actual address in the real world
        // https://docs.rs/solana-program/1.6.4/solana_program/bpf_loader_upgradeable/index.html
        let (programdata_address, _) =
            Pubkey::find_program_address(&[&program_key.to_bytes()], &bpf_loader_upgradeable::id());

        let upgrade_authority_keypair = Keypair::new();

        let program_deserialized = UpgradeableLoaderState::Program {
            programdata_address,
        };
        let programdata_deserialized = UpgradeableLoaderState::ProgramData {
            slot:                      1,
            upgrade_authority_address: Some(upgrade_authority_keypair.pubkey()),
        };
        //
        // // Program contains a pointer to progradata
        let program_vec = bincode::serialize(&program_deserialized).unwrap();
        // Programdata contains a header and the binary of the program
        let mut programdata_vec = bincode::serialize(&programdata_deserialized).unwrap();
        programdata_vec.append(&mut bpf_data);

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
        //
        // // Add to both accounts to program test, now the program is deploy as upgradable
        program_test.add_account(program_key, program_account);
        program_test.add_account(programdata_address, programdata_account);

        // Start validator
        // let (banks_client, genesis_keypair, recent_blockhash) = program_test.start().await;

        let program_test_context = program_test.start_with_context().await;
        println!("started program test context");

        // Self::add_upgradeable_loader_account(
        //     &mut program_test_context,
        //     &pyth_solana_receiver::ID,
        //     &UpgradeableLoaderState::Program {
        //         programdata_address,
        //     },
        //     UpgradeableLoaderState::size_of_program(),
        //     |_| {},
        // )
        // .await;
        // let programdata_data_offset = UpgradeableLoaderState::size_of_programdata_metadata();
        // let program_data_len = UpgradeableLoaderState::size_of_programdata(bpf_data.len());
        // Self::add_upgradeable_loader_account(
        //     &mut program_test_context,
        //     &programdata_address,
        //     &UpgradeableLoaderState::ProgramData {
        //         slot: 0,
        //         upgrade_authority_address: Some(upgrade_authority_keypair.pubkey()),
        //     },
        //     program_data_len,
        //     |account| {
        //         account.data_as_mut_slice()[programdata_data_offset..].copy_from_slice(&bpf_data)
        //     },
        // )
        // .await;
        // let genesis_keypair_filepath = Self::keypair_filepath("genesis_keypair");
        // println!("genesis_keypair_filepath: {:?}", genesis_keypair_filepath);
        //
        // program_test_context
        //     .payer
        //     .write_to_file(genesis_keypair_filepath)
        //     .unwrap();
        // println!("wrote genesis keypair to file");
        //
        // let upgrade_authority_keypair_filepath = Self::keypair_filepath("upgrade_authority");
        // upgrade_authority_keypair
        //     .write_to_file(upgrade_authority_keypair_filepath)
        //     .unwrap();
        // println!("wrote genesis keypair to file");

        let mut result = ProgramSimulator {
            program_id:        pyth_solana_receiver::ID,
            banks_client:      program_test_context.banks_client,
            last_blockhash:    program_test_context.last_blockhash,
            upgrade_authority: upgrade_authority_keypair,
            genesis_keypair:   program_test_context.payer,
        };

        // let mut result = ProgramSimulator {
        //     program_id: pyth_solana_receiver::ID,
        //     banks_client,
        //     last_blockhash: recent_blockhash,
        //     upgrade_authority: upgrade_authority_keypair,
        //     genesis_keypair,
        // };

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

    pub async fn add_upgradeable_loader_account(
        context: &mut ProgramTestContext,
        account_address: &Pubkey,
        account_state: &UpgradeableLoaderState,
        account_data_len: usize,
        account_callback: impl Fn(&mut AccountSharedData),
    ) {
        let rent = context.banks_client.get_rent().await.unwrap();
        let mut account = AccountSharedData::new(
            rent.minimum_balance(account_data_len),
            account_data_len,
            &bpf_loader_upgradeable::ID,
        );
        account
            .set_state(account_state)
            .expect("state failed to serialize into account data");
        account_callback(&mut account);
        context.set_account(account_address, &account);
    }

    // pub fn keypair_filepath(keypair_name: &str) -> PathBuf {
    //     let mut tmp_keypath_dir = std::env::current_dir()
    //         .unwrap()
    //         .join(Path::new("../../target/tmp"));
    //     tmp_keypath_dir.push(format!("{}.json", keypair_name));
    //     tmp_keypath_dir
    // }
}
