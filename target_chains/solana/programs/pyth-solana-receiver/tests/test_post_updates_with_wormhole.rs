use {
    anchor_lang::{prelude::system_instruction, InstructionData, ToAccountMetas},
    common_test_utils::{default_receiver_config, DEFAULT_GUARDIAN_SET_INDEX},
    program_simulator::{into_transaction_error, ProgramSimulator},
    pyth_solana_receiver::{
        instruction::{Initialize, PostUpdate},
        sdk::{deserialize_accumulator_update_data, get_guardian_set_address, DEFAULT_TREASURY_ID},
    },
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        pda::get_config_address,
        price_update::{PriceUpdateV2, VerificationLevel},
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::{
        messages::Message,
        test_utils::{dummy_guardians_addresses, trim_vaa_signatures},
        wire::from_slice,
    },
    solana_program::instruction::Instruction,
    solana_program_test::ProgramTest,
    solana_sdk::{pubkey::Pubkey, rent::Rent, signature::Keypair, signer::Signer},
    wormhole_core_bridge_solana::{
        error::CoreBridgeError,
        sdk::{WriteEncodedVaaArgs, VAA_START},
        ID as BRIDGE_ID,
    },
    wormhole_sdk::Chain,
};

fn get_verify_encoded_vaa_instruction(write_authority: Pubkey, draft_vaa: Pubkey) -> Instruction {
    Instruction {
        program_id: BRIDGE_ID,
        accounts: wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
            write_authority,
            draft_vaa,
            guardian_set: get_guardian_set_address(BRIDGE_ID, DEFAULT_GUARDIAN_SET_INDEX),
        }
        .to_account_metas(None),
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    }
}

// Accumulator update data from the production Pyth Pro router multisig
const ACCUMULATOR_UPDATE_DATA: &str = "504e4155010000000124010000000003016c35c53600ce71c881ecd577ae72838aaf462b588d87913488062d5023027b4159450fafef39f574cfc0e2c4b2b0b60bee1ebaaafe524cef268046212e4ee919000271a1a64d9f4f19978ba43b7a312e37b13607c104eea4d9a1504148c3ffcec1286c40a2bccd0783c1c81d18b5645e51cdfcb58856805bf4046dc94e62c6144e920104298c0f75509f1c0caab656dba73de32f7875ef729a8c6737a7346cd613f44b3661febc579e362c8a9a949dbfae53009c5fb843a9a19a6e15ee0a2f657343d74d006a8854ce00000000001a507974686e6574507974686e6574507974686e6574507974686e6574507974680000000852a6a0180041555756000000000852a6a01800000000758a84cfa78245c794a812f5c7e57b6a619aaed702005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43000006f7c61dcbe600000000438c5c4cfffffff8000000006a8854ce000000006a8854cd00000701203361c00000000061273c220c5e85322bfba771a5dc9e39f34d137c70d1c2346732e4df44e3b1c18d9579b71a32ac182b1507ea50ef5d5a816a0f64e5aea0351ac6b201eab10b8cd0a9b39d1bc2b43ef88195bd74fffc1b2f7fdb3c65c7e01642a2ebef5a2788379e21767d7cba9bc28d3464b952826dbeab662ea97e42744ead9d580cf1d3839ebc161f3e1f2b4c58b2401b1fe95512886ff8d74af4e19bc635e719ca149b6ab549dcf8c6811d4f45953675a46e3daaf59893bab38787c3f3747bc72e3df39256a5d173f06d5c9d3f6eaf32f714c30977a014f23d6361857360e72a6c6f73b2795babb0e8805e2e66f202278cacb2202901689eb248005500ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace000000376b75af8b0000000002829cf4fffffff8000000006a8854ce000000006a8854cd000000376efa88900000000001eab4ec0c81c435c8b71ffe6b922e26e384fe45133455194832e4df44e3b1c18d9579b71a32ac182b1507ea50ef5d5a816a0f64e5aea0351ac6b201eab10b8cd0a9b39d1bc2b43ef88195bd74fffc1b2f7fdb3c65c7e01642a2ebef5a2788379e21767d7cba9bc28d3464b952826dbeab662ea97e42744ead9d580cf1d3839ebc161f3e1f2b4c58b2401b1fe95512886ff8d74af4e19bc635e719ca149b6ab549dcf8c6811d4f45953675a46e3daaf59893bab38787c3f3747bc72e3df39256a5d173f06d5c9d3f6eaf32f714c30977a014f23d6361857360e72a6c6f73b2795babb0e8805e2e66f202278cacb2202901689eb248";

