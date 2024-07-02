use anchor_lang::prelude::*;
use pyth_solana_receiver::pyth_solana_receiver::{initialize_price_update_v2, update_price_update_v2, PriceUpdateV2};
use solana_program_test::*;
use solana_sdk::{
    account::Account as SolanaAccount, signature::Keypair, signer::Signer, transaction::Transaction,
};

#[tokio::test]
async fn test_initialize_price_update() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "pyth_solana_receiver",
        program_id,
        processor!(pyth_solana_receiver::pyth_solana_receiver::processor),
    );

    let price_update_keypair = Keypair::new();
    let price_update_account = price_update_keypair.pubkey();

    program_test.add_account(
        price_update_account,
        SolanaAccount::new(1_000_000, PriceUpdateV2::LEN, &program_id),
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let price_update = PriceUpdateV2 {
        price: 100,
        conf: 10,
        exponent: -2,
        feed_id: [0u8; 32],
        publish_time: 1_624_099_200,
        prev_publish_time: 1_624_098_200,
        is_initialized: false,
    };

    let init_ix = initialize_price_update_v2(
        price_update_account,
        price_update.price,
        price_update.conf,
        price_update.exponent,
        price_update.feed_id,
        price_update.publish_time,
        price_update.prev_publish_time,
    );

    let mut transaction = Transaction::new_with_payer(&[init_ix], Some(&payer.pubkey()));
    transaction.sign(&[&payer, &price_update_keypair], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    let account = banks_client
        .get_account(price_update_account)
        .await
        .unwrap()
        .unwrap();
    let price_update_data = PriceUpdateV2::try_deserialize(&mut account.data.as_slice()).unwrap();

    assert_eq!(price_update_data, price_update);
}

#[tokio::test]
async fn test_update_price_update() {
    let program_id = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "pyth_solana_receiver",
        program_id,
        processor!(pyth_solana_receiver::pyth_solana_receiver::processor),
    );

    let price_update_keypair = Keypair::new();
    let price_update_account = price_update_keypair.pubkey();

    program_test.add_account(
        price_update_account,
        SolanaAccount::new(1_000_000, PriceUpdateV2::LEN, &program_id),
    );

    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

    let initial_price_update = PriceUpdateV2 {
        price: 100,
        conf: 10,
        exponent: -2,
        feed_id: [0u8; 32],
        publish_time: 1_624_099_200,
        prev_publish_time: 1_624_098_200,
        is_initialized: false,
    };

    let init_ix = initialize_price_update_v2(
        price_update_account,
        initial_price_update.price,
        initial_price_update.conf,
        initial_price_update.exponent,
        initial_price_update.feed_id,
        initial_price_update.publish_time,
        initial_price_update.prev_publish_time,
    );

    let mut transaction = Transaction::new_with_payer(&[init_ix], Some(&payer.pubkey()));
    transaction.sign(&[&payer, &price_update_keypair], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    let updated_price_update = PriceUpdateV2 {
        price: 200,
        conf: 20,
        exponent: -3,
        feed_id: [1u8; 32],
        publish_time: 1_624_199_200,
        prev_publish_time: 1_624_198_200,
        is_initialized: true,
    };

    let update_ix = update_price_update_v2(
        price_update_account,
        updated_price_update.price,
        updated_price_update.conf,
        updated_price_update.exponent,
        updated_price_update.feed_id,
        updated_price_update.publish_time,
        updated_price_update.prev_publish_time,
    );

    let mut transaction = Transaction::new_with_payer(&[update_ix], Some(&payer.pubkey()));
    transaction.sign(&[&payer, &price_update_keypair], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    let account = banks_client
        .get_account(price_update_account)
        .await
        .unwrap()
        .unwrap();
    let price_update_data = PriceUpdateV2::try_deserialize(&mut account.data.as_slice()).unwrap();

    assert_eq!(price_update_data, updated_price_update);
}
