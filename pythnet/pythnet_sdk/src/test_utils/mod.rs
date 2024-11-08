use {
    crate::{
        accumulators::{merkle::MerkleTree, Accumulator},
        hashers::{keccak256::Keccak256, keccak256_160::Keccak160, Hasher},
        messages::{FeedId, Message, PriceFeedMessage, TwapMessage},
        wire::{
            to_vec,
            v1::{
                AccumulatorUpdateData, MerklePriceUpdate, Proof, WormholeMerkleRoot,
                WormholeMessage, WormholePayload,
            },
            PrefixedVec,
        },
    },
    byteorder::BigEndian,
    libsecp256k1::{Message as libsecp256k1Message, PublicKey, RecoveryId, SecretKey, Signature},
    rand::{seq::SliceRandom, thread_rng},
    serde_wormhole::RawMessage,
    wormhole_sdk::{
        vaa::{Body, Header},
        Address, Chain, Vaa,
    },
};

pub struct DataSource {
    pub address: Address,
    pub chain: Chain,
}

pub const DEFAULT_DATA_SOURCE: DataSource = DataSource {
    address: Address([1u8; 32]),
    chain: Chain::Solana,
};

pub const DEFAULT_GOVERNANCE_SOURCE: DataSource = DataSource {
    address: Address([2u8; 32]),
    chain: Chain::Ethereum,
};

pub const WRONG_SOURCE: DataSource = DataSource {
    address: Address([3u8; 32]),
    chain: Chain::Bsc,
};

pub const SECONDARY_DATA_SOURCE: DataSource = DataSource {
    address: Address([4u8; 32]),
    chain: Chain::Polygon,
};

pub const SECONDARY_GOVERNANCE_SOURCE: DataSource = DataSource {
    address: Address([5u8; 32]),
    chain: Chain::Avalanche,
};

pub const DEFAULT_CHAIN_ID: Chain = Chain::Oasis;
pub const WRONG_CHAIN_ID: Chain = Chain::Algorand;
pub const DEFAULT_VALID_TIME_PERIOD: u64 = 180;

const DEFAULT_SEQUENCE: u64 = 2;

const NUM_GUARDIANS: u8 = 19; // Matches wormhole mainnet
const DEFAULT_NUM_SIGNATURES: usize = 13; // Matches wormhole mainnet

pub fn dummy_guardians() -> Vec<SecretKey> {
    let mut result: Vec<SecretKey> = vec![];
    for i in 0..NUM_GUARDIANS {
        let mut secret_key_bytes = [0u8; 32];
        secret_key_bytes[0] = i + 1;
        result.push(SecretKey::parse(&secret_key_bytes).unwrap());
    }
    result
}

pub fn dummy_guardians_addresses() -> Vec<[u8; 20]> {
    let guardians = dummy_guardians();
    guardians
        .iter()
        .map(|x| {
            let mut result: [u8; 20] = [0u8; 20];
            let pubkey = &PublicKey::from_secret_key(x).serialize()[1..];
            result.copy_from_slice(&Keccak256::hashv(&[&pubkey])[12..]);
            result
        })
        .collect()
}

pub fn create_dummy_feed_id(value: i64) -> FeedId {
    let mut dummy_id = [0; 32];
    dummy_id[0] = value as u8;
    dummy_id
}

pub fn create_dummy_price_feed_message_with_feed_id(value: i64, feed_id: FeedId) -> Message {
    let msg = PriceFeedMessage {
        feed_id,
        price: value,
        conf: value as u64,
        exponent: value as i32,
        publish_time: value,
        prev_publish_time: value,
        ema_price: value,
        ema_conf: value as u64,
    };
    Message::PriceFeedMessage(msg)
}

pub fn create_dummy_price_feed_message(value: i64) -> Message {
    create_dummy_price_feed_message_with_feed_id(value, create_dummy_feed_id(value))
}

pub fn create_dummy_twap_message() -> Message {
    let msg = TwapMessage {
        feed_id: [0; 32],
        cumulative_price: 0,
        cumulative_conf: 0,
        num_down_slots: 0,
        exponent: 0,
        publish_time: 0,
        prev_publish_time: 0,
        publish_slot: 0,
    };
    Message::TwapMessage(msg)
}

