// Implementation of a Merkle tree in Move. Supports constructing a new tree
// with a given depth, as well as proving that a leaf node belongs to the tree.
module pyth::merkle {
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

    // take keccak256 of input data, then return 20 rightmost bytes of result
    fun hash(bytes: &vector<u8>): Bytes20 {
        let hashed_bytes = keccak256(bytes); // 32 byte hash
        let cursor = cursor::new(hashed_bytes);
        let _ = bytes::take_bytes(&mut cursor, 12);
        let bytes20 = bytes::take_bytes(&mut cursor, 20);
        cursor::destroy_empty(cursor);
        bytes20::from_bytes(bytes20)
    }

    fun emptyLeafHash(): Bytes20 {
        let v = vector::empty();
        bytes::push_u8(&mut v, MERKLE_EMPTY_LEAF_PREFIX);
        hash(&v)
    }

    fun leafHash(data: &vector<u8>): Bytes20 {
        bytes::push_u8(&mut *data, MERKLE_LEAF_PREFIX);
        hash(data)
    }

    fun nodeHash(
        childA: Bytes20,
        childB: Bytes20
    ): Bytes20 {
        if (greaterThan(childA, childB)) {
            (childA, childB) = (childB, childA);
        };
        let data_A = bytes20::data(&childA);
        let data_B = bytes20::data(&childB);
        vector::append(&mut data_A, data_B);
        bytes::push_u8(&mut data_A, MERKLE_NODE_PREFIX);
        hash(&data_A)
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
    // We don't want this behavior, so we define our own vector insert function using swapping.
    // Reference: https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/move-stdlib/sources/vector.move
    fun vectorInsert<T: drop>(a: &mut vector<T>, value: T, index: u64){
        vector::push_back<T>(a, value); // push value to end
        vector::swap_remove(a, index); // swap value to correct position and pop last value
    }

    // isProofValid checks whether a merkle proof is valid and returns (valid, offset)
    fun isProofValid(
        encodedProof: &mut Cursor<u8>,
        root: Bytes20,
        leafData: vector<u8>,
    ): bool {

        let currentDigest: Bytes20 = leafHash(&leafData);
        let proofSize: u8 = deserialize::deserialize_u8(encodedProof);
        let i: u8 = 0;
        while (i < proofSize){
            let siblingDigest: Bytes20 = bytes20::new(
                deserialize::deserialize_vector(encodedProof, 20)
            );

            currentDigest = nodeHash(
                currentDigest,
                siblingDigest
            );
            i = i + 1;
        };
        bytes20::data(&currentDigest) == bytes20::data(&root)
    }

    // constructProofs constructs a merkle tree and returns the root of the tree as
    // a Bytes20 as well as the vector of encoded proofs
    fun constructProofs(
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
            vectorInsert<Bytes20>(&mut tree, leafHash(vector::borrow(messages, j)), (1 << depth) + j);
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
                vectorInsert<Bytes20>(&mut tree, nodeHash, id);
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
    fun testXOR(){
        let x = 1;
        let y = x^1;
        assert!(y==0, 0);

        let x = 64;
        let y = x^1;
        assert!(y==65, 0);
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
        let _ = cursor::take_rest<u8>(proofsCursor);
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
        let _ = cursor::take_rest<u8>(proofsCursor);
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
        let _ = cursor::take_rest<u8>(proofsCursor);
    }
}
