use {
    crate::{
        accumulators::{
            merkle::MerkleTree,
            Accumulator,
        },
        hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{
            to_vec,
            v1::{
                AccumulatorUpdateData,
                MerklePriceUpdate,
                Proof,
                WormholeMerkleRoot,
                WormholeMessage,
                WormholePayload,
            },
            PrefixedVec,
        },
    },
    byteorder::BigEndian,
    serde_wormhole::RawMessage,
    wormhole_sdk::{
        Address,
        Chain,
        Vaa,
    },
};

fn default_emitter_addr() -> [u8; 32] {
    [0u8; 32]
}
const EMITTER_CHAIN: u16 = 3;

pub fn create_accumulator_message(
    all_feeds: &[Message],
    updates: &[Message],
    corrupt_wormhole_message: bool,
) -> Vec<u8> {
    let all_feeds_bytes: Vec<_> = all_feeds
        .iter()
        .map(|f| to_vec::<_, BigEndian>(f).unwrap())
        .collect();
    let all_feeds_bytes_refs: Vec<_> = all_feeds_bytes.iter().map(|f| f.as_ref()).collect();
    let tree = MerkleTree::<Keccak160>::new(all_feeds_bytes_refs.as_slice()).unwrap();
    let mut price_updates: Vec<MerklePriceUpdate> = vec![];
    for update in updates {
        let proof = tree
            .prove(&to_vec::<_, BigEndian>(update).unwrap())
            .unwrap();
        price_updates.push(MerklePriceUpdate {
            message: PrefixedVec::from(to_vec::<_, BigEndian>(update).unwrap()),
            proof,
        });
    }
    create_accumulator_message_from_updates(
        price_updates,
        tree,
        corrupt_wormhole_message,
        default_emitter_addr(),
        EMITTER_CHAIN,
    )
}

fn create_accumulator_message_from_updates(
    price_updates: Vec<MerklePriceUpdate>,
    tree: MerkleTree<Keccak160>,
    corrupt_wormhole_message: bool,
    emitter_address: [u8; 32],
    emitter_chain: u16,
) -> Vec<u8> {
    let mut root_hash = [0u8; 20];
    root_hash.copy_from_slice(&to_vec::<_, BigEndian>(&tree.root).unwrap()[..20]);
    let wormhole_message = WormholeMessage::new(WormholePayload::Merkle(WormholeMerkleRoot {
        slot:      0,
        ring_size: 0,
        root:      root_hash,
    }));

    let mut vaa = create_zero_vaa();
    vaa.emitter_address = Address(emitter_address);
    vaa.emitter_chain = Chain::from(emitter_chain);
    let mut payload = to_vec::<_, BigEndian>(&wormhole_message).unwrap();

    if corrupt_wormhole_message {
        payload[0] = 0;
    }
    vaa.payload = <Box<RawMessage>>::from(payload);


    let vaa_binary = serde_wormhole::to_vec(&vaa).unwrap();
    let accumulator_update_data = AccumulatorUpdateData::new(Proof::WormholeMerkle {
        vaa:     PrefixedVec::from(vaa_binary.to_vec()),
        updates: price_updates,
    });

    to_vec::<_, BigEndian>(&accumulator_update_data).unwrap()
}

fn create_zero_vaa() -> Vaa<Box<RawMessage>> {
    Vaa {
        version:            1,
        guardian_set_index: 0,
        signatures:         vec![],
        timestamp:          0,
        nonce:              0,
        emitter_chain:      Chain::Any,
        emitter_address:    Address([0u8; 32]),
        sequence:           0,
        consistency_level:  0,
        payload:            <Box<RawMessage>>::from(vec![]),
    }
}
