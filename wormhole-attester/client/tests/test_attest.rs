pub mod fixtures;

use {
    bridge::accounts::{
        Bridge,
        BridgeConfig,
        BridgeData,
    },
    fixtures::{
        passthrough,
        pyth,
    },
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
    },
    solitaire::{
        processors::seeded::Seeded,
        AccountState,
        BorshSerialize,
    },
};

#[tokio::test]
async fn test_happy_path() -> Result<(), p2wc::ErrBoxSend> {
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Pubkey::new_unique();
    let pyth_owner = Pubkey::new_unique();
    let ops_owner = Pubkey::new_unique();

    // On-chain state
    let p2w_config = Pyth2WormholeConfig {
        owner: p2w_owner,
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth_wormhole_attester::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
        is_active: true,
        ops_owner: Some(ops_owner),
    };

    let bridge_config = BridgeData {
        config: BridgeConfig {
            fee: 0xdeadbeef,
            ..Default::default()
        },
        ..Default::default()
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

    // Plant a bridge config
    let bridge_config_bytes = bridge_config.try_to_vec()?;
    let wh_bridge_config_account = Account {
        lamports:   Rent::default().minimum_balance(bridge_config_bytes.len()),
        data:       bridge_config_bytes,
        owner:      wh_fixture_program_id,
        executable: false,
        rent_epoch: 0,
    };

    let wh_bridge_config_addr =
        Bridge::<{ AccountState::Initialized }>::key(None, &wh_fixture_program_id);

    p2w_test.add_account(wh_bridge_config_addr, wh_bridge_config_account);

    passthrough::add_passthrough(&mut p2w_test, "wormhole", wh_fixture_program_id);
    let (prod_id, price_id) = pyth::add_test_symbol(&mut p2w_test, &pyth_owner);

    let ctx = p2w_test.start_with_context().await;

    let symbols = vec![p2wc::P2WSymbol {
        name:         Some("Mock symbol".to_owned()),
        product_addr: prod_id,
        price_addr:   price_id,
    }];

    let _attest_tx = p2wc::gen_attest_tx(
        p2w_program_id,
        &p2w_config,
        &ctx.payer,
        0,
        symbols.as_slice(),
        ctx.last_blockhash,
    )?;

    // NOTE: 2022-09-05
    // Execution of this transaction is commented out as for some unknown reasons
    // Solana test suite has some unknown behavior in this transaction. It is probably a
    // memory leak that causes either segfault or an invalid error (after a reading an unkown
    // variable from memory). It is probably solved in the following PR:
    // https://github.com/solana-labs/solana/pull/26507
    //
    // TODO: add this check when the above PR is released in our Solana package.
    // ctx.banks_client.process_transaction(attest_tx).await?;

    Ok(())
}
