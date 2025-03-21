// Implementation of a Merkle tree in Move. Supports constructing a new tree
// with a given depth, as well as proving that a leaf node belongs to the tree.
module pyth::merkle_tree {
    use std::vector::{Self};
    use sui::hash::{keccak256};
    use wormhole::bytes20::{Self, Bytes20, data};
    use wormhole::cursor::Cursor;
    use pyth::deserialize::{Self};

    #[test_only]
    use wormhole::cursor::{Self};

    const MERKLE_LEAF_PREFIX: u8 = 0;
    const MERKLE_NODE_PREFIX: u8 = 1;
    const MERKLE_EMPTY_LEAF_PREFIX: u8 = 2;

    const E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES: u64 = 1212121;

    // take keccak256 of input data, then return 20 leftmost bytes of result
    fun hash(bytes: &vector<u8>): Bytes20 {
        let hashed_bytes = keccak256(bytes);
        let hash_prefix = vector::empty<u8>();
        let i = 0;
        while (i < 20) {
            vector::push_back(&mut hash_prefix, *vector::borrow(&hashed_bytes, i));
            i = i + 1;
        };
        bytes20::new(hash_prefix)
    }

    fun empty_leaf_hash(): Bytes20 {
        let v = vector<u8>[MERKLE_EMPTY_LEAF_PREFIX];
        hash(&v)
    }

    fun leaf_hash(data: &vector<u8>): Bytes20 {
        let v = vector<u8>[MERKLE_LEAF_PREFIX];
        let i = 0;
        while (i < vector::length(data)) {
            vector::push_back(&mut v, *vector::borrow(data, i));
            i = i + 1;
        };
        hash(&v)
    }

    fun node_hash(
        childA: Bytes20,
        childB: Bytes20
    ): Bytes20 {
        if (greater_than(&childA, &childB)) {
            (childA, childB) = (childB, childA);
        };
        // append data_B to data_A
        let data_A = bytes20::data(&childA);
        let data_B = bytes20::data(&childB);

        // create a vector containing MERKLE_NODE_PREFIX + data_A + data_B
        let v = vector<u8>[MERKLE_NODE_PREFIX];
        let i = 0;
        while (i < 20) {
            vector::push_back(&mut v, *vector::borrow(&data_A, i));
            i = i + 1;
        };
        let i = 0;
        while (i < 20) {
            vector::push_back(&mut v, *vector::borrow(&data_B, i));
            i = i + 1;
        };
        hash(&v)
    }

    // greater_than returns whether a is strictly greater than b
    // note that data(&a) and data(&b) are both vector<u8>s of length 20
    fun greater_than(a: &Bytes20, b: &Bytes20): bool {
        // aa and bb both have length 20
        let a_vector = data(a);
        let b_vector = data(b);
        let i = 0;
        while (i < 20) {
            let a_value = *vector::borrow(&a_vector, i);
            let b_value = *vector::borrow(&b_vector, i);
            if (a_value > b_value) {
                return true
            } else if (b_value > a_value) {
                return false
            };
            i = i + 1;
        };
        false
    }

    // The Sui Move stdlb insert function shifts v[i] and subsequent elements to the right.
    // We don't want this behavior, so we define our own set_element function that instead replaces the ith element.
    // Reference: https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/move-stdlib/sources/vector.move
    fun set_element<T: drop>(a: &mut vector<T>, value: T, index: u64){
        vector::push_back<T>(a, value); // push value to end
        vector::swap_remove(a, index); // swap value to correct position and pop last value
    }

    // is_proof_valid returns whether a merkle proof is valid
    public fun is_proof_valid(
        encoded_proof: &mut Cursor<u8>,
        root: Bytes20,
        leaf_data: vector<u8>,
    ): bool {
        let current_digest: Bytes20 = leaf_hash(&leaf_data);
        let proofSize: u8 = deserialize::deserialize_u8(encoded_proof);
        while (proofSize > 0){
            let sibling_digest: Bytes20 = bytes20::new(
                deserialize::deserialize_vector(encoded_proof, 20)
            );

            current_digest = node_hash(
                current_digest,
                sibling_digest
            );
            proofSize = proofSize - 1;
        };
        bytes20::data(&current_digest) == bytes20::data(&root)
    }

    // construct_proofs constructs a merkle tree and returns the root of the tree as
    // a Bytes20 as well as the vector of encoded proofs
    public fun construct_proofs(
        messages: &vector<vector<u8>>,
        depth: u8
    ) : (Bytes20, vector<u8>) {

        if ( 1 << depth < vector::length(messages)) {
            abort E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES
        };

        // empty tree
        // The tree is structured as follows:
        // 1
        // 2 3
        // 4 5 6 7
        // ...
        // In this structure the parent of node x is x//2 and the children
        // of node x are x*2 and x*2 + 1. Also, the sibling of the node x
        // is x^1. The root is at index 1 and index 0 is not used.
        let tree = vector::empty<Bytes20>();

        // empty leaf hash
        let cachedEmptyLeafHash: Bytes20 = empty_leaf_hash();

        // Instantiate tree to be a full binary tree with the appropriate depth.
        // Add an entry at the end for swapping
        let i: u64 = 0;
        while (i < (1 << (depth+1)) + 1){
            vector::push_back(&mut tree, cachedEmptyLeafHash);
            i = i + 1;
        };

        // Fill in bottom row with leaf hashes
        let j: u64 = 0;
        while (j < vector::length(messages)){
            set_element<Bytes20>(&mut tree, leaf_hash(vector::borrow(messages, j)), (1 << depth) + j);
            j = j + 1;
        };

        // Filling the node hashes from bottom to top
        let k: u8 = depth;
        while (k>0){
            let level: u8 = k-1;
            let levelNumNodes = 1 << level;
            let i: u64 = 0;
            while (i < levelNumNodes ){
                let id = (1 << level) + i;
                let node_hash = node_hash(*vector::borrow(&tree, id * 2), *vector::borrow(&tree, id * 2 + 1));
                set_element<Bytes20>(&mut tree, node_hash, id);
                i = i + 1;
            };
            k = k - 1;
        };

        let root = *vector::borrow(&tree, 1);

        // construct proofs and create encoded proofs vector
        let proofs = vector::empty<u8>();
        let i: u64 = 0;
        while (i < vector::length(messages)){
            let cur_proof = vector::empty<u8>();
            vector::push_back(&mut cur_proof, depth);
            let idx = (1 << depth) + i;
            while (idx > 1) {
                vector::append(&mut cur_proof, bytes20::data(vector::borrow(&tree, idx ^ 1)));

                // Jump to parent
                idx  = idx / 2;
            };
            vector::append(&mut proofs, cur_proof);
            i = i + 1;
        };

        (root, proofs)
    }

