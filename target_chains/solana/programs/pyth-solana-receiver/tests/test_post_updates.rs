use {
    common_test_utils::{
        assert_treasury_balance, setup_pyth_receiver, ProgramTestFixtures, WrongSetupOption,
    },
    program_simulator::into_transaction_error,
    pyth_solana_receiver::{
        error::ReceiverError,
        instruction::{PostUpdate, ReclaimRent},
        sdk::{deserialize_accumulator_update_data, get_random_treasury_id, DEFAULT_TREASURY_ID},
    },
    pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel},
    pythnet_sdk::{
        messages::Message,
        test_utils::{create_accumulator_message, create_dummy_price_feed_message},
    },
    solana_program::pubkey::Pubkey,
    solana_sdk::{rent::Rent, signature::Keypair, signer::Signer},
};

#[tokio::test]
async fn test_post_update() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses,
        governance_authority: _,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    assert_treasury_balance(&mut program_simulator, 0, DEFAULT_TREASURY_ID).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // post one update
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),
                encoded_vaa_addresses[0],
                price_update_keypair.pubkey(),
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

    // post another update to the same account
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),
                encoded_vaa_addresses[0],
                price_update_keypair.pubkey(),
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

    price_update_account = program_simulator
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
        feed_2
    );
    assert_eq!(
        price_update_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // This poster doesn't have the write authority
    let poster_2 = program_simulator.get_funded_keypair().await.unwrap();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                ReclaimRent::populate(poster_2.pubkey(), price_update_keypair.pubkey()),
                &vec![&poster_2],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::WrongWriteAuthority)
    );

    program_simulator
        .process_ix_with_default_compute_limit(
            ReclaimRent::populate(poster.pubkey(), price_update_keypair.pubkey()),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    assert_eq!(
        program_simulator
            .get_balance(price_update_keypair.pubkey())
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn test_post_update_wrong_encoded_vaa_owner() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
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

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdate::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    Pubkey::new_unique(), // Random pubkey instead of the encoded VAA address
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                    get_random_treasury_id()
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::WrongVaaOwner)
    );
}

#[tokio::test]
async fn test_post_update_wrong_setup() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message =
        create_accumulator_message(&[&feed_1, &feed_2], &[&feed_1, &feed_2], false, false, None);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses,
        governance_authority: _,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::UnverifiedEncodedVaa,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdate::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    encoded_vaa_addresses[0],
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                    get_random_treasury_id()
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(wormhole_core_bridge_solana::error::CoreBridgeError::UnverifiedVaa)
    );
}
