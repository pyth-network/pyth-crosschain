module pyth::contract_upgrade {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::contract_upgrade_hash::{Self, Hash};
    use pyth::state::{Self};
    use std::vector;
    use std::aptos_hash;
    use aptos_framework::code;
    use pyth::error;

    friend pyth::governance;

    const HASH_LENGTH: u64 = 32;

    struct AuthorizeContractUpgrade {
        hash: Hash,
    }

    public(friend) fun execute(payload: vector<u8>) {
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
        // Check to see if the hash of the given code and metadata matches the authorized hash.
        // The aptos framework does no validation of the metadata, so we include it in the hash.
        assert!(matches_hash(code, metadata_serialized, state::get_contract_upgrade_authorized_hash()), error::invalid_upgrade_hash());
        // Perform the upgrade
        let pyth = state::pyth_signer();
        code::publish_package_txn(&pyth, metadata_serialized, code);
    }

    fun matches_hash(code: vector<vector<u8>>, metadata_serialized: vector<u8>, hash: Hash): bool {

        // We compute the hash of the hashes of each component (metadata + module).
        // code is a vector of vectors of bytes (one for each component), so we need to flatten it before hashing.
        let reversed = copy code;
        vector::reverse(&mut reversed);
        let flattened = aptos_hash::keccak256(metadata_serialized);
        while (!vector::is_empty(&reversed)) vector::append(&mut flattened, aptos_hash::keccak256(vector::pop_back(&mut reversed)));

        aptos_hash::keccak256(flattened) == contract_upgrade_hash::destroy(hash)
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