#[tokio::test]
async fn test_post_update_with_wormhole() {
    let (vaa, merkle_price_updates) =
        deserialize_accumulator_update_data(hex::decode(ACCUMULATOR_UPDATE_DATA).unwrap()).unwrap();
    let feed_1 =
        from_slice::<byteorder::BE, Message>(merkle_price_updates[0].message.as_ref()).unwrap();

    // 2. Program setup: ProgramTest with pyth_solana_receiver, pyth_push_oracle, and wormhole core-bridge
    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", pyth_solana_receiver::ID, None);
    program_test.add_program("pyth_push_oracle", PYTH_PUSH_ORACLE_ID, None);
    program_test.add_program("wormhole_core_bridge_solana", BRIDGE_ID, None);

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    // 3. Initialize wormhole and pyth receiver
    let setup_keypair = program_simulator.get_funded_keypair().await.unwrap();

    program_simulator
        .process_ix_with_default_compute_limit(
            wormhole_solana::instructions::initialize(
                BRIDGE_ID,
                setup_keypair.pubkey(),
                0,
                86400,
                &dummy_guardians_addresses(),
            )
            .unwrap(),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    let mut initial_config = default_receiver_config(setup_keypair.pubkey());
    initial_config.valid_data_sources[0] = DataSource {
        chain: Chain::Pythnet.into(),
        emitter: Pubkey::from(*b"PythnetPythnetPythnetPythnetPyth"),
    };

    program_simulator
        .process_ix_with_default_compute_limit(
            Initialize::populate(&setup_keypair.pubkey(), initial_config.clone()),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    let config_account = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(config_account, initial_config);

    // 4. Create encoded VAA via core-bridge instructions
    let write_authority = program_simulator.get_funded_keypair().await.unwrap();
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    // TX1: Create account for encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &write_authority.pubkey(),
                &encoded_vaa_keypair.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&encoded_vaa_keypair],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX2: Init encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    encoded_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX3: Write first part of VAA data, we didn't write the last 10 bytes
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: 0,
                        data: vaa[..vaa.len() - 10].to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // Verify should fail because we didn't write the last 10 bytes
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                get_verify_encoded_vaa_instruction(
                    write_authority.pubkey(),
                    encoded_vaa_keypair.pubkey()
                ),
                &vec![],
                Some(&write_authority),
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::InvalidGuardianKeyRecovery)
    );

    // Posting an update should fail because the VAA is not verified
    let poster = program_simulator.get_funded_keypair().await.unwrap();
    let price_update_keypair = Keypair::new();
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                PostUpdate::populate(
                    poster.pubkey(),
                    poster.pubkey(),
                    encoded_vaa_keypair.pubkey(),
                    price_update_keypair.pubkey(),
                    merkle_price_updates[0].clone(),
                    DEFAULT_TREASURY_ID
                ),
                &vec![&poster, &price_update_keypair],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::UnverifiedVaa)
    );

    // TX4: Write remaining VAA data
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: (vaa.len() - 10).try_into().unwrap(),
                        data: vaa[vaa.len() - 10..].to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX5: Verify encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            get_verify_encoded_vaa_instruction(
                write_authority.pubkey(),
                encoded_vaa_keypair.pubkey(),
            ),
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // 5. Post update using the core-bridge-verified encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            PostUpdate::populate(
                poster.pubkey(),
                poster.pubkey(),
                encoded_vaa_keypair.pubkey(),
                price_update_keypair.pubkey(),
                merkle_price_updates[0].clone(),
                DEFAULT_TREASURY_ID,
            ),
            &vec![&poster, &price_update_keypair],
            None,
        )
        .await
        .unwrap();

    // 6. Assertions
    let price_update_account = program_simulator
        .get_anchor_account_data::<PriceUpdateV2>(price_update_keypair.pubkey())
        .await
        .unwrap();

    assert_eq!(price_update_account.write_authority, poster.pubkey());
    assert_eq!(
        price_update_account.verification_level,
        VerificationLevel::Full
    );
    assert_eq!(
        Message::PriceFeedMessage(price_update_account.price_message),
        feed_1
    );
    assert_eq!(
        price_update_account.posted_slot,
        program_simulator.get_clock().await.unwrap().slot
    );
}

#[tokio::test]
async fn test_wormhole_insufficient_signatures() {
    let (vaa, _) =
        deserialize_accumulator_update_data(hex::decode(ACCUMULATOR_UPDATE_DATA).unwrap()).unwrap();

    // Trim the VAA to 9 signatures
    let vaa = serde_wormhole::to_vec(&trim_vaa_signatures(
        serde_wormhole::from_slice(&vaa).unwrap(),
        2,
    ))
    .unwrap();

    // 2. Program setup: Prog§ramTest with wormhole core-bridge
    let mut program_test = ProgramTest::default();
    program_test.add_program("wormhole_core_bridge_solana", BRIDGE_ID, None);

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    // 3. Initialize wormhole
    let setup_keypair = program_simulator.get_funded_keypair().await.unwrap();
    program_simulator
        .process_ix_with_default_compute_limit(
            wormhole_solana::instructions::initialize(
                BRIDGE_ID,
                setup_keypair.pubkey(),
                0,
                86400,
                &dummy_guardians_addresses(),
            )
            .unwrap(),
            &vec![&setup_keypair],
            None,
        )
        .await
        .unwrap();

    // 4. Create encoded VAA via core-bridge instructions
    let write_authority = program_simulator.get_funded_keypair().await.unwrap();
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    // TX1: Create account for encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            system_instruction::create_account(
                &write_authority.pubkey(),
                &encoded_vaa_keypair.pubkey(),
                Rent::default().minimum_balance(encoded_vaa_size),
                encoded_vaa_size as u64,
                &BRIDGE_ID,
            ),
            &vec![&encoded_vaa_keypair],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX2: Init encoded VAA
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::InitEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    encoded_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX3: Write VAA data
    program_simulator
        .process_ix_with_default_compute_limit(
            Instruction {
                program_id: BRIDGE_ID,
                accounts: wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
                    write_authority: write_authority.pubkey(),
                    draft_vaa: encoded_vaa_keypair.pubkey(),
                }
                .to_account_metas(None),
                data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
                    args: WriteEncodedVaaArgs {
                        index: 0,
                        data: vaa.to_vec(),
                    },
                }
                .data(),
            },
            &vec![],
            Some(&write_authority),
        )
        .await
        .unwrap();

    // TX4: Verify encoded VAA, it fails because we are below guardian set quorum
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                get_verify_encoded_vaa_instruction(
                    write_authority.pubkey(),
                    encoded_vaa_keypair.pubkey()
                ),
                &vec![],
                Some(&write_authority),
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(CoreBridgeError::NoQuorum)
    );
}
