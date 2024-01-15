use crate::common::ProgramTestFixtures;

mod common;

use {
    common::setup_pyth_receiver,
    pyth_solana_receiver::instruction::PostUpdates,
    solana_sdk::{
        signature::Keypair,
        signer::Signer,
    },
};

#[tokio::test]
async fn test_post_updates() {
    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_address,
        merkle_price_updates,
    } = setup_pyth_receiver().await;

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();

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
}
