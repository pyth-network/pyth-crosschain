use {
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    pyth_solana_receiver::{
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
    } = setup_pyth_receiver(vec![vaa]).await;

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
