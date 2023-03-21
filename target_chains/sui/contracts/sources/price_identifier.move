module pyth::price_identifier {
    use std::vector;
    //use pyth::error;

    const IDENTIFIER_BYTES_LENGTH: u64 = 32;

    struct PriceIdentifier has copy, drop, store {
        bytes: vector<u8>,
    }

    public fun from_byte_vec(bytes: vector<u8>): PriceIdentifier {
        assert!(vector::length(&bytes) == IDENTIFIER_BYTES_LENGTH, 0); //error::incorrect_identifier_length()

        PriceIdentifier {
            bytes: bytes
        }
    }

    public fun get_bytes(price_identifier: &PriceIdentifier): vector<u8> {
        price_identifier.bytes
    }
}
