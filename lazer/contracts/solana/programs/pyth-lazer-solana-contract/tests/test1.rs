use {
    anchor_lang::{prelude::AccountMeta, InstructionData},
    pyth_lazer_solana_contract::{ed25519_program_args, ANCHOR_DISCRIMINATOR_BYTES},
    solana_program_test::{BanksClient, BanksClientError, ProgramTest},
    solana_sdk::{
        account::Account,
        ed25519_program,
        hash::Hash,
        instruction::{Instruction, InstructionError},
        pubkey::{Pubkey, PUBKEY_BYTES},
        signature::Keypair,
        signer::Signer,
        system_instruction, system_program, system_transaction, sysvar,
        transaction::{Transaction, TransactionError},
    },
    std::env,
};

fn program_test() -> ProgramTest {
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
    ProgramTest::new(
        "pyth_lazer_solana_contract",
        pyth_lazer_solana_contract::ID,
        None,
    )
}

struct Setup {
    banks_client: BanksClient,
    payer: Keypair,
    recent_blockhash: Hash,
}

impl Setup {
    async fn with_program_test(program_test: ProgramTest) -> Self {
        let (banks_client, payer, recent_blockhash) = program_test.start().await;
        Self {
            banks_client,
            payer,
            recent_blockhash,
        }
    }

    async fn new() -> Self {
        Self::with_program_test(program_test()).await
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
        let treasury_starting_lamports = self
            .banks_client
            .get_account(treasury)
            .await
            .unwrap()
            .unwrap()
            .lamports;

        // 8 bytes for Anchor header, 4 bytes for Vec length.
        self.verify_message_with_offset(message, treasury, 12)
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

    async fn verify_message_with_offset(
        &mut self,
        message: &[u8],
        treasury: Pubkey,
        message_offset: u16,
    ) -> Result<(), BanksClientError> {
        // Instruction #0 will be ed25519 instruction;
        // Instruction #1 will be our contract instruction.
        let instruction_index = 1;
        let ed25519_args = dbg!(pyth_lazer_solana_contract::Ed25519SignatureOffsets::new(
            message,
            instruction_index,
            message_offset,
        ));

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
    }
}

#[tokio::test]
async fn test_basic() {
    let mut setup = Setup::new().await;
    let treasury = setup.create_treasury().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::Initialize {
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
async fn test_rejects_wrong_offset() {
    let mut setup = Setup::new().await;
    let treasury = setup.create_treasury().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::Initialize {
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
    let verifying_key_2 =
        hex::decode("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").unwrap();
    let message = hex::decode(
        [
            // --- First copy of the message (this data is returned by the Lazer contract)

            // SOLANA_FORMAT_MAGIC_LE
            "b9011a82",
            // Signature
            "e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c600",
            // Pubkey
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            // Payload length (could be adjusted)
            "1c00",
            // Payload
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",

            // --- Second copy of the message (this data is used by the ed25519 program)

            // Unused, was SOLANA_FORMAT_MAGIC_LE, could be removed, left it for slightly easier offset adjustments
            "AABBCCDD",
            // Signature
            "e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c600",
            // Pubkey
            "74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214",
            // Payload length
            "1c00",
            // Payload
            "75d3c7931c9773f30a240600010102000000010000e1f50500000000"
        ].concat()
    )
    .unwrap();

    setup.set_trusted(verifying_key.try_into().unwrap()).await;
    setup.set_trusted(verifying_key_2.try_into().unwrap()).await;
    let err = setup
        .verify_message_with_offset(&message, treasury, 12 + 130)
        .await
        .unwrap_err();
    assert!(matches!(
        err,
        BanksClientError::TransactionError(TransactionError::InstructionError(
            1,
            InstructionError::InvalidInstructionData
        ))
    ));
}

#[tokio::test]
async fn test_migrate_from_0_1_0() {
    let mut program_test = program_test();
    // Create a storage PDA account with the data that was produced by the program v0.1.0.
    let mut old_storage_data = hex::decode(
        "d175ffb9c4af4409aa4dcb5d31150b162b664abd843cb231cee5c0ebf759ce371d9cb36ffc653796\
        0174313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214ffffffffffffff7\
        f00000000000000000000000000000000000000000000000000000000000000000000000000000000",
    )
    .unwrap();
    let top_authority = Keypair::new();
    // Replace top authority pubkey in storage PDA data to allow successful migration.
    old_storage_data[ANCHOR_DISCRIMINATOR_BYTES..ANCHOR_DISCRIMINATOR_BYTES + PUBKEY_BYTES]
        .copy_from_slice(&top_authority.pubkey().to_bytes());
    program_test.add_account(
        pyth_lazer_solana_contract::STORAGE_ID,
        Account {
            lamports: 1733040,
            data: old_storage_data,
            owner: pyth_lazer_solana_contract::ID,
            executable: false,
            rent_epoch: 18446744073709551615,
        },
    );
    let mut setup = Setup::with_program_test(program_test).await;
    let treasury = setup.create_treasury().await;

    // Make sure storage PDA will be rent-exempt after resize.
    let tx_transfer = system_transaction::transfer(
        &setup.payer,
        &pyth_lazer_solana_contract::STORAGE_ID,
        10_000_000,
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
            &pyth_lazer_solana_contract::instruction::MigrateFrom010 { treasury }.data(),
            vec![
                AccountMeta::new(top_authority.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&setup.payer.pubkey()),
    );
    transaction_migrate_contract.sign(&[&setup.payer, &top_authority], setup.recent_blockhash);
    setup
        .banks_client
        .process_transaction(transaction_migrate_contract)
        .await
        .unwrap();

    let message = hex::decode(
        "b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307\
        afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc61\
        7b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000",
    )
    .unwrap();

    // The contract will recognize the trusted signer without calling `set_trusted`
    // because it was present in the original storage PDA data.
    setup.verify_message(&message, treasury).await;
}

#[tokio::test]
async fn test_disallows_extra_migrate() {
    let mut setup = Setup::new().await;
    let treasury = setup.create_treasury().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::Initialize {
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

    let mut transaction_migrate_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::MigrateFrom010 { treasury }.data(),
            vec![
                AccountMeta::new(setup.payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&setup.payer.pubkey()),
    );
    transaction_migrate_contract.sign(&[&setup.payer], setup.recent_blockhash);
    let err = setup
        .banks_client
        .process_transaction(transaction_migrate_contract)
        .await
        .unwrap_err();
    assert!(matches!(
        err,
        BanksClientError::TransactionError(TransactionError::InstructionError(
            0,
            InstructionError::InvalidAccountData
        ))
    ));
}
