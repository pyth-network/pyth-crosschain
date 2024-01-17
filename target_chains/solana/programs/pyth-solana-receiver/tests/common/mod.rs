use {
    anchor_lang::AnchorSerialize,
    program_simulator::ProgramSimulator,
    pyth_solana_receiver::{
        instruction::Initialize,
        sdk::{
            get_config_address,
            get_treasury_address,
        },
        state::config::{
            Config,
            DataSource,
        },
        ID,
    },
    pythnet_sdk::{
        accumulators::{
            merkle::MerkleTree,
            Accumulator,
        },
        hashers::keccak256_160::Keccak160,
        messages::{
            Message,
            PriceFeedMessage,
        },
        wire::{
            v1::MerklePriceUpdate,
            PrefixedVec,
        },
    },
    serde_wormhole::RawMessage,
    solana_program::{
        pubkey::Pubkey,
        rent::Rent,
    },
    solana_program_test::ProgramTest,
    solana_sdk::{
        account::Account,
        signature::Keypair,
        signer::Signer,
    },
    wormhole_core_bridge_solana::{
        state::{
            EncodedVaa,
            Header,
            ProcessingStatus,
        },
        ID as BRIDGE_ID,
    },
    wormhole_sdk::{
        Chain,
        Vaa,
    },
};

pub fn dummy_receiver_config(data_source: DataSource) -> Config {
    Config {
        governance_authority:          Pubkey::new_unique(),
        target_governance_authority:   None,
        wormhole:                      BRIDGE_ID,
        valid_data_sources:            vec![DataSource {
            chain:   data_source.chain,
            emitter: data_source.emitter,
        }],
        single_update_fee_in_lamports: 1,
        minimum_signatures:            5,
    }
}

pub fn dummy_data_source() -> DataSource {
    let emitter_address = Pubkey::new_unique().to_bytes();
    let emitter_chain = Chain::Pythnet;
    DataSource {
        chain:   emitter_chain.into(),
        emitter: Pubkey::from(emitter_address),
    }
}

pub fn dummy_price_messages() -> Vec<PriceFeedMessage> {
    vec![
        PriceFeedMessage {
            feed_id:           [0u8; 32],
            price:             1,
            conf:              2,
            exponent:          3,
            publish_time:      4,
            prev_publish_time: 5,
            ema_price:         6,
            ema_conf:          7,
        },
        PriceFeedMessage {
            feed_id:           [8u8; 32],
            price:             9,
            conf:              10,
            exponent:          11,
            publish_time:      12,
            prev_publish_time: 13,
            ema_price:         14,
            ema_conf:          15,
        },
    ]
}

pub fn dummy_price_updates() -> (MerkleTree<Keccak160>, Vec<MerklePriceUpdate>) {
    let price_feed_messages: Vec<Message> = dummy_price_messages()
        .iter()
        .map(|x| Message::PriceFeedMessage(*x))
        .collect::<Vec<Message>>();
    let price_feed_message_as_vec: Vec<Vec<u8>> = price_feed_messages
        .iter()
        .map(|x| pythnet_sdk::wire::to_vec::<_, byteorder::BigEndian>(&x).unwrap())
        .collect();

    let merkle_tree_accumulator =
        MerkleTree::<Keccak160>::from_set(price_feed_message_as_vec.iter().map(|x| x.as_ref()))
            .unwrap();
    let merkle_price_updates: Vec<MerklePriceUpdate> = price_feed_message_as_vec
        .iter()
        .map(|x| MerklePriceUpdate {
            message: PrefixedVec::<u16, u8>::from(x.clone()),
            proof:   merkle_tree_accumulator.prove(x.as_ref()).unwrap(),
        })
        .collect();

    (merkle_tree_accumulator, merkle_price_updates)
}


pub fn build_merkle_root_encoded_vaa(
    merkle_tree_accumulator: MerkleTree<Keccak160>,
    data_source: &DataSource,
) -> Account {
    let merkle_tree_payload: Vec<u8> = merkle_tree_accumulator.serialize(1, 1);

    let vaa_header: Vaa<Box<RawMessage>> = Vaa {
        version:            1,
        guardian_set_index: 0,
        signatures:         vec![],
        timestamp:          0,
        nonce:              0,
        emitter_chain:      Chain::from(data_source.chain),
        emitter_address:    wormhole_sdk::Address(data_source.emitter.to_bytes()),
        sequence:           0,
        consistency_level:  0,
        payload:            <Box<RawMessage>>::from(merkle_tree_payload),
    };

    let encoded_vaa_data = (
        <EncodedVaa as anchor_lang::Discriminator>::DISCRIMINATOR,
        Header {
            status:          ProcessingStatus::Verified,
            write_authority: Pubkey::new_unique(),
            version:         1,
        },
        serde_wormhole::to_vec(&vaa_header).unwrap(),
    )
        .try_to_vec()
        .unwrap();


    Account {
        lamports:   Rent::default().minimum_balance(encoded_vaa_data.len()),
        data:       encoded_vaa_data,
        owner:      BRIDGE_ID,
        executable: false,
        rent_epoch: 0,
    }
}


pub struct ProgramTestFixtures {
    pub program_simulator:    ProgramSimulator,
    pub encoded_vaa_address:  Pubkey,
    pub merkle_price_updates: Vec<MerklePriceUpdate>,
}
/**
 * Setup to test the Pyth Receiver. The return values are a tuple composed of :
 * - The program simulator, which is used to send transactions
 * - The pubkey of an encoded VAA account, which is pre-populated and can be used to test post_updates
 * - A vector of MerklePriceUpdate, corresponding to that VAA
 */
pub async fn setup_pyth_receiver() -> ProgramTestFixtures {
    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", ID, None);

    let (merkle_tree_accumulator, merkle_price_updates) = dummy_price_updates();
    let data_source = dummy_data_source();
    let merkle_root_encoded_vaa =
        build_merkle_root_encoded_vaa(merkle_tree_accumulator, &data_source);

    let encoded_vaa_address = Pubkey::new_unique();
    program_test.add_account(encoded_vaa_address, merkle_root_encoded_vaa);


    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    let initial_config = dummy_receiver_config(data_source);

    let setup_keypair: Keypair = program_simulator.get_funded_keypair().await.unwrap();

    program_simulator
        .process_ix(
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

    program_simulator
        .airdrop(&get_treasury_address(), Rent::default().minimum_balance(0))
        .await
        .unwrap();


    ProgramTestFixtures {
        program_simulator,
        encoded_vaa_address,
        merkle_price_updates,
    }
}
