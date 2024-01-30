use {
    crate::common::WrongSetupOption,
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    program_simulator::into_transation_error,
    pyth_solana_receiver::{
        error::ReceiverError,
        instruction::PostUpdates,
        sdk::deserialize_accumulator_update_data,
        state::price_update::{
            PriceUpdateV1,
            VerificationLevel,
        },
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{
            create_accumulator_message,
            create_dummy_price_feed_message,
        },
    },
    solana_program::pubkey::Pubkey,
    solana_sdk::{
        signature::Keypair,
        signer::Signer,
    },
};

mod common;


#[tokio::test]
async fn test_post_updates() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();


    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // post one update
    program_simulator
        .process_ix(
            PostUpdates::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                price_update_keypair.pubkey(),
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();


    let mut price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV1>(price_update_keypair.pubkey())
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

    // post another update to the same account
    program_simulator
        .process_ix(
            PostUpdates::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                price_update_keypair.pubkey(),
                merkle_price_updates[1].clone(),
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();


    price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV1>(price_update_keypair.pubkey())
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
}

#[tokio::test]
async fn test_post_updates_wrong_encoded_vaa_owner() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::None,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    assert_eq!(
        program_simulator
            .process_ix(
                PostUpdates::populate(
                    poster.pubkey(),
                    Pubkey::new_unique(),
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transation_error(ReceiverError::WrongVaaOwner)
    );
}

#[tokio::test]
async fn test_post_updates_wrong_setup() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses,
    } = setup_pyth_receiver(
        vec![serde_wormhole::from_slice(&vaa).unwrap()],
        WrongSetupOption::UnverifiedEncodedVaa,
    )
    .await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    assert_eq!(
        program_simulator
            .process_ix(
                PostUpdates::populate(
                    poster.pubkey(),
                    encoded_vaa_addresses[0],
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transation_error(wormhole_core_bridge_solana::error::CoreBridgeError::UnverifiedVaa)
    );
}
