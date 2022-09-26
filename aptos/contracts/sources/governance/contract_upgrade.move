module pyth::contract_upgrade {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::contract_upgrade_hash::{Self, Hash};
    use pyth::state::{Self};
    use std::vector;
    use std::aptos_hash;
    use aptos_framework::code;
    use pyth::error;

    const HASH_LENGTH: u64 = 32;

    struct AuthorizeContractUpgrade {
        hash: Hash,
    }

    public fun execute(payload: vector<u8>) {
        let AuthorizeContractUpgrade {hash: hash} = from_byte_vec(payload);
        state::set_contract_upgrade_authorized_hash(hash)
    }

    fun from_byte_vec(bytes: vector<u8>): AuthorizeContractUpgrade {
        let cursor = cursor::init(bytes);
        let hash = contract_upgrade_hash::from_byte_vec(deserialize::deserialize_vector(&mut cursor, HASH_LENGTH));
        cursor::destroy_empty(cursor);
        
        AuthorizeContractUpgrade {
            hash,
        }
    }

    public entry fun do_contract_upgrade(
        metadata_serialized: vector<u8>,
        code: vector<vector<u8>>,
    ) {
        // Check to see if the given code matches the authorized hash
        let hash = state::get_contract_upgrade_authorized_hash();
        let c = copy code;
        vector::reverse(&mut c);
        let a = vector::empty<u8>();
        while (!vector::is_empty(&c)) vector::append(&mut a, vector::pop_back(&mut c));
        assert!(aptos_hash::keccak256(a) == contract_upgrade_hash::destroy(hash), error::invalid_upgrade_hash());

        // Perform the upgrade
        let wormhole = state::pyth_signer();
        code::publish_package_txn(&wormhole, metadata_serialized, code);
    }
}

module pyth::contract_upgrade_hash {
    use std::vector;
    use pyth::error;

    struct Hash has store, drop {
        hash: vector<u8>,
    }

    public fun from_byte_vec(hash: vector<u8>): Hash {
        assert!(vector::length(&hash) == 32, error::invalid_hash_length());
        Hash {
            hash
        }
    }

    public fun destroy(hash: Hash): vector<u8> {
        let Hash { hash } = hash;
        hash
    }
}
