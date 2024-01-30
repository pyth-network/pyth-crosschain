use {
    crate::common::DEFAULT_GUARDIAN_SET_INDEX,
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    pyth_solana_receiver::{
        instruction::PostUpdatesAtomic,
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
            trim_vaa_signatures,
        },
    },
    solana_sdk::{
        signature::Keypair,
        signer::Signer,
    },
    wormhole_core_bridge_solana::ID as BRIDGE_ID,
};

mod common;


#[tokio::test]
async fn test_post_updates_atomic() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false);
    let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(message).unwrap();

    let vaa = trim_vaa_signatures(vaa, 5);

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
    } = setup_pyth_receiver(vec![]).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // post one update atomically
    program_simulator
        .process_ix(
            PostUpdatesAtomic::populate(
                poster.pubkey(),
                price_update_keypair.pubkey(),
                BRIDGE_ID,
                DEFAULT_GUARDIAN_SET_INDEX,
                vaa.clone(),
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
        VerificationLevel::Partial(5)
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );

    // post another update to the same account
    program_simulator
        .process_ix(
            PostUpdatesAtomic::populate(
                poster.pubkey(),
                price_update_keypair.pubkey(),
                BRIDGE_ID,
                DEFAULT_GUARDIAN_SET_INDEX,
                vaa.clone(),
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
        VerificationLevel::Partial(5)
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_2
    );
}
