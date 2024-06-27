use {
    common_test_utils::{
        assert_treasury_balance,
        setup_pyth_receiver,
        ProgramTestFixtures,
        WrongSetupOption,
    },
    program_simulator::into_transaction_error,
    pyth_push_oracle::{
        instruction::InitPriceFeed,
        instruction::UpdatePriceFeed,
        sdk::get_price_feed_address,
        PushOracleError,
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
            create_dummy_feed_id,
            create_dummy_price_feed_message_with_feed_id,
        },
    },
    solana_sdk::{
        rent::Rent,
        signer::Signer,
    },
    solana_program::{pubkey, pubkey::Pubkey}
};

const DEFAULT_SHARD: u16 = 0;
const SECOND_SHARD: u16 = 1;

pub const PYTHNET_PUBKEY : Pubkey = pubkey!("G9LV2mp9ua1znRAfYwZz5cPiJMAbo1T6mbjdQsDZuMJg");

#[tokio::test]
async fn test_update_price_feed() {
    let feed_id: [u8; 32] = create_dummy_feed_id(100);
    let feed_id_2: [u8; 32] = create_dummy_feed_id(200);

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

    // init update
    program_simulator
        .process_ix_with_default_compute_limit(
            InitPriceFeed::populate(
                poster.pubkey(),
                DEFAULT_SHARD,
                feed_id,
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    // post one update
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                DEFAULT_SHARD,
                feed_id,
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(DEFAULT_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(DEFAULT_SHARD, feed_id)
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

    // post another update, same price feed
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                DEFAULT_SHARD,
                feed_id,
                merkle_price_updates[1].clone(),
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(DEFAULT_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(DEFAULT_SHARD, feed_id)
    );
    assert_eq!(
        price_feed_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_feed_account.price_message),
        feed_1_recent
    );
    assert_eq!(
        price_feed_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // post a stale update. The tx succeeds w/o updating on-chain account state.
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                DEFAULT_SHARD,
                feed_id,
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(DEFAULT_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(DEFAULT_SHARD, feed_id)
    );
    assert_eq!(
        price_feed_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_feed_account.price_message),
        feed_1_recent
    );
    assert_eq!(
        price_feed_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    // init second share
    program_simulator
        .process_ix_with_default_compute_limit(
            InitPriceFeed::populate(
                poster.pubkey(),
                SECOND_SHARD,
                feed_id,
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    // works if you change the shard
    program_simulator
        .process_ix_with_default_compute_limit(
            UpdatePriceFeed::populate(
                poster.pubkey(),
                encoded_vaa_addresses[0],
                SECOND_SHARD,
                feed_id,
                merkle_price_updates[0].clone(),
            ),
            &vec![&poster],
            None,
        )
        .await
        .unwrap();

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(DEFAULT_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(DEFAULT_SHARD, feed_id)
    );
    assert_eq!(
        price_feed_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_feed_account.price_message),
        feed_1_recent
    );
    assert_eq!(
        price_feed_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(SECOND_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(SECOND_SHARD, feed_id)
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

    // try to post the wrong price feed id
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                UpdatePriceFeed::populate(
                    poster.pubkey(),
                    encoded_vaa_addresses[0],
                    DEFAULT_SHARD,
                    feed_id,
                    merkle_price_updates[2].clone(),
                ),
                &vec![&poster],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(PushOracleError::PriceFeedMessageMismatch)
    );

    let price_feed_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(get_price_feed_address(DEFAULT_SHARD, feed_id))
        .await
        .unwrap();

    assert_eq!(
        price_feed_account.write_authority,
        get_price_feed_address(DEFAULT_SHARD, feed_id)
    );
    assert_eq!(
        price_feed_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_feed_account.price_message),
        feed_1_recent
    );
    assert_eq!(
        price_feed_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );
}
