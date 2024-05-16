use libsecp256k1::SecretKey;
use test_vaas::{
    print_as_array_and_last, serialize_vaa, u256_to_be, EthAddress, GuardianSet, GuardianSetUpgrade,
};
use wormhole_vaas::{PayloadKind, VaaBody};

fn main() {
    let secret1 = "047f10198517025e9bf2f6d09ebb650826b35397f01ca2a64a38348cae653f86";
    // address 0x686b9ea8e3237110eaaba1f1b7467559a3273819

    let guardians = GuardianSet {
        set_index: 0,
        secrets: vec![SecretKey::parse_slice(&hex::decode(secret1).unwrap()).unwrap()],
    };

    let empty_set_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(4.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 60051,
                        set_index: 1,
                        guardians: Vec::new(),
                    }
                    .serialize(),
                ),
            },
        ),
    );
    println!("empty upgrade");
    print_as_array_and_last(&empty_set_upgrade);
    println!();

    let wrong_emitter_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(5.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 60051,
                        set_index: 1,
                        guardians: vec![EthAddress(
                            hex::decode("686b9ea8e3237110eaaba1f1b7467559a3273819").unwrap(),
                        )],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    println!("wrong_emitter_upgrade");
    print_as_array_and_last(&wrong_emitter_upgrade);
    println!();

    let wrong_index_upgrade = serialize_vaa(
        guardians.sign_vaa(
            &[0],
            VaaBody {
                timestamp: 1,
                nonce: 2,
                emitter_chain: 1,
                emitter_address: u256_to_be(4.into()).into(),
                sequence: 5.try_into().unwrap(),
                consistency_level: 6,
                payload: PayloadKind::Binary(
                    GuardianSetUpgrade {
                        chain_id: 0,
                        set_index: 3,
                        guardians: vec![EthAddress(
                            hex::decode("686b9ea8e3237110eaaba1f1b7467559a3273819").unwrap(),
                        )],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    println!("wrong_index_upgrade");
    print_as_array_and_last(&wrong_index_upgrade);
    println!();

    let pyth_set_fee = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![
                80, 84, 71, 77, 1, 3, 234, 147, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 2,
            ]),
        },
    ));
    println!("pyth_set_fee");
    print_as_array_and_last(&pyth_set_fee);
    println!();
}
