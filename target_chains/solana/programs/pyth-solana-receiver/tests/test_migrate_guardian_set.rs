//! End-to-end rehearsal of the Pyth Pro multisig migration against the real mainnet bridge.
//!
//! The bridge starts out as the exact binary deployed at
//! `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` on mainnet-beta today (see
//! `tests/fixtures/README.md`), initialized with Wormhole's guardian set 0 and then walked up to
//! guardian set 7 by replaying the seven real mainnet `GuardianSetUpgrade` VAAs. From there the
//! test performs the migration itself — upgrade the program, close every guardian set, re-run
//! `initialize` — and finishes by relaying a production Pyth Pro router VAA through the upgraded
//! bridge into the receiver.
//!
//! Only the `HDwcJ...` deployment is being migrated: the `pro-compatible` bridge at
//! `HDw2E7P8...` was deployed straight onto the Pyth multisig and has no Wormhole guardian set to
//! close, so there is nothing for this test to rehearse there (and the fixture below is the wrong
//! binary for it).
#![cfg(not(feature = "pro-compatible"))]

use {
    anchor_lang::{
        prelude::system_instruction, AnchorDeserialize, AnchorSerialize, InstructionData,
        ToAccountMetas,
    },
    common_test_utils::{default_receiver_config, PRODUCTION_ACCUMULATOR_UPDATE_DATA},
    program_simulator::ProgramSimulator,
    pyth_solana_receiver::{
        instruction::{Initialize, PostUpdate},
        sdk::{deserialize_accumulator_update_data, get_guardian_set_address, DEFAULT_TREASURY_ID},
    },
    pyth_solana_receiver_sdk::{
        config::DataSource,
        price_update::{PriceUpdateV2, VerificationLevel},
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::{messages::Message, wire::from_slice},
    solana_loader_v3_interface::{
        get_program_data_address, instruction as loader_instruction, state::UpgradeableLoaderState,
    },
    solana_program::instruction::Instruction,
    solana_program_test::{find_file, read_file, ProgramTest},
    solana_sdk::{
        account::Account, instruction::AccountMeta, pubkey::Pubkey, rent::Rent, signature::Keypair,
        signer::Signer,
    },
    solana_sdk_ids::bpf_loader_upgradeable,
    wormhole_core_bridge_solana::{
        legacy::{instruction::LegacyInstruction, _PYTH_INITIAL_MULTISIG_SET_PROD},
        sdk::{WriteEncodedVaaArgs, VAA_START},
        state::{Config as BridgeConfig, GuardianSet},
        ID as BRIDGE_ID,
    },
    wormhole_sdk::Chain,
    wormhole_solana::{
        instructions::{initialize as bridge_initialize, upgrade_guardian_set},
        mainnet_guardian_sets::{
            MAINNET_GUARDIAN_SET_TTL_SECONDS, MAINNET_INITIAL_GUARDIAN,
            MAINNET_UPGRADE_GUARDIAN_SET_VAAS,
        },
    },
};

/// The mainnet Core Bridge binary as deployed today, before the migration.
const MAINNET_BRIDGE_FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/wormhole_core_bridge_solana_mainnet.so"
);

/// Guardian set index mainnet is at today, and therefore the highest index this test creates.
const CURRENT_MAINNET_GUARDIAN_SET_INDEX: u32 = 7;

fn loader_account(state: &UpgradeableLoaderState, elf: Option<&[u8]>) -> Account {
    let mut data = bincode::serialize(state).unwrap();
    if let Some(elf) = elf {
        data.extend_from_slice(elf);
    }
    Account {
        lamports: Rent::default().minimum_balance(data.len()).max(1),
        data,
        owner: bpf_loader_upgradeable::ID,
        executable: matches!(state, UpgradeableLoaderState::Program { .. }),
        rent_epoch: 0,
    }
}

/// Seed genesis with `BRIDGE_ID` running `elf` under the upgradeable loader, with `authority`
/// able to upgrade it. `ProgramTest::add_program` would install a non-upgradeable program, which
/// is no good when the whole point is to exercise the upgrade.
fn add_upgradeable_bridge(program_test: &mut ProgramTest, elf: &[u8], authority: Pubkey) {
    let programdata_address = get_program_data_address(&BRIDGE_ID);
    program_test.add_account(
        BRIDGE_ID,
        loader_account(
            &UpgradeableLoaderState::Program {
                programdata_address,
            },
            None,
        ),
    );
    program_test.add_account(
        programdata_address,
        loader_account(
            &UpgradeableLoaderState::ProgramData {
                slot: 0,
                upgrade_authority_address: Some(authority),
            },
            Some(elf),
        ),
    );
}

