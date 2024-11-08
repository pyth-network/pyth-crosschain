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
    let encoded_vaa_data = (
        <EncodedVaa as anchor_lang::Discriminator>::DISCRIMINATOR,
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
        .try_to_vec()
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
                    &keccak::hashv(&[&PublicKey::from_secret_key(x).serialize()[1..]]).0[12..],
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

    let guardian_set_data = (
        <GuardianSet as anchor_lang::Discriminator>::DISCRIMINATOR,
        guardian_set,
    )
        .try_to_vec()
        .unwrap();

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
