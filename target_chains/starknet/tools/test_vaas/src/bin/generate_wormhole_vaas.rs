use libsecp256k1::SecretKey;
use test_vaas::{
    print_as_array_and_last, serialize_vaa, u256_to_be, EthAddress, GuardianSet, GuardianSetUpgrade,
};
use wormhole_vaas::{PayloadKind, VaaBody};

fn main() {
    let secret1 = "047f10198517025e9bf2f6d09ebb650826b35397f01ca2a64a38348cae653f86";
    let address1 = EthAddress(hex::decode("686b9ea8e3237110eaaba1f1b7467559a3273819").unwrap());

    // secret2 = "a95d32e5e2b9464b3f49a0f7ef2ede3ff17585836b253b96c832a86d2b5614cb"
    let address2 = EthAddress(hex::decode("363598f080a817e633fc2d8f2b92e6e637f8b449").unwrap());

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
                        guardians: vec![address1.clone()],
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
                        guardians: vec![address1.clone()],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    println!("wrong_index_upgrade");
    print_as_array_and_last(&wrong_index_upgrade);
    println!();

    let upgrade_to_test2 = serialize_vaa(
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
                        set_index: 1,
                        guardians: vec![address2],
                    }
                    .serialize(),
                ),
            },
        ),
    );
    println!("upgrade_to_test2");
    print_as_array_and_last(&upgrade_to_test2);
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

    let pyth_set_data_sources = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![
                80, 84, 71, 77, 1, 2, 234, 147, 2, 0, 1, 107, 177, 69, 9, 166, 18, 240, 31, 187,
                196, 207, 254, 235, 212, 187, 251, 73, 42, 134, 223, 113, 126, 190, 146, 235, 109,
                244, 50, 163, 240, 10, 37, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 45,
            ]),
        },
    ));
    println!("pyth_set_data_sources");
    print_as_array_and_last(&pyth_set_data_sources);
    println!();

    let pyth_set_wormhole = serialize_vaa(guardians.sign_vaa(
        &[0],
        VaaBody {
            timestamp: 1,
            nonce: 2,
            emitter_chain: 1,
            emitter_address: u256_to_be(41.into()).into(),
            sequence: 1.try_into().unwrap(),
            consistency_level: 6,
            payload: PayloadKind::Binary(vec![
                80, 84, 71, 77, 1, 6, 234, 147, 5, 3, 63, 6, 213, 196, 123, 204, 231, 150, 14, 167,
                3, 176, 74, 11, 246, 75, 243, 63, 111, 46, 181, 97, 52, 150, 218, 116, 117, 34,
                217, 194,
            ]),
        },
    ));
    println!("pyth_set_wormhole");
    print_as_array_and_last(&pyth_set_wormhole);
    println!();
}