/// Stage `elf` in a buffer account so the upgrade is a single instruction. Writing the buffer the
/// way `solana program deploy` does would take hundreds of transactions to no useful end.
fn add_upgrade_buffer(program_test: &mut ProgramTest, elf: &[u8], authority: Pubkey) -> Pubkey {
    let buffer = Pubkey::new_unique();
    program_test.add_account(
        buffer,
        loader_account(
            &UpgradeableLoaderState::Buffer {
                authority_address: Some(authority),
            },
            Some(elf),
        ),
    );
    buffer
}

fn init_encoded_vaa_instruction(write_authority: Pubkey, encoded_vaa: Pubkey) -> Instruction {
    Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
            write_authority,
            encoded_vaa,
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
    }
}

fn write_encoded_vaa_instruction(
    write_authority: Pubkey,
    draft_vaa: Pubkey,
    vaa: &[u8],
) -> Instruction {
    Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
            write_authority,
            draft_vaa,
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: 0,
                data: vaa.to_vec(),
            },
        }
        .data(),
    }
}

fn verify_encoded_vaa_instruction(
    write_authority: Pubkey,
    draft_vaa: Pubkey,
    guardian_set_index: u32,
) -> Instruction {
    Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
            write_authority,
            draft_vaa,
            guardian_set: get_guardian_set_address(BRIDGE_ID, guardian_set_index),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    }
}

/// `close_guardian_set` is a legacy instruction, so it is dispatched through the legacy selector
/// rather than an Anchor discriminator and has no generated accounts struct.
fn close_guardian_set_instruction(recipient: Pubkey, guardian_set_index: u32) -> Instruction {
    // `EmptyArgs` serializes to nothing, so the selector is the whole instruction data.
    let mut data = Vec::new();
    LegacyInstruction::CloseGuardianSet
        .serialize(&mut data)
        .unwrap();

    Instruction {
        program_id: BRIDGE_ID,
        accounts: vec![
            AccountMeta::new(recipient, false),
            AccountMeta::new(
                get_guardian_set_address(BRIDGE_ID, guardian_set_index),
                false,
            ),
        ],
        data,
    }
}

/// Write `vaa` into a freshly created [`EncodedVaa`] account and verify it against
/// `guardian_set_index`, returning the account so it can be consumed by a downstream instruction.
async fn post_encoded_vaa(
    program_simulator: &mut ProgramSimulator,
    write_authority: &Keypair,
    vaa: &[u8],
    guardian_set_index: u32,
) -> Pubkey {
    let encoded_vaa = Keypair::new();
    let encoded_vaa_size = vaa.len() + VAA_START;

    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &write_authority.pubkey(),
                &encoded_vaa.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&encoded_vaa],
            Some(write_authority),
        )
        .await
        .unwrap();

    for instruction in [
        init_encoded_vaa_instruction(write_authority.pubkey(), encoded_vaa.pubkey()),
        write_encoded_vaa_instruction(write_authority.pubkey(), encoded_vaa.pubkey(), vaa),
        verify_encoded_vaa_instruction(
            write_authority.pubkey(),
            encoded_vaa.pubkey(),
            guardian_set_index,
        ),
    ] {
        program_simulator
            .process_ix_with_default_compute_limit(instruction, &vec![], Some(write_authority))
            .await
            .unwrap();
    }

    encoded_vaa.pubkey()
}

async fn bridge_config(program_simulator: &mut ProgramSimulator) -> BridgeConfig {
    let address = Pubkey::find_program_address(&[BridgeConfig::SEED_PREFIX], &BRIDGE_ID).0;
    let account = program_simulator
        .get_account(address)
        .await
        .unwrap()
        .unwrap();
    // The bridge config is a legacy account, stored without an Anchor discriminator.
    AnchorDeserialize::deserialize(&mut account.data.as_slice()).unwrap()
}

async fn guardian_set(
    program_simulator: &mut ProgramSimulator,
    guardian_set_index: u32,
) -> Option<GuardianSet> {
    let address = get_guardian_set_address(BRIDGE_ID, guardian_set_index);
    let account = program_simulator.get_account(address).await.unwrap()?;
    // Guardian set 0 is written in the legacy layout (no Anchor discriminator); every other index
    // carries one.
    let mut data: &[u8] = if guardian_set_index == 0 {
        &account.data
    } else {
        &account.data[8..]
    };
    Some(AnchorDeserialize::deserialize(&mut data).unwrap())
}

