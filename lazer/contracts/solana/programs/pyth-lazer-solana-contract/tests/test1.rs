use {
    anchor_lang::{prelude::AccountMeta, InstructionData},
    pyth_lazer_solana_contract::ed25519_program_args,
    solana_program_test::{BanksClient, ProgramTest},
    solana_sdk::{
        ed25519_program, hash::Hash, instruction::Instruction, pubkey::Pubkey, signature::Keypair,
        signer::Signer, system_instruction, system_program, system_transaction, sysvar,
        transaction::Transaction,
    },
    std::env,
};

struct Setup {
    banks_client: BanksClient,
    payer: Keypair,
    recent_blockhash: Hash,
}

impl Setup {
    async fn new() -> Self {
        if env::var("SBF_OUT_DIR").is_err() {
            env::set_var(
                "SBF_OUT_DIR",
                format!(
                    "{}/../../../../target/sbf-solana-solana/release",
                    env::var("CARGO_MANIFEST_DIR").unwrap()
                ),
            );
        }
        println!("if add_program fails, run `cargo build-sbf` first.");
        let program_test = ProgramTest::new(
            "pyth_lazer_solana_contract",
            pyth_lazer_solana_contract::ID,
            None,
        );
        let (banks_client, payer, recent_blockhash) = program_test.start().await;
        Self {
            banks_client,
            payer,
            recent_blockhash,
        }
    }

    async fn create_treasury(&mut self) -> Pubkey {
        let treasury =
            Pubkey::create_with_seed(&self.payer.pubkey(), "treasury", &system_program::ID)
                .unwrap();

        let mut transaction_create_treasury = Transaction::new_with_payer(
            &[system_instruction::create_account_with_seed(
                &self.payer.pubkey(),
                &treasury,
                &self.payer.pubkey(),
                "treasury",
                10_000_000,
                0,
                &system_program::ID,
            )],
            Some(&self.payer.pubkey()),
        );
        transaction_create_treasury.sign(&[&self.payer], self.recent_blockhash);
        self.banks_client
            .process_transaction(transaction_create_treasury)
            .await
            .unwrap();
        treasury
    }

    async fn set_trusted(&mut self, verifying_key: Pubkey) {
        let mut transaction_set_trusted = Transaction::new_with_payer(
            &[Instruction::new_with_bytes(
                pyth_lazer_solana_contract::ID,
                &pyth_lazer_solana_contract::instruction::Update {
                    trusted_signer: verifying_key,
                    expires_at: i64::MAX,
                }
                .data(),
                vec![
                    AccountMeta::new(self.payer.pubkey(), true),
                    AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                ],
            )],
            Some(&self.payer.pubkey()),
        );
        transaction_set_trusted.sign(&[&self.payer], self.recent_blockhash);
        self.banks_client
            .process_transaction(transaction_set_trusted)
            .await
            .unwrap();
    }

    async fn verify_message(&mut self, message: &[u8], treasury: Pubkey) {
        // Instruction #0 will be ed25519 instruction;
        // Instruction #1 will be our contract instruction.
        let instruction_index = 1;
        // 8 bytes for Anchor header, 4 bytes for Vec length.
        let message_offset = 12;
        let ed25519_args = dbg!(pyth_lazer_solana_contract::Ed25519SignatureOffsets::new(
            message,
            instruction_index,
            message_offset,
        ));

        let treasury_starting_lamports = self
            .banks_client
            .get_account(treasury)
            .await
            .unwrap()
            .unwrap()
            .lamports;
        let mut transaction_verify = Transaction::new_with_payer(
            &[
                Instruction::new_with_bytes(
                    ed25519_program::ID,
                    &ed25519_program_args(&[ed25519_args]),
                    vec![],
                ),
                Instruction::new_with_bytes(
                    pyth_lazer_solana_contract::ID,
                    &pyth_lazer_solana_contract::instruction::VerifyMessage {
                        message_data: message.to_vec(),
                        ed25519_instruction_index: 0,
                        signature_index: 0,
                        message_offset,
                    }
                    .data(),
                    vec![
                        AccountMeta::new(self.payer.pubkey(), true),
                        AccountMeta::new_readonly(pyth_lazer_solana_contract::STORAGE_ID, false),
                        AccountMeta::new(treasury, false),
                        AccountMeta::new_readonly(system_program::ID, false),
                        AccountMeta::new_readonly(sysvar::instructions::ID, false),
                    ],
                ),
            ],
            Some(&self.payer.pubkey()),
        );
        transaction_verify.sign(&[&self.payer], self.recent_blockhash);
        self.banks_client
            .process_transaction(transaction_verify)
            .await
            .unwrap();

        assert_eq!(
            self.banks_client
                .get_account(treasury)
                .await
                .unwrap()
                .unwrap()
                .lamports,
            treasury_starting_lamports + 1,
        );
    }
}

#[tokio::test]
async fn test_with_init_v2() {
    let mut setup = Setup::new().await;
    let treasury = setup.create_treasury().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::InitializeV2 {
                top_authority: setup.payer.pubkey(),
                treasury,
            }
            .data(),
            vec![
                AccountMeta::new(setup.payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&setup.payer.pubkey()),
    );
    transaction_init_contract.sign(&[&setup.payer], setup.recent_blockhash);
    setup
        .banks_client
        .process_transaction(transaction_init_contract)
        .await
        .unwrap();

    let verifying_key =
        hex::decode("74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214").unwrap();
    let message = hex::decode(
        "b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307\
        afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc61\
        7b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000",
    )
    .unwrap();

    setup.set_trusted(verifying_key.try_into().unwrap()).await;
    setup.verify_message(&message, treasury).await;
}

#[tokio::test]
async fn test_with_init_v1_and_migrate() {
    let mut setup = Setup::new().await;
    let treasury = setup.create_treasury().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::InitializeV1 {
                top_authority: setup.payer.pubkey(),
            }
            .data(),
            vec![
                AccountMeta::new(setup.payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&setup.payer.pubkey()),
    );
    transaction_init_contract.sign(&[&setup.payer], setup.recent_blockhash);
    setup
        .banks_client
        .process_transaction(transaction_init_contract)
        .await
        .unwrap();

    let tx_transfer = system_transaction::transfer(
        &setup.payer,
        &pyth_lazer_solana_contract::STORAGE_ID,
        500_000,
        setup.recent_blockhash,
    );
    setup
        .banks_client
        .process_transaction(tx_transfer)
        .await
        .unwrap();

    let mut transaction_migrate_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::MigrateToStorageV2 { treasury }.data(),
            vec![
                AccountMeta::new(setup.payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&setup.payer.pubkey()),
    );
    transaction_migrate_contract.sign(&[&setup.payer], setup.recent_blockhash);
    setup
        .banks_client
        .process_transaction(transaction_migrate_contract)
        .await
        .unwrap();

    let verifying_key =
        hex::decode("74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214").unwrap();
    let message = hex::decode(
        "b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307\
        afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc61\
        7b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000",
    )
    .unwrap();

    setup.set_trusted(verifying_key.try_into().unwrap()).await;
    setup.verify_message(&message, treasury).await;
}
