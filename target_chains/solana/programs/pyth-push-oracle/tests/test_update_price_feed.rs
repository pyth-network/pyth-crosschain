use {
    common_test_utils::{
        assert_treasury_balance,
        setup_pyth_receiver,
        ProgramTestFixtures,
        WrongSetupOption,
    },
    pyth_push_oracle::{
        instruction::UpdatePriceFeed,
        sdk::get_price_feed_address,
    },
    pyth_solana_receiver::sdk::{
        deserialize_accumulator_update_data,
        DEFAULT_TREASURY_ID,
    },
    pyth_solana_receiver_sdk::price_update::{
        PriceUpdateV2,
        VerificationLevel,
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{
            create_accumulator_message,
            create_dummy_price_feed_message_with_feed_id,
            dummy_feed_id,
        },
    },
    solana_sdk::{
        rent::Rent,
        signer::Signer,
    },
};


#[tokio::test]
async fn test_update_price_feed() {
    let feed_id: [u8; 32] = dummy_feed_id(100);
    let feed_id_2: [u8; 32] = dummy_feed_id(200);

    let feed_1_old = create_dummy_price_feed_message_with_feed_id(100, feed_id);
    let feed_1_recent = create_dummy_price_feed_message_with_feed_id(200, feed_id);

    let feed_2 = create_dummy_price_feed_message_with_feed_id(300, feed_id_2);

    let message = create_accumulator_message(
        &[feed_1_old, feed_1_recent, feed_2],
        &[feed_1_old, feed_1_recent, feed_2],
        false,
        false,
    );
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

    // post one update
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                0,
                feed_id,
                DEFAULT_TREASURY_ID,
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster],
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

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(0, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(0, feed_id)
    );
    assert_eq!(
        price_feed_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_feed_account.price_message),
        feed_1_old
    );
    assert_eq!(
        price_feed_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // // post another update, same price feed
    // program_simulator
    //     .process_ix_with_default_compute_limit(
    //         UpdatePriceFeed::populate(
    //             poster.pubkey(),
    //             encoded_vaa_addresses[0],
    //             0,
    //             feed_id,
    //             DEFAULT_TREASURY_ID,
    //             merkle_price_updates[1].clone(),
    //         ),
    //         &vec![&poster],
    //         None,
    //     )
    //     .await
    //     .unwrap();

    // assert_treasury_balance(
    //     &mut program_simulator,
    //     Rent::default().minimum_balance(0) + 1,
    //     DEFAULT_TREASURY_ID,
    // )
    // .await;

    // let price_feed_account = program_simulator
    //     .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(0, feed_id))
    //     .await
    //     .unwrap();

    // assert_eq!(
    //     price_feed_account.write_authority,
    //     get_price_feed_address(0, feed_id)
    // );
    // assert_eq!(
    //     price_feed_account.verification_level,
    //     VerificationLevel::Full
    // );
    // assert_eq!(
    //     Message::PriceFeedMessage(price_feed_account.price_message),
    //     feed_1_recent
    // );
    // assert_eq!(
    //     price_feed_account.posted_slot,
    //     program_simulator.get_clock().await.unwrap().slot
    // );

    // // post another update, outdated
    // assert_eq!(
    //     program_simulator
    //         .process_ix_with_default_compute_limit(
    //             UpdatePriceFeed::populate(
    //                 poster.pubkey(),
    //                 encoded_vaa_addresses[0],
    //                 0,
    //                 feed_id,
    //                 DEFAULT_TREASURY_ID,
    //                 merkle_price_updates[1].clone(),
    //             ),
    //             &vec![&poster],
    //             None,
    //         )
    //         .await
    //         .unwrap_err()
    //         .unwrap(),
    //     into_transaction_error(PushOracleError::UpdatesNotMonotonic)
    // );

    // assert_treasury_balance(
    //     &mut program_simulator,
    //     Rent::default().minimum_balance(0) + 1,
    //     DEFAULT_TREASURY_ID,
    // )
    // .await;

    // let price_feed_account = program_simulator
    //     .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(0, feed_id))
    //     .await
    //     .unwrap();

    // assert_eq!(
    //     price_feed_account.write_authority,
    //     get_price_feed_address(0, feed_id)
    // );
    // assert_eq!(
    //     price_feed_account.verification_level,
    //     VerificationLevel::Full
    // );
    // assert_eq!(
    //     Message::PriceFeedMessage(price_feed_account.price_message),
    //     feed_1_recent
    // );
    // assert_eq!(
    //     price_feed_account.posted_slot,
    //     program_simulator.get_clock().await.unwrap().slot
    // );

    // // works if you change the instance
    // program_simulator
    //     .process_ix_with_default_compute_limit(
    //         UpdatePriceFeed::populate(
    //             poster.pubkey(),
    //             encoded_vaa_addresses[0],
    //             1,
    //             feed_id,
    //             DEFAULT_TREASURY_ID,
    //             merkle_price_updates[0].clone(),
    //         ),
    //         &vec![&poster],
    //         None,
    //     )
    //     .await
    //     .unwrap();

    // let price_feed_account = program_simulator
    //     .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(0, feed_id))
    //     .await
    //     .unwrap();

    // assert_treasury_balance(
    //     &mut program_simulator,
    //     Rent::default().minimum_balance(0) + 2,
    //     DEFAULT_TREASURY_ID,
    // )
    // .await;

    // assert_eq!(
    //     price_feed_account.write_authority,
    //     get_price_feed_address(0, feed_id)
    // );
    // assert_eq!(
    //     price_feed_account.verification_level,
    //     VerificationLevel::Full
    // );
    // assert_eq!(
    //     Message::PriceFeedMessage(price_feed_account.price_message),
    //     feed_1_recent
    // );
    // assert_eq!(
    //     price_feed_account.posted_slot,
    //     program_simulator.get_clock().await.unwrap().slot
    // );

    // let price_feed_account = program_simulator
    //     .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(1, feed_id))
    //     .await
    //     .unwrap();

    // assert_eq!(
    //     price_feed_account.write_authority,
    //     get_price_feed_address(1, feed_id)
    // );
    // assert_eq!(
    //     price_feed_account.verification_level,
    //     VerificationLevel::Full
    // );
    // assert_eq!(
    //     Message::PriceFeedMessage(price_feed_account.price_message),
    //     feed_1_old
    // );
    // assert_eq!(
    //     price_feed_account.posted_slot,
    //     program_simulator.get_clock().await.unwrap().slot
    // );

    // // try to post the wrong price feed id
    // assert_eq!(
    //     program_simulator
    //         .process_ix_with_default_compute_limit(
    //             UpdatePriceFeed::populate(
    //                 poster.pubkey(),
    //                 encoded_vaa_addresses[0],
    //                 0,
    //                 feed_id,
    //                 DEFAULT_TREASURY_ID,
    //                 merkle_price_updates[2].clone(),
    //             ),
    //             &vec![&poster],
    //             None,
    //         )
    //         .await
    //         .unwrap_err()
    //         .unwrap(),
    //     into_transaction_error(PushOracleError::PriceFeedMessageMismatch)
    // );
}
