module pyth::merkle {
    use std::vector;
    use pyth::keccak160;
    use pyth::keccak160::Hash;

    const LEAF_PREFIX: u8 = 0;
    const NODE_PREFIX: u8 = 1;


    fun hash_leaf(leaf: vector<u8>): Hash {
        let leaf_data: vector<u8> = vector[LEAF_PREFIX];
        vector::append(&mut leaf_data, leaf);
        keccak160::from_data(leaf_data)
    }

    fun hash_node(node1: &Hash, node2: &Hash): Hash {
        let node_data: vector<u8> = vector[NODE_PREFIX];

        if (keccak160::is_smaller(node2, node1)) {
            vector::append(&mut node_data, keccak160::get_data(node2));
            vector::append(&mut node_data, keccak160::get_data(node1));
        }
        else {
            vector::append(&mut node_data, keccak160::get_data(node1));
            vector::append(&mut node_data, keccak160::get_data(node2));
        };
        keccak160::from_data(node_data)
    }

    public fun check(path: &vector<Hash>, root: &Hash, leaf: vector<u8>): bool {
        let i = 0;

        let current = hash_leaf(leaf);
        while (i < vector::length(path)) {
            current = hash_node(&current, vector::borrow(path, i));
            i = i + 1;
        };
        &current == root
    }

    #[test]
    fun test_hash_leaf() {
        let data: vector<u8> = x"00640000000000000000000000000000000000000000000000000000000000000000000000000000640000000000000064000000640000000000000064000000000000006400000000000000640000000000000064";
        let hash = hash_leaf(data);
        let expected = keccak160::new(x"afc6a8ac466430f35895055f8a4c951785dad5ce");
        assert!(&hash == &expected, 1);
    }


    #[test]
    fun test_hash_node() {
        let h1 = keccak160::new(x"05c51b04b820c0f704e3fdd2e4fc1e70aff26dff");
        let h2 = keccak160::new(x"1e108841c8d21c7a5c4860c8c3499c918ea9e0ac");
        let hash = hash_node(&h1, &h2);
        let expected = keccak160::new(x"2d0e4fde68184c7ce8af426a0865bd41ef84dfa4");
        assert!(&hash == &expected, 1);
    }

    #[test_only]
    fun setup_tree(): (Hash, Hash, Hash, Hash, Hash, Hash, Hash) {
        // h1  h2  h3   h4
        //  \ /     \  /
        //   h5      h6
        //      \  /
        //       h7
        let h1 = hash_leaf(x"adad11");
        let h2 = hash_leaf(x"adad12");
        let h3 = hash_leaf(x"adad13");
        let h4 = hash_leaf(x"adad14");
        let h5 = hash_node(&h1, &h2);
        let h6 = hash_node(&h3, &h4);
        let h7 = hash_node(&h5, &h6);
        (h1, h2, h3, h4, h5, h6, h7)
    }

    #[test]
    fun test_check_valid_proofs() {
        let (h1, h2, h3, h4, h5, h6, h7) = setup_tree();
        assert!(check(&vector[h2, h6], &h7, x"adad11"), 1);
        assert!(check(&vector[h3, h5], &h7, x"adad14"), 1);
        assert!(!check(&vector[h1, h4], &h7, x"adad14"), 1);
    }

    #[test]
    fun test_check_valid_proofs_subtree() {
        let (h1, h2, h3, h4, h5, h6, _) = setup_tree();
        assert!(check(&vector[h1], &h5, x"adad12"), 1);
        assert!(check(&vector[h2], &h5, x"adad11"), 1);
        assert!(check(&vector[h3], &h6, x"adad14"), 1);
        assert!(check(&vector[h4], &h6, x"adad13"), 1);
    }

    #[test]
    fun test_check_invalid_proofs() {
        let (h1, h2, h3, h4, h5, h6, h7) = setup_tree();
        assert!(!check(&vector[h2, h6], &h7, x"dead"), 1);
        assert!(!check(&vector[h3, h5], &h7, x"dead"), 1);
        assert!(!check(&vector[h1, h4], &h7, x"dead"), 1);
    }
}
