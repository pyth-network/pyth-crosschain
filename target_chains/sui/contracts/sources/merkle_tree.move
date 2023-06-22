// Implementation of a Merkle tree in Move. Supports constructing a new tree
// with a given depth, as well as proving that a leaf node belongs to the tree.
module pyth::merkle_tree {
    use std::vector::{Self};
    use sui::hash::{keccak256};
    use wormhole::bytes::{Self};
    use wormhole::bytes20::{Self, Bytes20, data};
    use wormhole::cursor::{Self, Cursor};
    use pyth::deserialize::{Self};

    const MERKLE_LEAF_PREFIX: u8 = 0;
    const MERKLE_NODE_PREFIX: u8 = 1;
    const MERKLE_EMPTY_LEAF_PREFIX: u8 = 2;

    const E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES: u64 = 1212121;

    use std::debug::print;

    // take keccak256 of input data, then return 20 leftmost bytes of result
    fun hash(bytes: &vector<u8>): Bytes20 {
        let hashed_bytes = keccak256(bytes);
        let cursor = cursor::new(hashed_bytes);
        let bytes20 = bytes::take_bytes(&mut cursor, 20);
        cursor::take_rest(cursor);
        bytes20::from_bytes(bytes20)
    }

    fun emptyLeafHash(): Bytes20 {
        let v = vector<u8>[MERKLE_EMPTY_LEAF_PREFIX];
        hash(&v)
    }

    fun leafHash(data: &vector<u8>): Bytes20 {
        let v = vector<u8>[MERKLE_LEAF_PREFIX];
        vector::append(&mut v, *data);
        hash(&v)
    }

    fun nodeHash(
        childA: Bytes20,
        childB: Bytes20
    ): Bytes20 {
        if (greaterThan(childA, childB)) {
            (childA, childB) = (childB, childA);
        };
        // append data_B to data_A
        let data_A = bytes20::data(&childA);
        let data_B = bytes20::data(&childB);
        vector::append(&mut data_A, data_B);

        // create a vector containing MERKLE_NODE_PREFIX and append data_A to back
        let v = vector::empty<u8>();
        vector::push_back(&mut v, MERKLE_NODE_PREFIX);
        vector::append(&mut v, data_A);
        hash(&v)
    }

    // greaterThan returns whether a is strictly greater than b
    // note that data(&a) and data(&b) are both vectors of length 20
    fun greaterThan(a: Bytes20, b: Bytes20): bool{
        // aa and bb both have length 20
        let aa = data(&a);
        let bb = data(&b);
        let i = 0;
        while (i < 20){
            if (*vector::borrow(&aa, i) > *vector::borrow(&bb, i)){
                return true
            } else if (*vector::borrow(&bb, i) > *vector::borrow(&aa, i)){
                return false
            };
            i = i + 1;
        };
        false
    }

    // The Sui Move stdlb insert function shifts v[i] and subsequent elements to the right.
    // We don't want this behavior, so we define our own setElement function that instead replaces the ith element.
    // Reference: https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/move-stdlib/sources/vector.move
    fun setElement<T: drop>(a: &mut vector<T>, value: T, index: u64){
        vector::push_back<T>(a, value); // push value to end
        vector::swap_remove(a, index); // swap value to correct position and pop last value
    }

    // isProofValid returns whether a merkle proof is valid
    public fun isProofValid(
        encodedProof: &mut Cursor<u8>,
        root: Bytes20,
        leafData: vector<u8>,
    ): bool {
        let currentDigest: Bytes20 = leafHash(&leafData);
        let proofSize: u8 = deserialize::deserialize_u8(encodedProof);
        while (proofSize>0){
            let siblingDigest: Bytes20 = bytes20::new(
                deserialize::deserialize_vector(encodedProof, 20)
            );

            currentDigest = nodeHash(
                currentDigest,
                siblingDigest
            );
            proofSize = proofSize - 1;
        };
        if (bytes20::data(&currentDigest) != bytes20::data(&root)){
            print(&x"000000");
            print(&root);
            print(&currentDigest);
        };
        bytes20::data(&currentDigest) == bytes20::data(&root)
    }

    // constructProofs constructs a merkle tree and returns the root of the tree as
    // a Bytes20 as well as the vector of encoded proofs
    public fun constructProofs(
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
        let cachedEmptyLeafHash: Bytes20 = emptyLeafHash();

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
            setElement<Bytes20>(&mut tree, leafHash(vector::borrow(messages, j)), (1 << depth) + j);
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
                let nodeHash = nodeHash(*vector::borrow(&tree, id * 2), *vector::borrow(&tree, id * 2 + 1));
                setElement<Bytes20>(&mut tree, nodeHash, id);
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
        let res = greaterThan(x, y);
        assert!(res==true, 0);
        res = greaterThan(y, x);
        assert!(res==false, 0);

        // test 2
        x = bytes20::new(x"1100000000000000000000000000000000001000");
        y = bytes20::new(x"1100000000000000000000000000000000000001");
        res = greaterThan(x, y);
        assert!(res==true, 0);

        // equality case
        x = bytes20::new(x"1100000000000000000000000000000000001001");
        y = bytes20::new(x"1100000000000000000000000000000000001001");
        res = greaterThan(x, y);
        assert!(res==false, 0);
    }

