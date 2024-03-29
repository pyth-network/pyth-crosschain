use {
    crate::common::WrongSetupOption,
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    pyth_push_oracle::instruction::UpdatePriceFeed,
    pyth_solana_receiver::sdk::{
        deserialize_accumulator_update_data,
        DEFAULT_TREASURY_ID,
    },
    pythnet_sdk::test_utils::{
        create_accumulator_message,
        create_dummy_price_feed_message,
        dummy_feed_id,
    },
    solana_sdk::signer::Signer,
};

mod common;

#[tokio::test]
async fn test_update_price() {
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1, feed_2], false, false);
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

    let poster = program_simulator.get_funded_keypair().await.unwrap();

    // update one price feed, creating the account
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                0,
                dummy_feed_id(100),
                DEFAULT_TREASURY_ID,
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();
}