#[tokio::test]
async fn test_migrate_guardian_set_from_mainnet_bridge() {
    let (pyth_vaa, merkle_price_updates) = deserialize_accumulator_update_data(
        hex::decode(PRODUCTION_ACCUMULATOR_UPDATE_DATA).unwrap(),
    )
    .unwrap();
    let expected_feed =
        from_slice::<byteorder::BE, Message>(merkle_price_updates[0].message.as_ref()).unwrap();

    let mainnet_bridge_elf = read_file(MAINNET_BRIDGE_FIXTURE);
    let migrated_bridge_elf = read_file(
        find_file("wormhole_core_bridge_solana.so").expect("post-migration core-bridge not built"),
    );
    assert_ne!(mainnet_bridge_elf, migrated_bridge_elf);

    let upgrade_authority = Keypair::new();

    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", pyth_solana_receiver::ID, None);
    program_test.add_program("pyth_push_oracle", PYTH_PUSH_ORACLE_ID, None);
    add_upgradeable_bridge(
        &mut program_test,
        &mainnet_bridge_elf,
        upgrade_authority.pubkey(),
    );
    let upgrade_buffer = add_upgrade_buffer(
        &mut program_test,
        &migrated_bridge_elf,
        upgrade_authority.pubkey(),
    );

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;
    let payer = program_simulator.get_funded_keypair().await.unwrap();
    program_simulator
        .airdrop(&upgrade_authority.pubkey(), 1_000_000_000)
        .await
        .unwrap();

    // ---------------------------------------------------------------------------------------
    // 1. Bring the pre-migration bridge up to mainnet's current guardian set history: Wormhole's
    //    guardian set 0, then sets 1 through 7 from the real upgrade VAAs.
    // ---------------------------------------------------------------------------------------
    let initial_guardian: [u8; 20] = hex::decode(MAINNET_INITIAL_GUARDIAN)
        .unwrap()
        .try_into()
        .unwrap();
    program_simulator
        .process_ix_with_default_compute_limit(
            bridge_initialize(
                BRIDGE_ID,
                payer.pubkey(),
                0,
                MAINNET_GUARDIAN_SET_TTL_SECONDS,
                &[initial_guardian],
            )
            .unwrap(),
            &vec![&payer],
            None,
        )
        .await
        .unwrap();

    assert_eq!(
        guardian_set(&mut program_simulator, 0).await.unwrap().keys,
        vec![initial_guardian],
        "the pre-migration bridge honours the initial guardians it is given"
    );

    for (index, upgrade_vaa) in MAINNET_UPGRADE_GUARDIAN_SET_VAAS.iter().enumerate() {
        let current_index = index as u32;
        let upgrade_vaa = hex::decode(upgrade_vaa).unwrap();
        let vaa_body: wormhole_sdk::Vaa<&serde_wormhole::RawMessage> =
            serde_wormhole::from_slice(&upgrade_vaa).unwrap();

        let encoded_vaa =
            post_encoded_vaa(&mut program_simulator, &payer, &upgrade_vaa, current_index).await;

        program_simulator
            .process_ix_with_default_compute_limit(
                upgrade_guardian_set(
                    BRIDGE_ID,
                    payer.pubkey(),
                    encoded_vaa,
                    current_index,
                    Pubkey::from(vaa_body.emitter_address.0),
                    vaa_body.sequence,
                )
                .unwrap(),
                &vec![&payer],
                Some(&payer),
            )
            .await
            .unwrap();
    }

    assert_eq!(
        bridge_config(&mut program_simulator)
            .await
            .guardian_set_index,
        CURRENT_MAINNET_GUARDIAN_SET_INDEX,
        "the bridge tracks mainnet's current guardian set index"
    );
    assert_eq!(
        guardian_set(&mut program_simulator, CURRENT_MAINNET_GUARDIAN_SET_INDEX)
            .await
            .unwrap()
            .keys
            .len(),
        19,
        "guardian set 7 holds the 19 Wormhole guardians"
    );

    // The receiver is configured against the Pyth Pro emitter from the start; only the bridge's
    // guardian set changes over the course of the migration.
    let mut receiver_config = default_receiver_config(payer.pubkey());
    receiver_config.valid_data_sources[0] = DataSource {
        chain: Chain::Pythnet.into(),
        emitter: Pubkey::from(*b"PythnetPythnetPythnetPythnetPyth"),
    };
    program_simulator
        .process_ix_with_default_compute_limit(
            Initialize::populate(&payer.pubkey(), receiver_config),
            &vec![&payer],
            None,
        )
        .await
        .unwrap();

    // The Pyth Pro VAA is signed by the multisig, not by the Wormhole guardians, so the bridge
    // rejects it in its pre-migration state. Without this the final assertions would pass just as
    // well against a bridge that had never been migrated.
    let unverified_pyth_vaa = Keypair::new();
    let encoded_vaa_size = pyth_vaa.len() + VAA_START;
    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &payer.pubkey(),
                &unverified_pyth_vaa.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&unverified_pyth_vaa],
            Some(&payer),
        )
        .await
        .unwrap();
    for instruction in [
        init_encoded_vaa_instruction(payer.pubkey(), unverified_pyth_vaa.pubkey()),
        write_encoded_vaa_instruction(payer.pubkey(), unverified_pyth_vaa.pubkey(), &pyth_vaa),
    ] {
        program_simulator
            .process_ix_with_default_compute_limit(instruction, &vec![], Some(&payer))
            .await
            .unwrap();
    }
    assert!(
        program_simulator
            .process_ix_with_default_compute_limit(
                verify_encoded_vaa_instruction(payer.pubkey(), unverified_pyth_vaa.pubkey(), 0),
                &vec![],
                Some(&payer),
            )
            .await
            .is_err(),
        "the pre-migration bridge must not verify a Pyth Pro VAA"
    );

    // ---------------------------------------------------------------------------------------
    // 2. Migrate: upgrade the program, close every guardian set, re-initialize at index 0.
    // ---------------------------------------------------------------------------------------
    program_simulator
        .process_ix_with_default_compute_limit(
            loader_instruction::upgrade(
                &BRIDGE_ID,
                &upgrade_buffer,
                &upgrade_authority.pubkey(),
                &payer.pubkey(),
            ),
            &vec![&upgrade_authority],
            Some(&payer),
        )
        .await
        .unwrap();

    // The upgraded program only becomes executable in the slot after the one the upgrade landed
    // in, so nothing below would dispatch to the new code without this.
    program_simulator.advance_slot().await.unwrap();

    for guardian_set_index in 0..=CURRENT_MAINNET_GUARDIAN_SET_INDEX {
        program_simulator
            .process_ix_with_default_compute_limit(
                close_guardian_set_instruction(payer.pubkey(), guardian_set_index),
                &vec![],
                Some(&payer),
            )
            .await
            .unwrap();
    }

    for guardian_set_index in 0..=CURRENT_MAINNET_GUARDIAN_SET_INDEX {
        assert!(
            program_simulator
                .get_account(get_guardian_set_address(BRIDGE_ID, guardian_set_index))
                .await
                .unwrap()
                .is_none(),
            "guardian set {guardian_set_index} still exists after the migration"
        );
    }

    program_simulator
        .process_ix_with_default_compute_limit(
            bridge_initialize(
                BRIDGE_ID,
                payer.pubkey(),
                0,
                MAINNET_GUARDIAN_SET_TTL_SECONDS,
                // Ignored by the post-migration program, which always installs the Pyth multisig.
                &[initial_guardian],
            )
            .unwrap(),
            &vec![&payer],
            None,
        )
        .await
        .unwrap();

    let migrated_guardian_set = guardian_set(&mut program_simulator, 0).await.unwrap();
    assert_eq!(
        migrated_guardian_set.keys, _PYTH_INITIAL_MULTISIG_SET_PROD,
        "guardian set 0 is the Pyth multisig, not the guardians passed to initialize"
    );
    assert_eq!(migrated_guardian_set.index, 0);
    assert_eq!(migrated_guardian_set.expiration_time, 0u32);

    assert_eq!(
        bridge_config(&mut program_simulator)
            .await
            .guardian_set_index,
        0,
        "the migrated bridge is back at guardian set index 0"
    );

    // ---------------------------------------------------------------------------------------
    // 3. Relay a production Pyth Pro VAA through the migrated bridge into the receiver.
    // ---------------------------------------------------------------------------------------
    let encoded_vaa = post_encoded_vaa(&mut program_simulator, &payer, &pyth_vaa, 0).await;

    let price_update_keypair = Keypair::new();
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdate::populate(
                payer.pubkey(),
                payer.pubkey(),
                encoded_vaa,
                price_update_keypair.pubkey(),
                merkle_price_updates[0].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&payer, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    let price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        expected_feed
    );
}
