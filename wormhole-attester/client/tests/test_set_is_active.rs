pub mod fixtures;

use {
    pyth_wormhole_attester::config::{
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    pyth_wormhole_attester_client as p2wc,
    solana_program_test::*,
    solana_sdk::{
        account::Account,
        pubkey::Pubkey,
        rent::Rent,
        signature::Signer,
        signer::keypair::Keypair,
    },
    solitaire::{
        processors::seeded::Seeded,
        AccountState,
        BorshSerialize,
    },
};

fn clone_keypair(keypair: &Keypair) -> Keypair {
    // Unwrap as we are surely copying a keypair and we are in test env.
    Keypair::from_bytes(keypair.to_bytes().as_ref()).unwrap()
}

#[tokio::test]
async fn test_setting_is_active_works() -> Result<(), p2wc::ErrBoxSend> {
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Pubkey::new_unique();
    let pyth_owner = Pubkey::new_unique();
    let ops_owner = Keypair::new();

    // On-chain state
    let p2w_config = Pyth2WormholeConfig {
        owner: p2w_owner,
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
        is_active: true,
        ops_owner: Some(ops_owner.pubkey()),
    };

    // Populate test environment
    let mut p2w_test = ProgramTest::new(
        "pyth_wormhole_attester",
        p2w_program_id,
        processor!(pyth_wormhole_attester::instruction::solitaire),
    );

    // Plant a filled config account
    let p2w_config_bytes = p2w_config.try_to_vec()?;
    let p2w_config_account = Account {
        lamports:   Rent::default().minimum_balance(p2w_config_bytes.len()),
        data:       p2w_config_bytes,
        owner:      p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let p2w_config_addr =
        P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_program_id);

    p2w_test.add_account(p2w_config_addr, p2w_config_account);

    let mut ctx = p2w_test.start_with_context().await;

    // Setting to false should work
    let set_is_active_false_tx = p2wc::gen_set_is_active_tx(
        clone_keypair(&ctx.payer),
        p2w_program_id,
        clone_keypair(&ops_owner),
        false,
        ctx.last_blockhash,
    )
    .map_err(|e| e.to_string())?;

    ctx.banks_client
        .process_transaction(set_is_active_false_tx)
        .await?;

    let config = ctx
        .banks_client
        .get_account_data_with_borsh::<Pyth2WormholeConfig>(p2w_config_addr)
        .await?;

    assert!(!config.is_active);

    // Setting to true should work
    let set_is_active_true_tx = p2wc::gen_set_is_active_tx(
        clone_keypair(&ctx.payer),
        p2w_program_id,
        clone_keypair(&ops_owner),
        true,
        ctx.last_blockhash,
    )
    .map_err(|e| e.to_string())?;

    ctx.banks_client
        .process_transaction(set_is_active_true_tx)
        .await?;

    let config = ctx
        .banks_client
        .get_account_data_with_borsh::<Pyth2WormholeConfig>(p2w_config_addr)
        .await?;

    assert!(config.is_active);

    // A wrong signer cannot handle it

    let set_is_active_true_tx = p2wc::gen_set_is_active_tx(
        clone_keypair(&ctx.payer),
        p2w_program_id,
        clone_keypair(&ctx.payer),
        true,
        ctx.last_blockhash,
    )
    .map_err(|e| e.to_string())?;

    assert!(ctx
        .banks_client
        .process_transaction(set_is_active_true_tx)
        .await
        .is_err());

    Ok(())
}

#[tokio::test]
async fn test_setting_is_active_does_not_work_without_ops_owner() -> Result<(), p2wc::ErrBoxSend> {
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Pubkey::new_unique();
    let pyth_owner = Keypair::new();

    // On-chain state
    let p2w_config = Pyth2WormholeConfig {
        owner:          p2w_owner,
        wh_prog:        wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner:     pyth_owner.pubkey(),
        is_active:      true,
        ops_owner:      None,
    };

    // Populate test environment
    let mut p2w_test = ProgramTest::new(
        "pyth_wormhole_attester",
        p2w_program_id,
        processor!(pyth_wormhole_attester::instruction::solitaire),
    );

    // Plant a filled config account
    let p2w_config_bytes = p2w_config.try_to_vec()?;
    let p2w_config_account = Account {
        lamports:   Rent::default().minimum_balance(p2w_config_bytes.len()),
        data:       p2w_config_bytes,
        owner:      p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let p2w_config_addr =
        P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_program_id);

    p2w_test.add_account(p2w_config_addr, p2w_config_account);

    let mut ctx = p2w_test.start_with_context().await;

    // No one could should be able to handle
    // For example pyth_owner is used here.
    let set_is_active_true_tx = p2wc::gen_set_is_active_tx(
        clone_keypair(&ctx.payer),
        p2w_program_id,
        pyth_owner,
        true,
        ctx.last_blockhash,
    )
    .map_err(|e| e.to_string())?;

    assert!(ctx
        .banks_client
        .process_transaction(set_is_active_true_tx)
        .await
        .is_err());

    Ok(())
}