    #[test]
    fun test_hash_leaf() {
        let data: vector<u8> = x"00640000000000000000000000000000000000000000000000000000000000000000000000000000640000000000000064000000640000000000000064000000000000006400000000000000640000000000000064";
        let hash = leafHash(&data);
        let expected = bytes20::new(x"afc6a8ac466430f35895055f8a4c951785dad5ce");
        assert!(hash == expected, 1);
    }

    #[test]
    fun test_hash_node() {
        let h1 = bytes20::new(x"05c51b04b820c0f704e3fdd2e4fc1e70aff26dff");
        let h2 = bytes20::new(x"1e108841c8d21c7a5c4860c8c3499c918ea9e0ac");
        let hash = nodeHash(h1, h2);
        let expected = bytes20::new(x"2d0e4fde68184c7ce8af426a0865bd41ef84dfa4");
        assert!(hash == expected, 1);
    }

    #[test]
    fun testMerkleTreeDepth1(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");

        let (root, proofs) = constructProofs(&messages, 1);

        let proofsCursor = cursor::new(proofs);
        let valid = isProofValid(&mut proofsCursor, root, x"1234");
        assert!(valid==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    fun testMerkleTreeDepth2(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"22");

        let (root, proofs) = constructProofs(&messages, 2);

        let proofsCursor = cursor::new(proofs);
        assert!(isProofValid(&mut proofsCursor, root, x"1234")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"4321")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"11")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    fun testMerkleTreeDepth3(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"100000");
        vector::push_back(&mut messages, x"eeeeee");

        let (root, proofs) = constructProofs(&messages, 3);

        let proofsCursor = cursor::new(proofs);
        assert!(isProofValid(&mut proofsCursor, root, x"00")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"4321")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"444444")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22222222")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"11")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"100000")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"eeeeee")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    fun testMerkleTreeDepth1InvalidProofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");

        let (root, proofs) = constructProofs(&messages, 1);

        let proofsCursor = cursor::new(proofs);

        // use wrong leaf data (it is not included in the tree)
        let valid = isProofValid(&mut proofsCursor, root, x"432222");
        assert!(valid==false, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    fun testMerkleTreeDepth2InvalidProofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"1234");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"22");

        let (root, proofs) = constructProofs(&messages, 2);

        let proofsCursor = cursor::new(proofs);
        // proof fails because we used the proof of x"1234" to try to prove that x"4321" is in the tree
        assert!(isProofValid(&mut proofsCursor, root, x"4321")==false, 0);
        // proof succeeds
        assert!(isProofValid(&mut proofsCursor, root, x"4321")==true, 0);
        // proof fails because we used the proof of x"11" to try to prove that x"22" is in the tree
        assert!(isProofValid(&mut proofsCursor, root, x"22")==false, 0);
        // proof succeeds
        assert!(isProofValid(&mut proofsCursor, root, x"22")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    fun testMerkleTreeDepth3InvalidProofs(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");
        vector::push_back(&mut messages, x"11");
        vector::push_back(&mut messages, x"100000");
        vector::push_back(&mut messages, x"eeeeee");

        let (root, proofs) = constructProofs(&messages, 3);

        let proofsCursor = cursor::new(proofs);

        // test various proof failure cases (because of mismatch between proof and leaf data)
        assert!(isProofValid(&mut proofsCursor, root, x"00")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22")==false, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22222222")==false, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22222222")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"22")==true, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"eeeeee")==false, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"4321")==false, 0);
        assert!(isProofValid(&mut proofsCursor, root, x"eeeeee")==true, 0);

        // destroy cursor
        cursor::take_rest<u8>(proofsCursor);
    }

    #[test]
    #[expected_failure(abort_code = pyth::merkle_tree::E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES)]
    fun testMerkleTreeDepthExceeded1(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");

        constructProofs(&messages, 1); //depth 1
    }

    #[test]
    #[expected_failure(abort_code = pyth::merkle_tree::E_DEPTH_NOT_LARGE_ENOUGH_FOR_MESSAGES)]
    fun testMerkleTreeDepthExceeded2(){
        let messages = vector::empty<vector<u8>>();
        vector::push_back(&mut messages, x"00");
        vector::push_back(&mut messages, x"4321");
        vector::push_back(&mut messages, x"444444");
        vector::push_back(&mut messages, x"22222222");
        vector::push_back(&mut messages, x"22");

        constructProofs(&messages, 2); // depth 2
    }

}
