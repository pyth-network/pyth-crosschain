use {
    anchor_lang::AnchorSerialize,
    libsecp256k1::PublicKey,
    program_simulator::ProgramSimulator,
    pyth_solana_receiver::{instruction::Initialize, sdk::get_guardian_set_address, ID},
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        pda::{get_config_address, get_treasury_address},
        PYTH_PUSH_ORACLE_ID,
    },
    pythnet_sdk::test_utils::{dummy_guardians, DEFAULT_DATA_SOURCE},
    serde_wormhole::RawMessage,
    solana_program::{keccak, pubkey::Pubkey, rent::Rent},
    solana_program_test::ProgramTest,
    solana_sdk::{account::Account, signature::Keypair, signer::Signer},
    wormhole_core_bridge_solana::{
        state::{EncodedVaa, GuardianSet, Header, ProcessingStatus},
        ID as BRIDGE_ID,
    },
    wormhole_sdk::Vaa,
};

pub const DEFAULT_GUARDIAN_SET_INDEX: u32 = 0;

/// Accumulator update data observed on mainnet, signed by the production Pyth Pro router multisig.
/// Verifying it exercises the real guardian set that `initialize` installs rather than a set of
/// test keys.
pub const PRODUCTION_ACCUMULATOR_UPDATE_DATA: &str = "504e4155010000000124010000000003016c35c53600ce71c881ecd577ae72838aaf462b588d87913488062d5023027b4159450fafef39f574cfc0e2c4b2b0b60bee1ebaaafe524cef268046212e4ee919000271a1a64d9f4f19978ba43b7a312e37b13607c104eea4d9a1504148c3ffcec1286c40a2bccd0783c1c81d18b5645e51cdfcb58856805bf4046dc94e62c6144e920104298c0f75509f1c0caab656dba73de32f7875ef729a8c6737a7346cd613f44b3661febc579e362c8a9a949dbfae53009c5fb843a9a19a6e15ee0a2f657343d74d006a8854ce00000000001a507974686e6574507974686e6574507974686e6574507974686e6574507974680000000852a6a0180041555756000000000852a6a01800000000758a84cfa78245c794a812f5c7e57b6a619aaed702005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43000006f7c61dcbe600000000438c5c4cfffffff8000000006a8854ce000000006a8854cd00000701203361c00000000061273c220c5e85322bfba771a5dc9e39f34d137c70d1c2346732e4df44e3b1c18d9579b71a32ac182b1507ea50ef5d5a816a0f64e5aea0351ac6b201eab10b8cd0a9b39d1bc2b43ef88195bd74fffc1b2f7fdb3c65c7e01642a2ebef5a2788379e21767d7cba9bc28d3464b952826dbeab662ea97e42744ead9d580cf1d3839ebc161f3e1f2b4c58b2401b1fe95512886ff8d74af4e19bc635e719ca149b6ab549dcf8c6811d4f45953675a46e3daaf59893bab38787c3f3747bc72e3df39256a5d173f06d5c9d3f6eaf32f714c30977a014f23d6361857360e72a6c6f73b2795babb0e8805e2e66f202278cacb2202901689eb248005500ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace000000376b75af8b0000000002829cf4fffffff8000000006a8854ce000000006a8854cd000000376efa88900000000001eab4ec0c81c435c8b71ffe6b922e26e384fe45133455194832e4df44e3b1c18d9579b71a32ac182b1507ea50ef5d5a816a0f64e5aea0351ac6b201eab10b8cd0a9b39d1bc2b43ef88195bd74fffc1b2f7fdb3c65c7e01642a2ebef5a2788379e21767d7cba9bc28d3464b952826dbeab662ea97e42744ead9d580cf1d3839ebc161f3e1f2b4c58b2401b1fe95512886ff8d74af4e19bc635e719ca149b6ab549dcf8c6811d4f45953675a46e3daaf59893bab38787c3f3747bc72e3df39256a5d173f06d5c9d3f6eaf32f714c30977a014f23d6361857360e72a6c6f73b2795babb0e8805e2e66f202278cacb2202901689eb248";
pub const WRONG_GUARDIAN_SET_INDEX: u32 = 1;

pub fn default_receiver_config(governance_authority: Pubkey) -> Config {
    Config {
        governance_authority,
        target_governance_authority: None,
        wormhole: BRIDGE_ID,
        valid_data_sources: vec![DataSource {
            chain: DEFAULT_DATA_SOURCE.chain.into(),
            emitter: Pubkey::from(DEFAULT_DATA_SOURCE.address.0),
        }],
        single_update_fee_in_lamports: 1,
        minimum_signatures: 5,
    }
}

