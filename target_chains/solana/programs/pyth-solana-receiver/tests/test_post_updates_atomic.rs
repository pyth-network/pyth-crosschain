use {
    common_test_utils::{
        assert_treasury_balance, setup_pyth_receiver, ProgramTestFixtures, WrongSetupOption,
        DEFAULT_GUARDIAN_SET_INDEX,
    },
    program_simulator::into_transaction_error,
    pyth_solana_receiver::{
        error::ReceiverError,
        instruction::PostUpdateAtomic,
        sdk::{
            deserialize_accumulator_update_data, get_guardian_set_address, DEFAULT_TREASURY_ID,
            SECONDARY_TREASURY_ID,
        },
    },
    pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel},
    pythnet_sdk::{
        messages::Message,
        test_utils::{
            create_accumulator_message, create_dummy_price_feed_message, trim_vaa_signatures,
        },
    },
    serde_wormhole::RawMessage,
    solana_sdk::{rent::Rent, signature::Keypair, signer::Signer},
    wormhole_core_bridge_solana::ID as BRIDGE_ID,
    wormhole_sdk::Vaa,
};

#[tokio::test]
async fn test_post_update_atomic() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();
    let vaa = serde_wormhole::to_vec(&trim_vaa_signatures(
        serde_wormhole::from_slice(&vaa).unwrap(),
        5,
    ))
    .unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(vec![], WrongSetupOption::None).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    assert_treasury_balance(&mut program_simulator, 0, DEFAULT_TREASURY_ID).await;

    // post one update atomically
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdateAtomic::populate(
                poster.pubkey(),
                poster.pubkey(),
                price_update_keypair.pubkey(),
                BRIDGE_ID,
                DEFAULT_GUARDIAN_SET_INDEX,
                vaa.clone(),
                merkle_price_updates[0].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0),
        DEFAULT_TREASURY_ID,
    )
    .await;

    let mut price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();

    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 5 }
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );
    assert_eq!(
        price_update_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // post another update to the same account
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdateAtomic::populate(
                poster.pubkey(),
                poster.pubkey(),
                price_update_keypair.pubkey(),
                BRIDGE_ID,
                DEFAULT_GUARDIAN_SET_INDEX,
                vaa.clone(),
                merkle_price_updates[1].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0) + 1,
        DEFAULT_TREASURY_ID,
    )
    .await;
    assert_treasury_balance(&mut program_simulator, 0, SECONDARY_TREASURY_ID).await;

    price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();

    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 5 }
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_2
    );
    assert_eq!(
        price_update_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // use another treasury account
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdateAtomic::populate(
                poster.pubkey(),
                poster.pubkey(),
                price_update_keypair.pubkey(),
                BRIDGE_ID,
                DEFAULT_GUARDIAN_SET_INDEX,
                vaa.clone(),
                merkle_price_updates[0].clone(),
                SECONDARY_TREASURY_ID,
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0) + 1,
        DEFAULT_TREASURY_ID,
    )
    .await;
    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0),
        SECONDARY_TREASURY_ID,
    )
    .await;

    price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();
    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 5 }
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
async fn test_post_update_atomic_wrong_vaa() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(vec![], WrongSetupOption::None).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    let mut vaa_buffer_copy: Vec<u8> = vaa.clone();
    // Mess up with the length of signatures
    vaa_buffer_copy[5] = 255;
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa_buffer_copy,
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::DeserializeVaaFailed)
    );

    let vaa_wrong_num_signatures = serde_wormhole::to_vec(&trim_vaa_signatures(
        serde_wormhole::from_slice(&vaa).unwrap(),
        4,
    ))
    .unwrap();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa_wrong_num_signatures.clone(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InsufficientGuardianSignatures)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.version = 0;

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidVaaVersion)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.guardian_set_index = 1;

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GuardianSetMismatch)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.signatures[0] = vaa_copy.signatures[1];

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidGuardianOrder)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.signatures[0].index = 20;

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidGuardianIndex)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.signatures[0].signature[64] = 5;

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidSignature)
    );

    let mut vaa_copy: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa).unwrap();
    vaa_copy.signatures[0].signature = vaa_copy.signatures[1].signature;

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    serde_wormhole::to_vec(&vaa_copy).unwrap(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidGuardianKeyRecovery)
    );

    let mut wrong_instruction = PostUpdateAtomic::populate(
        poster.pubkey(),
        poster.pubkey(),
        price_update_keypair.pubkey(),
        BRIDGE_ID,
        DEFAULT_GUARDIAN_SET_INDEX,
        vaa.clone(),
        merkle_price_updates[0].clone(),
        DEFAULT_TREASURY_ID,
    );

    let wrong_guardian_set = get_guardian_set_address(BRIDGE_ID, 1);
    wrong_instruction.accounts[1].pubkey = wrong_guardian_set;
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                wrong_instruction,
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::WrongGuardianSetOwner)
    );
}

#[tokio::test]
async fn test_post_update_atomic_wrong_setup() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();
    let price_update_keypair = Keypair::new();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(vec![], WrongSetupOption::GuardianSetWrongIndex).await;
    let poster: Keypair = program_simulator.get_funded_keypair().await.unwrap();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidGuardianSetPda)
    );

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(vec![], WrongSetupOption::GuardianSetExpired).await;
    let poster = program_simulator.get_funded_keypair().await.unwrap();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GuardianSetExpired)
    );
}
