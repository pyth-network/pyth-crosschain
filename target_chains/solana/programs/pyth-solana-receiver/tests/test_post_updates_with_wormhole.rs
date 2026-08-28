use {
    anchor_lang::{prelude::system_instruction, InstructionData, ToAccountMetas},
    common_test_utils::{default_receiver_config, DEFAULT_GUARDIAN_SET_INDEX},
    program_simulator::{into_transaction_error, ProgramSimulator},
    pyth_solana_receiver::{
        instruction::{Initialize, PostUpdate},
        sdk::{deserialize_accumulator_update_data, get_guardian_set_address, DEFAULT_TREASURY_ID},
    },
    pyth_solana_receiver_sdk::{
        config::Config,
        pda::get_config_address,
        price_update::{PriceUpdateV2, VerificationLevel},
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{
            create_accumulator_message, create_dummy_price_feed_message, dummy_guardians_addresses,
            trim_vaa_signatures,
        },
    },
    solana_program::instruction::Instruction,
    solana_program_test::ProgramTest,
    solana_sdk::{pubkey::Pubkey, rent::Rent, signature::Keypair, signer::Signer},
    wormhole_core_bridge_solana::{
        error::CoreBridgeError,
        sdk::{WriteEncodedVaaArgs, VAA_START},
        ID as BRIDGE_ID,
    },
};

fn get_verify_encoded_vaa_instruction(write_authority: Pubkey, draft_vaa: Pubkey) -> Instruction {
    Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
            write_authority,
            draft_vaa,
            guardian_set: get_guardian_set_address(BRIDGE_ID, DEFAULT_GUARDIAN_SET_INDEX),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    }
}

#[tokio::test]
async fn test_post_update_with_wormhole() {
    // 1. Setup: Create accumulator message with dummy price feeds
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    // 2. Program setup: ProgramTest with pyth_solana_receiver, pyth_push_oracle, and wormhole core-bridge
    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", pyth_solana_receiver::ID, None);
    program_test.add_program("pyth_push_oracle", PYTH_PUSH_ORACLE_ID, None);
    program_test.add_program("wormhole_core_bridge_solana", BRIDGE_ID, None);

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    // 3. Initialize wormhole and pyth receiver
    let setup_keypair = program_simulator.get_funded_keypair().await.unwrap();

    program_simulator
        .process_ix_with_default_compute_limit(
            wormhole_solana::instructions::initialize(
                BRIDGE_ID,
                setup_keypair.pubkey(),
                0,
                86400,
                &dummy_guardians_addresses(),
            )
            .unwrap(),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    let initial_config = default_receiver_config(setup_keypair.pubkey());

    program_simulator
        .process_ix_with_default_compute_limit(
            Initialize::populate(&setup_keypair.pubkey(), initial_config.clone()),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    let config_account = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(config_account, initial_config);

    // 4. Create encoded VAA via core-bridge instructions
    let write_authority = program_simulator.get_funded_keypair().await.unwrap();
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    // TX1: Create account for encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &write_authority.pubkey(),
                &encoded_vaa_keypair.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&encoded_vaa_keypair],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX2: Init encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    encoded_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX3: Write first part of VAA data, we didn't write the last 10 bytes
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: 0,
                        data: vaa[..vaa.len() - 10].to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // Verify should fail because we didn't write the last 10 bytes
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                get_verify_encoded_vaa_instruction(
                    write_authority.pubkey(),
                    encoded_vaa_keypair.pubkey()
                ),
                &vec![],
                Some(&write_authority),
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::InvalidGuardianKeyRecovery)
    );

    // Posting an update should fail because the VAA is not verified
    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdate::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    encoded_vaa_keypair.pubkey(),
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::UnverifiedVaa)
    );

    // TX4: Write remaining VAA data
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: (vaa.len() - 10).try_into().unwrap(),
                        data: vaa[vaa.len() - 10..].to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX5: Verify encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            get_verify_encoded_vaa_instruction(
                write_authority.pubkey(),
                encoded_vaa_keypair.pubkey(),
            ),
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // 5. Post update using the core-bridge-verified encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),
                encoded_vaa_keypair.pubkey(),
                price_update_keypair.pubkey(),
                merkle_price_updates[0].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    // 6. Assertions
    let price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();

    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );
    assert_eq!(
        price_update_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );
}

#[tokio::test]
async fn test_wormhole_insufficient_signatures() {
    // 1. Setup: Create accumulator message with dummy price feeds
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, _) = deserialize_accumulator_update_data(message).unwrap();

    // Trim the VAA to 9 signatures
    let vaa = serde_wormhole::to_vec(&trim_vaa_signatures(
        serde_wormhole::from_slice(&vaa).unwrap(),
        9,
    ))
    .unwrap();

    // 2. Program setup: Prog§ramTest with wormhole core-bridge
    let mut program_test = ProgramTest::default();
    program_test.add_program("wormhole_core_bridge_solana", BRIDGE_ID, None);

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    // 3. Initialize wormhole
    let setup_keypair = program_simulator.get_funded_keypair().await.unwrap();
    program_simulator
        .process_ix_with_default_compute_limit(
            wormhole_solana::instructions::initialize(
                BRIDGE_ID,
                setup_keypair.pubkey(),
                0,
                86400,
                &dummy_guardians_addresses(),
            )
            .unwrap(),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    // 4. Create encoded VAA via core-bridge instructions
    let write_authority = program_simulator.get_funded_keypair().await.unwrap();
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    // TX1: Create account for encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &write_authority.pubkey(),
                &encoded_vaa_keypair.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&encoded_vaa_keypair],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX2: Init encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    encoded_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX3: Write VAA data
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: 0,
                        data: vaa.to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX4: Verify encoded VAA, it fails because we are below guardian set quorum
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                get_verify_encoded_vaa_instruction(
                    write_authority.pubkey(),
                    encoded_vaa_keypair.pubkey()
                ),
                &vec![],
                Some(&write_authority),
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::NoQuorum)
    );
}
