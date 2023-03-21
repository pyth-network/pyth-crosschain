//! Checks for migrating the previous config schema into the current one

pub mod fixtures;

use {
    fixtures::passthrough,
    log::info,
    pyth_wormhole_attester::config::{
        OldP2WConfigAccount,
        OldPyth2WormholeConfig,
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    pyth_wormhole_attester_client as p2wc,
    serial_test::serial,
    solana_program::system_program,
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

#[tokio::test]
#[serial]
async fn test_migrate_works() -> Result<(), solitaire::ErrBox> {
    info!("Starting");
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Keypair::new();
    let pyth_owner = Pubkey::new_unique();

    // On-chain state
    let old_p2w_config = OldPyth2WormholeConfig {
        owner: p2w_owner.pubkey(),
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
        is_active: true,
    };

    info!("Before ProgramTest::new()");

    // Populate test environment
    let mut p2w_test = ProgramTest::new(
        "pyth_wormhole_attester",
        p2w_program_id,
        processor!(pyth_wormhole_attester::instruction::solitaire),
    );

    // Plant filled config accounts
    let old_p2w_config_bytes = old_p2w_config.try_to_vec()?;
    let old_p2w_config_account = Account {
        lamports:   Rent::default().minimum_balance(old_p2w_config_bytes.len()),
        data:       old_p2w_config_bytes,
        owner:      p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let old_p2w_config_addr = OldP2WConfigAccount::key(None, &p2w_program_id);

    info!("Before add_account() calls");

    p2w_test.add_account(old_p2w_config_addr, old_p2w_config_account);

    // Add system program because the contract creates an account for new configuration account
    passthrough::add_passthrough(&mut p2w_test, "system", system_program::id());

    info!("System program under {}", system_program::id());

    info!("Before start_with_context");
    let mut ctx = p2w_test.start_with_context().await;

    let migrate_tx =
        p2wc::gen_migrate_tx(ctx.payer, p2w_program_id, p2w_owner, ctx.last_blockhash)?;
    info!("Before process_transaction");

    // Migration should fail because the new config account is already initialized
    ctx.banks_client.process_transaction(migrate_tx).await?;

    Ok(())
}

#[tokio::test]
#[serial]
async fn test_migrate_already_migrated() -> Result<(), solitaire::ErrBox> {
    info!("Starting");
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Keypair::new();
    let pyth_owner = Pubkey::new_unique();
    let ops_owner = Keypair::new();

    // On-chain state
    let old_p2w_config = OldPyth2WormholeConfig {
        owner: p2w_owner.pubkey(),
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
        is_active: true,
    };

    let new_p2w_config = Pyth2WormholeConfig {
        owner: p2w_owner.pubkey(),
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
        is_active: true,
        ops_owner: Some(ops_owner.pubkey()),
    };

    info!("Before ProgramTest::new()");

    // Populate test environment
    let mut p2w_test = ProgramTest::new(
        "pyth_wormhole_attester",
        p2w_program_id,
        processor!(pyth_wormhole_attester::instruction::solitaire),
    );

    // Plant filled config accounts
    let old_p2w_config_bytes = old_p2w_config.try_to_vec()?;
    let old_p2w_config_account = Account {
        lamports:   Rent::default().minimum_balance(old_p2w_config_bytes.len()),
        data:       old_p2w_config_bytes,
        owner:      p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let old_p2w_config_addr = OldP2WConfigAccount::key(None, &p2w_program_id);

    let new_p2w_config_bytes = new_p2w_config.try_to_vec()?;
    let new_p2w_config_account = Account {
        lamports:   Rent::default().minimum_balance(new_p2w_config_bytes.len()),
        data:       new_p2w_config_bytes,
        owner:      p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let new_p2w_config_addr =
        P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_program_id);

    info!("Before add_account() calls");

    p2w_test.add_account(old_p2w_config_addr, old_p2w_config_account);
    p2w_test.add_account(new_p2w_config_addr, new_p2w_config_account);

    info!("Before start_with_context");
    let mut ctx = p2w_test.start_with_context().await;

    let migrate_tx =
        p2wc::gen_migrate_tx(ctx.payer, p2w_program_id, p2w_owner, ctx.last_blockhash)?;
    info!("Before process_transaction");

    // Migration should fail because the new config account is already initialized
    assert!(ctx
        .banks_client
        .process_transaction(migrate_tx)
        .await
        .is_err());

    Ok(())
}
