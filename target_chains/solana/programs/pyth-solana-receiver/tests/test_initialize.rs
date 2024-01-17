use {
    crate::common::dummy_price_messages,
    common::{
        setup_pyth_receiver,
        ProgramTestFixtures,
    },
    pyth_solana_receiver::{
        instruction::PostUpdates,
        state::price_update::{
            PriceUpdateV1,
            VerificationLevel,
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
    let dummy_price_messages = dummy_price_messages();

    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_address,
        merkle_price_updates,
    } = setup_pyth_receiver(dummy_price_messages.clone()).await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

    // post one update
    program_simulator
        .process_ix(
            PostUpdates::populate(
                poster.pubkey(),
                encoded_vaa_address,
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
    assert_eq!(price_update_account.price_message, dummy_price_messages[0]);

    // post another update to the same account
    program_simulator
        .process_ix(
            PostUpdates::populate(
                poster.pubkey(),
                encoded_vaa_address,
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
    assert_eq!(price_update_account.price_message, dummy_price_messages[1]);
}