    #[test]
    fun testGreaterThan(){
        // test 1
        let x = bytes20::new(x"0000000000000000000000000000000000001000");
        let y = bytes20::new(x"0000000000000000000000000000000000000001");
        let res = greater_than(&x, &y);
        assert!(res==true, 0);
        res = greater_than(&y, &x);
        assert!(res==false, 0);

        // test 2
        x = bytes20::new(x"1100000000000000000000000000000000001000");
        y = bytes20::new(x"1100000000000000000000000000000000000001");
        res = greater_than(&x, &y);
        assert!(res==true, 0);

        // equality case
        x = bytes20::new(x"1100000000000000000000000000000000001001");
        y = bytes20::new(x"1100000000000000000000000000000000001001");
        res = greater_than(&x, &y);
        assert!(res==false, 0);
    }

    #[test]
    fun test_hash_leaf() {
        let data: vector<u8> = x"00640000000000000000000000000000000000000000000000000000000000000000000000000000640000000000000064000000640000000000000064000000000000006400000000000000640000000000000064";
        let hash = leaf_hash(&data);
        let expected = bytes20::new(x"afc6a8ac466430f35895055f8a4c951785dad5ce");
        assert!(hash == expected, 1);
    }

    #[test]
    fun test_hash_node() {
        let h1 = bytes20::new(x"05c51b04b820c0f704e3fdd2e4fc1e70aff26dff");
        let h2 = bytes20::new(x"1e108841c8d21c7a5c4860c8c3499c918ea9e0ac");
        let hash = node_hash(h1, h2);
        let expected = bytes20::new(x"2d0e4fde68184c7ce8af426a0865bd41ef84dfa4");
        assert!(hash == expected, 1);
    }

    #[test]
    fun testMerkleTreeDepth1(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");

        let (root, proofs) = construct_proofs(&messages, 1);

        let proofs_cursor = cursor::new(proofs);
        let valid = is_proof_valid(&mut proofs_cursor, root, x"1234");
        assert!(valid==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    fun testMerkleTreeDepth2(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"22");

        let (root, proofs) = construct_proofs(&messages, 2);

        let proofs_cursor = cursor::new(proofs);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"1234")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"4321")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"11")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    fun test_merkle_tree_depth_3(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"100000");
        vector::push_back(&mut messages, x"eeeeee");

        let (root, proofs) = construct_proofs(&messages, 3);

        let proofs_cursor = cursor::new(proofs);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"00")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"4321")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"444444")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22222222")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"11")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"100000")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"eeeeee")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    fun test_merkle_tree_depth_1_invalid_proofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");

        let (root, proofs) = construct_proofs(&messages, 1);

        let proofs_cursor = cursor::new(proofs);

        // use wrong leaf data (it is not included in the tree)
        let valid = is_proof_valid(&mut proofs_cursor, root, x"432222");
        assert!(valid==false, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    fun test_merkle_tree_depth_2_invalid_proofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"22");

        let (root, proofs) = construct_proofs(&messages, 2);

        let proofs_cursor = cursor::new(proofs);
        // proof fails because we used the proof of x"1234" to try to prove that x"4321" is in the tree
        assert!(is_proof_valid(&mut proofs_cursor, root, x"4321")==false, 0);
        // proof succeeds
        assert!(is_proof_valid(&mut proofs_cursor, root, x"4321")==true, 0);
        // proof fails because we used the proof of x"11" to try to prove that x"22" is in the tree
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==false, 0);
        // proof succeeds
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    fun test_merkle_tree_depth_3_invalid_proofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"100000");
        vector::push_back(&mut messages, x"eeeeee");

        let (root, proofs) = construct_proofs(&messages, 3);

        let proofs_cursor = cursor::new(proofs);

        // test various proof failure cases (because of mismatch between proof and leaf data)
        assert!(is_proof_valid(&mut proofs_cursor, root, x"00")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==false, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22222222")==false, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22222222")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"22")==true, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"eeeeee")==false, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"4321")==false, 0);
        assert!(is_proof_valid(&mut proofs_cursor, root, x"eeeeee")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofs_cursor);
    }

    #[test]
    #[expected_failure(abort_code = pyth::merkle_tree::E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES)]
    fun test_merkle_tree_depth_exceeded_1(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");

        construct_proofs(&messages, 1); //depth 1
    }

    #[test]
    #[expected_failure(abort_code = pyth::merkle_tree::E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES)]
    fun test_merkle_tree_depth_exceeded_2(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");

        construct_proofs(&messages, 2); // depth 2
    }

}
