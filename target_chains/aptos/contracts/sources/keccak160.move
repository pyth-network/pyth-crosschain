module pyth::keccak160 {
    use std::vector;
    use pyth::error;
    use std::aptos_hash;

    struct Hash has drop {
        data: vector<u8>,
    }

    const HASH_LENGTH: u64 = 20;

    public fun get_data(hash: &Hash): vector<u8> {
        hash.data
    }

    public fun get_hash_length(): u64 {
        HASH_LENGTH
    }

    public fun new(data: vector<u8>): Hash {
        assert!(vector::length(&data) == HASH_LENGTH, error::invalid_keccak160_length());
        Hash { data }
    }

    public fun from_data(data: vector<u8>): Hash {
        let hash = aptos_hash::keccak256(data);
        while (vector::length(&hash) > HASH_LENGTH) {
            vector::pop_back(&mut hash);
        };
        new(hash)
    }

    public fun is_smaller(lhs: &Hash, rhs: &Hash): bool {
        let i = 0;
        while (i < vector::length(&get_data(lhs))) {
            let lhs_val: u8 = *vector::borrow(&get_data(lhs), i);
            let rhs_val: u8 = *vector::borrow(&get_data(rhs), i);
            if (lhs_val != rhs_val) {
                return lhs_val < rhs_val
            };
            i = i + 1;
        };
        false
    }


    #[test]
    fun test_from_data() {
        let hash = from_data(vector[0]);
        let expected = new(x"bc36789e7a1e281436464229828f817d6612f7b4");
        assert!(&hash == &expected, 1);
    }

    #[test]
    fun test_is_smaller() {
        let h1 = new(x"0000000000000000010000000000000000000000");
        let h2 = new(x"0000000000000000000300000000000000000000");
        let h3 = new(x"0000000000000000000200000000000000000000");
        assert!(is_smaller(&h3, &h2), 1);
        assert!(!is_smaller(&h2, &h3), 1);

        assert!(is_smaller(&h2, &h1), 1);
        assert!(!is_smaller(&h1, &h2), 1);

        assert!(is_smaller(&h3, &h1), 1);
        assert!(!is_smaller(&h1, &h3), 1);

        assert!(!is_smaller(&h1, &h1), 1);
        assert!(!is_smaller(&h2, &h2), 1);
        assert!(!is_smaller(&h3, &h3), 1);
    }

    #[test]
    fun test_new_success() {
        new(x"05c51b04b820c0f704e3fdd2e4fc1e70aff26dff");
    }

    #[test]
    #[expected_failure(abort_code = 65566, location = pyth::keccak160)]
    fun test_new_wrong_size() {
        new(vector[1, 2, 3]);
    }
}
