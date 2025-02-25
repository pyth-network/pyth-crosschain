use {
    anchor_lang::{prelude::AccountMeta, InstructionData},
    pyth_lazer_solana_contract::{ed25519_program_args, EvmAddress},
    solana_program_test::{BanksClient, BanksClientError, ProgramTest},
    solana_sdk::{
        ed25519_program,
        hash::Hash,
        instruction::{Instruction, InstructionError},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        system_instruction, system_program, sysvar,
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
    treasury: Pubkey,
}

impl Setup {
    async fn with_program_test(program_test: ProgramTest) -> Self {
        let (banks_client, payer, recent_blockhash) = program_test.start().await;
        let mut setup = Self {
            treasury: Pubkey::create_with_seed(&payer.pubkey(), "treasury", &system_program::ID)
                .unwrap(),
            banks_client,
            payer,
            recent_blockhash,
        };
        setup.create_treasury().await;
        setup
    }

    async fn new() -> Self {
        Self::with_program_test(program_test()).await
    }

    async fn create_treasury(&mut self) {
        let mut transaction_create_treasury = Transaction::new_with_payer(
            &[system_instruction::create_account_with_seed(
                &self.payer.pubkey(),
                &self.treasury,
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
    }

    async fn init_contract(&mut self) {
        let mut transaction_init_contract = Transaction::new_with_payer(
            &[Instruction::new_with_bytes(
                pyth_lazer_solana_contract::ID,
                &pyth_lazer_solana_contract::instruction::Initialize {
                    top_authority: self.payer.pubkey(),
                    treasury: self.treasury,
                }
                .data(),
                vec![
                    AccountMeta::new(self.payer.pubkey(), true),
                    AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                    AccountMeta::new_readonly(system_program::ID, false),
                ],
            )],
            Some(&self.payer.pubkey()),
        );
        transaction_init_contract.sign(&[&self.payer], self.recent_blockhash);
        self.banks_client
            .process_transaction(transaction_init_contract)
            .await
            .unwrap();
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

    async fn set_trusted_ecdsa(&mut self, verifying_key: EvmAddress) {
        let mut transaction_set_trusted = Transaction::new_with_payer(
            &[Instruction::new_with_bytes(
                pyth_lazer_solana_contract::ID,
                &pyth_lazer_solana_contract::instruction::UpdateEcdsaSigner {
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

    async fn verify_message(&mut self, message: &[u8]) {
        let treasury_starting_lamports = self
            .banks_client
            .get_account(self.treasury)
            .await
            .unwrap()
            .unwrap()
            .lamports;

        // 8 bytes for Anchor header, 4 bytes for Vec length.
        self.verify_message_with_offset(message, 12).await.unwrap();

        assert_eq!(
            self.banks_client
                .get_account(self.treasury)
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
                        AccountMeta::new(self.treasury, false),
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

    async fn verify_message_ecdsa(&mut self, message: &[u8]) {
        let treasury_starting_lamports = self
            .banks_client
            .get_account(self.treasury)
            .await
            .unwrap()
            .unwrap()
            .lamports;

        let mut transaction_verify = Transaction::new_with_payer(
            &[Instruction::new_with_bytes(
                pyth_lazer_solana_contract::ID,
                &pyth_lazer_solana_contract::instruction::VerifyEcdsaMessage {
                    message_data: message.to_vec(),
                }
                .data(),
                vec![
                    AccountMeta::new(self.payer.pubkey(), true),
                    AccountMeta::new_readonly(pyth_lazer_solana_contract::STORAGE_ID, false),
                    AccountMeta::new(self.treasury, false),
                    AccountMeta::new_readonly(system_program::ID, false),
                ],
            )],
            Some(&self.payer.pubkey()),
        );
        transaction_verify.sign(&[&self.payer], self.recent_blockhash);
        self.banks_client
            .process_transaction(transaction_verify)
            .await
            .unwrap();

        assert_eq!(
            self.banks_client
                .get_account(self.treasury)
                .await
                .unwrap()
                .unwrap()
                .lamports,
            treasury_starting_lamports + 1,
        );
    }
}

#[tokio::test]
async fn test_basic() {
    let mut setup = Setup::new().await;
    setup.init_contract().await;

    let verifying_key =
        hex::decode("74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214").unwrap();
    let message = hex::decode(
        "b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307\
        afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc61\
        7b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000",
    )
    .unwrap();

    setup.set_trusted(verifying_key.try_into().unwrap()).await;
    setup.verify_message(&message).await;
}

#[tokio::test]
async fn test_alignment() {
    let mut setup = Setup::new().await;
    setup.init_contract().await;

    let verifying_key =
        hex::decode("f65210bee4fcf5b1cee1e537fabcfd95010297653b94af04d454fc473e94834f").unwrap();
    let message = hex::decode(
        "b9011a82d100f6ce88ef26fd5a74312b4bb19e18e74162ffbfe66a7204c6f7ee9085ad6b670ec96d167cfef\
        ad437a1c79e67c75581c5cf99e64e680a1badeb3d88733d02f65210bee4fcf5b1cee1e537fabcfd950102976\
        53b94af04d454fc473e94834f770075d3c79340d609f7652c06000303010000000400305680106309000002a\
        023551b6309000001a62ab3056309000004f8ff02000000040021ae69754b00000002a04b8f764b000000018\
        8b24b744b00000004f8ff060000000400377180d00500000002f2c19dd0050000000162c26ad00500000004f8ff",
    )
    .unwrap();

    setup.set_trusted(verifying_key.try_into().unwrap()).await;
    setup.verify_message(&message).await;
}

#[tokio::test]
async fn test_rejects_wrong_offset() {
    let mut setup = Setup::new().await;
    setup.init_contract().await;

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
        .verify_message_with_offset(&message, 12 + 130)
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
async fn test_ecdsa() {
    let mut setup = Setup::new().await;
    setup.init_contract().await;

    let verifying_key = hex::decode("b8d50f0bae75bf6e03c104903d7c3afc4a6596da").unwrap();
    let message = hex::decode(
        "e4bd474dd4b822eca4509650613e58b21db858e60750ab3498d4a484028785981740adf42cd558bb4f9efd5157bcbb60a1939470ead091b82b63641ad962c7a537db4eb300310075d3c793c0afe900e42e060003010100000004000054e616b201000004f8ff020035dc1cb2010000010073f010b2010000",
    )
    .unwrap();

    setup
        .set_trusted_ecdsa(verifying_key.try_into().unwrap())
        .await;
    setup.verify_message_ecdsa(&message).await;
}
