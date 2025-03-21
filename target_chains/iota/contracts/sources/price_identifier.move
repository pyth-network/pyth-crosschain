module pyth::price_identifier {
    use std::vector;

    const IDENTIFIER_BYTES_LENGTH: u64 = 32;
    const E_INCORRECT_IDENTIFIER_LENGTH: u64 = 0;

    struct PriceIdentifier has copy, drop, store {
        bytes: vector<u8>,
    }

    public fun from_byte_vec(bytes: vector<u8>): PriceIdentifier {
        assert!(vector::length(&bytes) == IDENTIFIER_BYTES_LENGTH, E_INCORRECT_IDENTIFIER_LENGTH);
        PriceIdentifier {
            bytes
        }
    }

    public fun get_bytes(price_identifier: &PriceIdentifier): vector<u8> {
        price_identifier.bytes
    }
}
