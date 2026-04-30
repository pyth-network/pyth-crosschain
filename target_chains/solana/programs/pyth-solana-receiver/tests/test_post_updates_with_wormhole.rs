use {
    anchor_lang::{InstructionData, ToAccountMetas},
    common_test_utils::{
        assert_treasury_balance, build_guardian_set_account, default_receiver_config,
        WrongSetupOption, DEFAULT_GUARDIAN_SET_INDEX,
    },
    program_simulator::ProgramSimulator,
    pyth_solana_receiver::{
        instruction::{Initialize, PostUpdate},
        sdk::{
            deserialize_accumulator_update_data, get_guardian_set_address, DEFAULT_TREASURY_ID,
            VAA_SPLIT_INDEX,
        },
    },
    pyth_solana_receiver_sdk::{
        config::Config,
        pda::get_config_address,
        price_update::{PriceUpdateV2, VerificationLevel},
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{create_accumulator_message, create_dummy_price_feed_message},
    },
    solana_program::instruction::Instruction,
    solana_program_test::ProgramTest,
    solana_sdk::{rent::Rent, signature::Keypair, signer::Signer},
    wormhole_core_bridge_solana::{
        sdk::{WriteEncodedVaaArgs, VAA_START},
        ID as BRIDGE_ID,
    },
};

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

    // Add guardian set account at the correct PDA
    program_test.add_account(
        get_guardian_set_address(BRIDGE_ID, DEFAULT_GUARDIAN_SET_INDEX),
        build_guardian_set_account(WrongSetupOption::None),
    );

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    // Initialize pyth receiver config
    let setup_keypair = program_simulator.get_funded_keypair().await.unwrap();
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

    // 3. Create encoded VAA via core-bridge instructions
    let write_authority = program_simulator.get_funded_keypair().await.unwrap();
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    // TX1: Create account for encoded VAA
    let create_encoded_vaa = solana_sdk::system_instruction::create_account(
        &write_authority.pubkey(),
        &encoded_vaa_keypair.pubkey(),
        Rent::default().minimum_balance(encoded_vaa_size),
        encoded_vaa_size as u64,
        &BRIDGE_ID,
    );

    program_simulator
        .process_ix_with_default_compute_limit(
            create_encoded_vaa,
            &vec![&encoded_vaa_keypair],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX2: Init encoded VAA
    let init_encoded_vaa_instruction = Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
            write_authority: write_authority.pubkey(),
            encoded_vaa: encoded_vaa_keypair.pubkey(),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
    };

    program_simulator
        .process_ix_with_default_compute_limit(
            init_encoded_vaa_instruction,
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX3: Write first part of VAA data
    let write_encoded_vaa_instruction_1 = Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
            write_authority: write_authority.pubkey(),
            draft_vaa: encoded_vaa_keypair.pubkey(),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: 0,
                data: vaa[..VAA_SPLIT_INDEX].to_vec(),
            },
        }
        .data(),
    };

    program_simulator
        .process_ix_with_default_compute_limit(
            write_encoded_vaa_instruction_1,
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX4: Write remaining VAA data
    let write_encoded_vaa_instruction_2 = Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
            write_authority: write_authority.pubkey(),
            draft_vaa: encoded_vaa_keypair.pubkey(),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: VAA_SPLIT_INDEX.try_into().unwrap(),
                data: vaa[VAA_SPLIT_INDEX..].to_vec(),
            },
        }
        .data(),
    };

    program_simulator
        .process_ix_with_default_compute_limit(
            write_encoded_vaa_instruction_2,
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX5: Verify encoded VAA
    let guardian_set = get_guardian_set_address(BRIDGE_ID, DEFAULT_GUARDIAN_SET_INDEX);

    let verify_encoded_vaa_instruction = Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
            write_authority: write_authority.pubkey(),
            draft_vaa: encoded_vaa_keypair.pubkey(),
            guardian_set,
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    };

    program_simulator
        .process_ix_with_default_compute_limit(
            verify_encoded_vaa_instruction,
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // 4. Post update using the core-bridge-verified encoded VAA
    assert_treasury_balance(&mut program_simulator, 0, DEFAULT_TREASURY_ID).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

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

    // 5. Assertions
    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0),
        DEFAULT_TREASURY_ID,
    )
    .await;

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
