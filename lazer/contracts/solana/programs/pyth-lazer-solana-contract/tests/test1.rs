use {
    anchor_lang::{prelude::AccountMeta, InstructionData},
    pyth_lazer_solana_contract::ed25519_program_args,
    solana_program_test::ProgramTest,
    solana_sdk::{
        ed25519_program, instruction::Instruction, signer::Signer, system_program, sysvar,
        transaction::Transaction,
    },
    std::env,
};

#[tokio::test]
async fn test1() {
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
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let mut transaction_init_contract = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::Initialize {
                top_authority: payer.pubkey(),
            }
            .data(),
            vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
                AccountMeta::new(pyth_lazer_solana_contract::TREASURY_ID, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        )],
        Some(&payer.pubkey()),
    );
    transaction_init_contract.sign(&[&payer], recent_blockhash);
    banks_client
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

    let mut transaction_set_trusted = Transaction::new_with_payer(
        &[Instruction::new_with_bytes(
            pyth_lazer_solana_contract::ID,
            &pyth_lazer_solana_contract::instruction::Update {
                trusted_signer: verifying_key.try_into().unwrap(),
                expires_at: i64::MAX,
            }
            .data(),
            vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(pyth_lazer_solana_contract::STORAGE_ID, false),
            ],
        )],
        Some(&payer.pubkey()),
    );
    transaction_set_trusted.sign(&[&payer], recent_blockhash);
    banks_client
        .process_transaction(transaction_set_trusted)
        .await
        .unwrap();

    // Instruction #0 will be ed25519 instruction;
    // Instruction #1 will be our contract instruction.
    let instruction_index = 1;
    // 8 bytes for Anchor header, 4 bytes for Vec length.
    let message_offset = 12;
    let ed25519_args = dbg!(pyth_lazer_solana_contract::Ed25519SignatureOffsets::new(
        &message,
        instruction_index,
        message_offset,
    ));

    let treasury_starting_lamports = banks_client
        .get_account(pyth_lazer_solana_contract::TREASURY_ID)
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
                    message_data: message,
                    ed25519_instruction_index: 0,
                    signature_index: 0,
                    message_offset,
                }
                .data(),
                vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new_readonly(pyth_lazer_solana_contract::STORAGE_ID, false),
                    AccountMeta::new(pyth_lazer_solana_contract::TREASURY_ID, false),
                    AccountMeta::new_readonly(system_program::ID, false),
                    AccountMeta::new_readonly(sysvar::instructions::ID, false),
                ],
            ),
        ],
        Some(&payer.pubkey()),
    );
    transaction_verify.sign(&[&payer], recent_blockhash);
    banks_client
        .process_transaction(transaction_verify)
        .await
        .unwrap();
    assert_eq!(
        banks_client
            .get_account(pyth_lazer_solana_contract::TREASURY_ID)
            .await
            .unwrap()
            .unwrap()
            .lamports,
        treasury_starting_lamports + 1
    );
}
