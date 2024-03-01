use {
    crate::common::{
        assert_treasury_balance,
        WrongSetupOption,
        DEFAULT_GUARDIAN_SET_INDEX,
    },
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    program_simulator::into_transaction_error,
    pyth_solana_receiver::{
        error::ReceiverError,
        instruction::{
            PostUpdateAtomic,
            SetDataSources,
            SetFee,
        },
        sdk::{
            deserialize_accumulator_update_data,
            DEFAULT_TREASURY_ID,
        },
    },
    pyth_solana_receiver_state::{
        config::DataSource,
        price_update::{
            PriceUpdateV1,
            VerificationLevel,
        },
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{
            create_accumulator_message,
            create_dummy_price_feed_message,
            create_dummy_twap_message,
            DEFAULT_DATA_SOURCE,
            SECONDARY_DATA_SOURCE,
        },
    },
    solana_program::{
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
    },
    solana_sdk::{
        rent::Rent,
        signature::Keypair,
        signer::Signer,
    },
    wormhole_core_bridge_solana::ID as BRIDGE_ID,
};

mod common;


// This file is meant to test the errors that can be thrown by post_price_update_from_vaa
#[tokio::test]
async fn test_invalid_wormhole_message() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);

    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], true, false);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // corrupted wormhole message
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa,
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidWormholeMessage)
    );
}

#[tokio::test]
async fn test_invalid_update_message() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);

    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false, true);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();


    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority: _,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // corrupted wormhole message
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa,
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::DeserializeMessageFailed)
    );
}


#[tokio::test]
async fn test_post_price_update_from_vaa() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let feed_3 = create_dummy_price_feed_message(300);
    let twap_1 = create_dummy_twap_message();

    let message = create_accumulator_message(
        &[feed_1, feed_2, twap_1],
        &[feed_1, feed_2, twap_1],
        false,
        false,
    );

    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let message2 = create_accumulator_message(&[feed_2, feed_3], &[feed_3], false, false);
    let (_, merkle_price_updates2) = deserialize_accumulator_update_data(message2).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    assert_treasury_balance(&mut program_simulator, 0, DEFAULT_TREASURY_ID).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // this update is not in the proof
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates2[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InvalidPriceUpdate)
    );

    // this update is a twap
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates[2].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::UnsupportedMessageType)
    );


    // change the data source
    program_simulator
        .process_ix_with_default_compute_limit(
            SetDataSources::populate(
                governance_authority.pubkey(),
                vec![DataSource {
                    chain:   SECONDARY_DATA_SOURCE.chain.into(),
                    emitter: Pubkey::from(DEFAULT_DATA_SOURCE.address.0),
                }],
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    // Now this should fail!
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
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
        into_transaction_error(ReceiverError::InvalidDataSource)
    );

    // change again, this time the emitter field
    program_simulator
        .process_ix_with_default_compute_limit(
            SetDataSources::populate(
                governance_authority.pubkey(),
                vec![DataSource {
                    chain:   DEFAULT_DATA_SOURCE.chain.into(),
                    emitter: Pubkey::from(SECONDARY_DATA_SOURCE.address.0),
                }],
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();


    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
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
        into_transaction_error(ReceiverError::InvalidDataSource)
    );

    // change back
    program_simulator
        .process_ix_with_default_compute_limit(
            SetDataSources::populate(
                governance_authority.pubkey(),
                vec![DataSource {
                    chain:   DEFAULT_DATA_SOURCE.chain.into(),
                    emitter: Pubkey::from(DEFAULT_DATA_SOURCE.address.0),
                }],
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    // Now it works
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdateAtomic::populate(
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
        .get_anchor_account_data::<PriceUpdateV1>(price_update_keypair.pubkey())
        .await
        .unwrap();

    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 13 }
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );


    // Now change the fee!
    program_simulator
        .process_ix_with_default_compute_limit(
            SetFee::populate(governance_authority.pubkey(), LAMPORTS_PER_SOL),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();


    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates[1].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::InsufficientFunds)
    );

    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0),
        DEFAULT_TREASURY_ID,
    )
    .await;

    price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV1>(price_update_keypair.pubkey())
        .await
        .unwrap();
    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 13 }
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );


    // Airdrop more
    program_simulator
        .airdrop(&poster.pubkey(), LAMPORTS_PER_SOL)
        .await
        .unwrap();
    program_simulator
        .process_ix_with_default_compute_limit(
            SetFee::populate(governance_authority.pubkey(), LAMPORTS_PER_SOL),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdateAtomic::populate(
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
        Rent::default().minimum_balance(0) + LAMPORTS_PER_SOL,
        DEFAULT_TREASURY_ID,
    )
    .await;

    price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV1>(price_update_keypair.pubkey())
        .await
        .unwrap();
    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Partial { num_signatures: 13 },
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_2
    );


    // poster_2 can't write to this price update account
    let poster_2 = program_simulator.get_funded_keypair().await.unwrap();

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdateAtomic::populate(
                    poster_2.pubkey(),
                    price_update_keypair.pubkey(),
                    BRIDGE_ID,
                    DEFAULT_GUARDIAN_SET_INDEX,
                    vaa.clone(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster_2, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::WrongWriteAuthority)
    );
}