pub fn create_accumulator_message(
    all_feeds: &[&Message],
    updates: &[&Message],
    corrupt_wormhole_message: bool,
    corrupt_messages: bool,
    data_source_override: Option<DataSource>,
) -> Vec<u8> {
    let mut all_feeds_bytes: Vec<_> = all_feeds
        .iter()
        .map(|f| to_vec::<_, BigEndian>(f).unwrap())
        .collect();

    let mut updates_bytes: Vec<_> = updates
        .iter()
        .map(|f| to_vec::<_, BigEndian>(f).unwrap())
        .collect();

    if corrupt_messages {
        all_feeds_bytes = all_feeds_bytes
            .iter()
            .map(|f| {
                let mut f_copy = f.clone();
                f_copy[0] = 255;
                f_copy
            })
            .collect();
        updates_bytes = updates_bytes
            .iter()
            .map(|f| {
                let mut f_copy = f.clone();
                f_copy[0] = 255;
                f_copy
            })
            .collect();
    }
    let all_feeds_bytes_refs: Vec<_> = all_feeds_bytes.iter().map(|f| f.as_ref()).collect();
    let tree = MerkleTree::<Keccak160>::new(all_feeds_bytes_refs.as_slice()).unwrap();
    let mut price_updates: Vec<MerklePriceUpdate> = vec![];
    for update in updates_bytes {
        let proof = tree.prove(&update).unwrap();
        price_updates.push(MerklePriceUpdate {
            message: PrefixedVec::from(update),
            proof,
        });
    }
    let data_source = data_source_override.unwrap_or(DEFAULT_DATA_SOURCE);
    create_accumulator_message_from_updates(
        price_updates,
        tree,
        corrupt_wormhole_message,
        data_source.address,
        data_source.chain,
    )
}

pub fn create_accumulator_message_from_updates(
    price_updates: Vec<MerklePriceUpdate>,
    tree: MerkleTree<Keccak160>,
    corrupt_wormhole_message: bool,
    emitter_address: Address,
    emitter_chain: Chain,
) -> Vec<u8> {
    let mut root_hash = [0u8; 20];
    root_hash.copy_from_slice(&to_vec::<_, BigEndian>(&tree.root).unwrap()[..20]);
    let wormhole_message = WormholeMessage::new(WormholePayload::Merkle(WormholeMerkleRoot {
        slot: 0,
        ring_size: 0,
        root: root_hash,
    }));

    let mut vaa_payload = to_vec::<_, BigEndian>(&wormhole_message).unwrap();
    if corrupt_wormhole_message {
        vaa_payload[0] = 0;
    }

    let vaa = create_vaa_from_payload(
        &vaa_payload,
        emitter_address,
        emitter_chain,
        DEFAULT_SEQUENCE,
    );

    let accumulator_update_data = AccumulatorUpdateData::new(Proof::WormholeMerkle {
        vaa: PrefixedVec::from(serde_wormhole::to_vec(&vaa).unwrap()),
        updates: price_updates,
    });

    to_vec::<_, BigEndian>(&accumulator_update_data).unwrap()
}

pub fn create_vaa_from_payload(
    payload: &[u8],
    emitter_address: Address,
    emitter_chain: Chain,
    sequence: u64,
) -> Vaa<Box<RawMessage>> {
    let guardians = dummy_guardians();

    let body: Body<Box<RawMessage>> = Body {
        emitter_chain,
        emitter_address,
        sequence,
        payload: <Box<RawMessage>>::from(payload.to_vec()),
        ..Default::default()
    };

    let digest = libsecp256k1Message::parse_slice(&body.digest().unwrap().secp256k_hash).unwrap();

    let signatures: Vec<(Signature, RecoveryId)> = guardians
        .iter()
        .map(|x| libsecp256k1::sign(&digest, &x))
        .collect();
    let wormhole_signatures: Vec<wormhole_sdk::vaa::Signature> = signatures
        .iter()
        .enumerate()
        .map(|(i, (x, y))| {
            let mut signature = [0u8; 65];
            signature[..64].copy_from_slice(&x.serialize());
            signature[64] = y.serialize();
            wormhole_sdk::vaa::Signature {
                index: i as u8,
                signature,
            }
        })
        .collect();

    let mut wormhole_signatures_subset: Vec<wormhole_sdk::vaa::Signature> = wormhole_signatures
        .choose_multiple(&mut thread_rng(), DEFAULT_NUM_SIGNATURES)
        .cloned()
        .collect();

    wormhole_signatures_subset.sort_by(|a, b| a.index.cmp(&b.index));

    let header = Header {
        version: 1,
        signatures: wormhole_signatures_subset,
        ..Default::default()
    };

    (header, body).into()
}

pub fn trim_vaa_signatures(vaa: Vaa<&RawMessage>, n: u8) -> Vaa<&RawMessage> {
    let mut vaa_copy = vaa.clone();
    vaa_copy.signatures = vaa
        .signatures
        .choose_multiple(&mut thread_rng(), n.into())
        .cloned()
        .collect();
    vaa_copy.signatures.sort_by(|a, b| a.index.cmp(&b.index));
    vaa_copy
}
