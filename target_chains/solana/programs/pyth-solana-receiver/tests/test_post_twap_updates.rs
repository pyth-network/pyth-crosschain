use {
    common_test_utils::{
        assert_treasury_balance, setup_pyth_receiver, ProgramTestFixtures, WrongSetupOption,
    },
    pyth_solana_receiver::{
        instruction::PostTwapUpdate,
        sdk::{deserialize_accumulator_update_data, DEFAULT_TREASURY_ID},
    },
    pyth_solana_receiver_sdk::price_update::TwapUpdate,
    pythnet_sdk::{
        messages::{Message, TwapMessage},
        test_utils::create_accumulator_message,
    },
    solana_sdk::{rent::Rent, signature::Keypair, signer::Signer},
};

/// Test the happy path for posting 2 twap updates.
/// Verification errors are being tested by the other files in this module.
#[tokio::test]
async fn test_post_twap_updates() {
    // ARRANGE //

    // Create start and end cumulative price updates for feed 1 and feed 2
    // feed 1 start message of cumul_price=100 at slot=100
    let feed_1_start_msg = Message::TwapMessage(TwapMessage {
        feed_id: [1; 32],
        cumulative_price: 100,
        cumulative_conf: 100,
        num_down_slots: 10,
        exponent: -8,
        publish_time: 100,
        prev_publish_time: 99,
        publish_slot: 100,
    });
    // feed 1 end message of cumul_price=500 at slot=500
    let feed_1_end_msg = Message::TwapMessage(TwapMessage {
        feed_id: [1; 32],
        cumulative_price: 500,
        cumulative_conf: 500,
        num_down_slots: 110, // 100 new down slots out of 400 total slots = 25% down slots
        exponent: -8,
        publish_time: 500,
        prev_publish_time: 499,
        publish_slot: 500,
    });

    // feed 2 start message of cumul_price=200 at slot=100
    let feed_2_start_msg = Message::TwapMessage(TwapMessage {
        feed_id: [2; 32],
        cumulative_price: 200,
        cumulative_conf: 200,
        num_down_slots: 20,
        exponent: -6,
        publish_time: 100,
        prev_publish_time: 99,
        publish_slot: 100,
    });
    // feed 2 end message of cumul_price=3200 at slot=500
    let feed_2_end_msg = Message::TwapMessage(TwapMessage {
        feed_id: [2; 32],
        cumulative_price: 3200,
        cumulative_conf: 3200,
        num_down_slots: 320, // 300 new down slots out of 400 total slots = 75% down slots
        exponent: -6,
        publish_time: 500,
        prev_publish_time: 499,
        publish_slot: 500,
    });

    // Combine the updates into accumulator messages
    let start_accumulator_message = create_accumulator_message(
        &[&feed_1_start_msg, &feed_2_start_msg],
        &[&feed_1_start_msg, &feed_2_start_msg],
        false,
        false,
        None,
    );
    let end_accumulator_message = create_accumulator_message(
        &[&feed_1_end_msg, &feed_2_end_msg],
        &[&feed_1_end_msg, &feed_2_end_msg],
        false,
        false,
        None,
    );
    // Extract the VAAs and merkle proofs from the accumulator updates
    let (start_vaa, start_merkle_price_updates) =
        deserialize_accumulator_update_data(start_accumulator_message).unwrap();
    let (end_vaa, end_merkle_price_updates) =
        deserialize_accumulator_update_data(end_accumulator_message).unwrap();

    // Set up receiver program simulation
    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses,
        governance_authority: _,
    } = setup_pyth_receiver(
        vec![
            serde_wormhole::from_slice(&start_vaa).unwrap(),
            serde_wormhole::from_slice(&end_vaa).unwrap(),
        ],
        WrongSetupOption::None,
    )
    .await;

    // Check that we have zero fee payment balance before starting
    assert_treasury_balance(&mut program_simulator, 0, DEFAULT_TREASURY_ID).await;
    let poster = program_simulator.get_funded_keypair().await.unwrap();

    // The program will post the TWAPs to these accounts
    let twap_update_keypair_1 = Keypair::new();
    let twap_update_keypair_2 = Keypair::new();

    // ACT //

    // Post the TWAP updates
    // Post feed 1 TWAP
    program_simulator
        .process_ix_with_default_compute_limit(
            PostTwapUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),          // Using poster as write authority
                encoded_vaa_addresses[0], // start_encoded_vaa
                encoded_vaa_addresses[1], // end_encoded_vaa
                twap_update_keypair_1.pubkey(),
                start_merkle_price_updates[0].clone(),
                end_merkle_price_updates[0].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &twap_update_keypair_1],
            None,
        )
        .await
        .unwrap();

    // Post feed 2 TWAP
    program_simulator
        .process_ix_with_default_compute_limit(
            PostTwapUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),          // Using poster as write authority
                encoded_vaa_addresses[0], // start_encoded_vaa
                encoded_vaa_addresses[1], // end_encoded_vaa
                twap_update_keypair_2.pubkey(),
                start_merkle_price_updates[1].clone(),
                end_merkle_price_updates[1].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &twap_update_keypair_2],
            None,
        )
        .await
        .unwrap();

    // ASSERT //

    // Check feed 1 TWAP
    let twap_update_account_1 = program_simulator
        .get_anchor_account_data::<TwapUpdate>(twap_update_keypair_1.pubkey())
        .await
        .unwrap();

    // Assert that the TWAP account was created correctly
    assert_eq!(twap_update_account_1.write_authority, poster.pubkey());

    // Assert all TWAP fields are correctly calculated for feed 1
    assert_eq!(twap_update_account_1.twap.feed_id, [1; 32]);
    assert_eq!(twap_update_account_1.twap.start_time, 100);
    assert_eq!(twap_update_account_1.twap.end_time, 500);
    assert_eq!(twap_update_account_1.twap.price, 1); // (500-100)/(500-100) = 1
    assert_eq!(twap_update_account_1.twap.conf, 1);
    assert_eq!(twap_update_account_1.twap.exponent, -8);
    assert_eq!(twap_update_account_1.twap.down_slots_ratio, 250_000); // 25% down slots = 250,000

    // Check feed 2 TWAP
    let twap_update_account_2 = program_simulator
        .get_anchor_account_data::<TwapUpdate>(twap_update_keypair_2.pubkey())
        .await
        .unwrap();

    // Assert that the TWAP account was created correctly
    assert_eq!(twap_update_account_2.write_authority, poster.pubkey());

    // Assert all TWAP fields are correctly calculated for feed 2
    assert_eq!(twap_update_account_2.twap.feed_id, [2; 32]);
    assert_eq!(twap_update_account_2.twap.start_time, 100);
    assert_eq!(twap_update_account_2.twap.end_time, 500);
    assert_eq!(twap_update_account_2.twap.price, 7); // (3200-200)/(500-100)=7.5 --> 7
    assert_eq!(twap_update_account_2.twap.conf, 7);
    assert_eq!(twap_update_account_2.twap.exponent, -6);
    assert_eq!(twap_update_account_2.twap.down_slots_ratio, 750_000); // 75% down slots = 750,000

    // Assert that rent for the treasury was paid (first ix) + an update fee was paid (second ix)
    assert_treasury_balance(
        &mut program_simulator,
        Rent::default().minimum_balance(0) + 1,
        DEFAULT_TREASURY_ID,
    )
    .await;
}
