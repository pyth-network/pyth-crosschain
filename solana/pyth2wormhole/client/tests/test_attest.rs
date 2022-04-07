pub mod fixtures;

use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{
        AccountMeta,
        Instruction,
    },
    pubkey::Pubkey,
    rent::Rent,
    signature::Signer,
    signer::keypair::Keypair,
    transaction::Transaction,
};

use bridge::accounts::{
    Bridge,
    BridgeConfig,
    BridgeData,
};

use pyth2wormhole::config::{
    P2WConfigAccount,
    Pyth2WormholeConfig,
};
use pyth2wormhole_client as p2wc;
use solitaire::{
    processors::seeded::Seeded,
    AccountState,
    BorshSerialize,
};

use fixtures::{
    passthrough,
    pyth,
};

#[tokio::test]
async fn test_happy_path() -> Result<(), solitaire::ErrBox> {
    // Programs
    let p2w_program_id = Pubkey::new_unique();
    let wh_fixture_program_id = Pubkey::new_unique();

    // Authorities
    let p2w_owner = Pubkey::new_unique();
    let pyth_owner = Pubkey::new_unique();

    // On-chain state
    let p2w_config = Pyth2WormholeConfig {
        owner: p2w_owner,
        wh_prog: wh_fixture_program_id,
        max_batch_size: pyth2wormhole::attest::P2W_MAX_BATCH_SIZE,
        pyth_owner,
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
        "pyth2wormhole",
        p2w_program_id,
        processor!(pyth2wormhole::instruction::solitaire),
    );

    // Plant a filled config account
    let p2w_config_bytes = p2w_config.try_to_vec()?;
    let p2w_config_account = Account {
        lamports: Rent::default().minimum_balance(p2w_config_bytes.len()),
        data: p2w_config_bytes,
        owner: p2w_program_id,
        executable: false,
        rent_epoch: 0,
    };
    let p2w_config_addr =
        P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_program_id);

    p2w_test.add_account(p2w_config_addr, p2w_config_account);

    // Plant a bridge config
    let bridge_config_bytes = bridge_config.try_to_vec()?;
    let wh_bridge_config_account = Account {
        lamports: Rent::default().minimum_balance(bridge_config_bytes.len()),
        data: bridge_config_bytes,
        owner: wh_fixture_program_id,
        executable: false,
        rent_epoch: 0,
    };

    let wh_bridge_config_addr =
        Bridge::<{ AccountState::Initialized }>::key(None, &wh_fixture_program_id);

    p2w_test.add_account(wh_bridge_config_addr, wh_bridge_config_account);

    passthrough::add_passthrough(&mut p2w_test, "wormhole", wh_fixture_program_id);
    let (prod_id, price_id) = pyth::add_test_symbol(&mut p2w_test, &pyth_owner);

    let mut ctx = p2w_test.start_with_context().await;
    let msg_keypair = Keypair::new();

    let symbols = vec![p2wc::P2WSymbol {
        name: Some("Mock symbol".to_owned()),
        product_addr: prod_id,
        price_addr: price_id,
    }];

    let attest_tx = p2wc::gen_attest_tx(
        p2w_program_id,
        &p2w_config,
        &ctx.payer,
        symbols.as_slice(),
        &msg_keypair,
        ctx.last_blockhash,
    )?;
    ctx.banks_client.process_transaction(attest_tx).await?;

    Ok(())
}
