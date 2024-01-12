use {
    anchor_lang::AnchorSerialize,
    libsecp256k1::{
        curve::Scalar,
        SecretKey,
    },
    program_simulator::ProgramSimulator,
    pyth_solana_receiver::{
        instruction::Initialize,
        sdk::get_treasury_address,
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
        native_token::LAMPORTS_PER_SOL,
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

pub const NUMBER_OF_GUARDIANS: u64 = 19;
pub const EMITTER_CHAIN: u32 = 26;
pub const EMITTER_ADDRESS: [u8; 32] = [0u8; 32];

pub async fn get_guardian_keys() -> Vec<SecretKey> {
    let mut guardian_keys = Vec::new();
    for i in 0..NUMBER_OF_GUARDIANS {
        guardian_keys.push(Scalar::from_int(i as u32).try_into().unwrap());
    }
    guardian_keys
}

pub async fn create_price_updates() -> (MerkleTree<Keccak160>, Vec<MerklePriceUpdate>) {
    let price_feed_message = vec![
        Message::PriceFeedMessage(PriceFeedMessage {
            feed_id:           [0u8; 32],
            price:             1,
            conf:              2,
            exponent:          3,
            publish_time:      4,
            prev_publish_time: 5,
            ema_price:         6,
            ema_conf:          7,
        }),
        Message::PriceFeedMessage(PriceFeedMessage {
            feed_id:           [8u8; 32],
            price:             9,
            conf:              10,
            exponent:          11,
            publish_time:      12,
            prev_publish_time: 13,
            ema_price:         14,
            ema_conf:          15,
        }),
    ];
    let price_feed_message_as_vec: Vec<Vec<u8>> = price_feed_message
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


pub async fn build_merkle_root_encoded_vaa(
    merkle_tree_accumulator: MerkleTree<Keccak160>,
) -> Account {
    let merkle_tree_payload: Vec<u8> = merkle_tree_accumulator.serialize(1, 1);

    let vaa_header: Vaa<Box<RawMessage>> = Vaa {
        version:            1,
        guardian_set_index: 0,
        signatures:         vec![],
        timestamp:          0,
        nonce:              0,
        emitter_chain:      wormhole_sdk::Chain::Pythnet,
        emitter_address:    wormhole_sdk::Address(EMITTER_ADDRESS),
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

pub async fn setup_pyth_receiver() -> (ProgramSimulator, Pubkey, Vec<MerklePriceUpdate>) {
    let mut program_test = ProgramTest::default();
    program_test.add_program("pyth_solana_receiver", ID, None);

    let (merkle_tree_accumulator, merkle_price_updates) = create_price_updates().await;
    let merkle_root_encoded_vaa = build_merkle_root_encoded_vaa(merkle_tree_accumulator).await;

    let encoded_vaa_address = Pubkey::new_unique();
    program_test.add_account(encoded_vaa_address, merkle_root_encoded_vaa);


    let mut program_simulator = ProgramSimulator::start_from_program_test(program_test).await;

    let governance_authority_keypair = Keypair::new();

    let initial_config = Config {
        governance_authority:          governance_authority_keypair.pubkey(),
        target_governance_authority:   None,
        wormhole:                      BRIDGE_ID,
        valid_data_sources:            vec![DataSource {
            chain:   Chain::Pythnet.into(),
            emitter: Pubkey::from(EMITTER_ADDRESS),
        }],
        single_update_fee_in_lamports: 1,
        minimum_signatures:            5,
    };

    program_simulator
        .airdrop(&governance_authority_keypair.pubkey(), LAMPORTS_PER_SOL)
        .await
        .unwrap();

    program_simulator
        .process_ix(
            Initialize::populate(&governance_authority_keypair.pubkey(), initial_config),
            &vec![&governance_authority_keypair],
            None,
        )
        .await
        .unwrap();

    program_simulator
        .airdrop(&get_treasury_address(), Rent::default().minimum_balance(0))
        .await
        .unwrap();


    (program_simulator, encoded_vaa_address, merkle_price_updates)
}