pub struct ProgramTestFixtures {
    pub program_simulator: ProgramSimulator,
    pub encoded_vaa_addresses: Vec<Pubkey>,
    pub governance_authority: Keypair,
}

pub fn build_encoded_vaa_account_from_vaa(
    vaa: Vaa<&RawMessage>,
    wrong_setup_option: WrongSetupOption,
) -> Account {
    let mut encoded_vaa_data = vec![];
    encoded_vaa_data.extend_from_slice(<EncodedVaa as anchor_lang::Discriminator>::DISCRIMINATOR);
    (
        Header {
            status: {
                if matches!(wrong_setup_option, WrongSetupOption::UnverifiedEncodedVaa) {
                    ProcessingStatus::Writing
                } else {
                    ProcessingStatus::Verified
                }
            },
            write_authority: Pubkey::new_unique(),
            version: 1,
        },
        serde_wormhole::to_vec(&vaa).unwrap(),
    )
        .serialize(&mut encoded_vaa_data)
        .unwrap();

    Account {
        lamports: Rent::default().minimum_balance(encoded_vaa_data.len()),
        data: encoded_vaa_data,
        owner: BRIDGE_ID,
        executable: false,
        rent_epoch: 0,
    }
}

pub fn build_guardian_set_account(wrong_setup_option: WrongSetupOption) -> Account {
    let guardian_set = GuardianSet {
        index: {
            if matches!(wrong_setup_option, WrongSetupOption::GuardianSetWrongIndex) {
                WRONG_GUARDIAN_SET_INDEX
            } else {
                DEFAULT_GUARDIAN_SET_INDEX
            }
        },
        keys: dummy_guardians()
            .iter()
            .map(|x| {
                let mut result: [u8; 20] = [0u8; 20];
                result.copy_from_slice(
                    &keccak::hashv(&[&PublicKey::from_secret_key(x).serialize()[1..]]).to_bytes()
                        [12..],
                );
                result
            })
            .collect::<Vec<[u8; 20]>>(),
        creation_time: 0.into(),
        expiration_time: {
            if matches!(wrong_setup_option, WrongSetupOption::GuardianSetExpired) {
                1
            } else {
                0
            }
        }
        .into(),
    };

    let mut guardian_set_data = vec![];
    guardian_set_data.extend_from_slice(<GuardianSet as anchor_lang::Discriminator>::DISCRIMINATOR);
    guardian_set.serialize(&mut guardian_set_data).unwrap();

    Account {
        lamports: Rent::default().minimum_balance(guardian_set_data.len()),
        data: guardian_set_data,
        owner: BRIDGE_ID,
        executable: false,
        rent_epoch: 0,
    }
}

#[derive(Copy, Clone)]
pub enum WrongSetupOption {
    None,
    GuardianSetExpired,
    GuardianSetWrongIndex,
    UnverifiedEncodedVaa,
}

/**
 * Setup to test the Pyth Receiver. The return values are a tuple composed of :
 * - The program simulator, which is used to send transactions
 * - The pubkeys of the encoded VAA accounts corresponding to the VAAs passed as argument, these accounts are prepopulated and can be used to test post_update
 */
pub async fn setup_pyth_receiver(
    vaas: Vec<Vaa<&RawMessage>>,
    wrong_setup_option: WrongSetupOption,
) -> ProgramTestFixtures {
    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", ID, None);
    program_test.add_program("pyth_push_oracle", PYTH_PUSH_ORACLE_ID, None);

    let mut encoded_vaa_addresses: Vec<Pubkey> = vec![];
    for vaa in vaas {
        let encoded_vaa_address = Pubkey::new_unique();
        encoded_vaa_addresses.push(encoded_vaa_address);
        program_test.add_account(
            encoded_vaa_address,
            build_encoded_vaa_account_from_vaa(vaa, wrong_setup_option),
        );
    }
    program_test.add_account(
        get_guardian_set_address(BRIDGE_ID, DEFAULT_GUARDIAN_SET_INDEX),
        build_guardian_set_account(wrong_setup_option),
    );

    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    let setup_keypair: Keypair = program_simulator.get_funded_keypair().await.unwrap();
    let initial_config = default_receiver_config(setup_keypair.pubkey());

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

    ProgramTestFixtures {
        program_simulator,
        encoded_vaa_addresses,
        governance_authority: setup_keypair,
    }
}

pub async fn assert_treasury_balance(
    program_simulator: &mut ProgramSimulator,
    expected_balance: u64,
    treasury_id: u8,
) {
    let treasury_balance = program_simulator
        .get_balance(get_treasury_address(treasury_id))
        .await
        .unwrap();

    assert_eq!(treasury_balance, expected_balance);
}
