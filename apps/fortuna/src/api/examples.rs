// Example values for the utoipa API docs.
// Note that each of these expressions is only evaluated once when the documentation is created,
// so the examples don't auto-update over time.

/// Example value for a chain ID
pub fn chain_id_example() -> &'static str {
    "abstract"
}

/// Example value for a sequence number
pub fn sequence_example() -> u64 {
    42381
}

/// Example value for a block number
pub fn block_number_example() -> u64 {
    19000000
}

/// Example value for a random value in hex format (32 bytes)
pub fn random_value_hex_example() -> &'static str {
    "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe"
}

/// Example value for a transaction hash
pub fn tx_hash_example() -> &'static str {
    "0xfe5f880ac10c0aae43f910b5a17f98a93cdd2eb2dce3a5ae34e5827a3a071a32"
}

/// Example value for an Ethereum address
pub fn address_example() -> &'static str {
    "0x6cc14824ea2918f5de5c2f75a9da968ad4bd6344"
}

/// Example value for a timestamp in ISO 8601 format
pub fn timestamp_example() -> &'static str {
    "2023-10-01T00:00:00Z"
}

/// Example value for a network ID (Ethereum mainnet)
pub fn network_id_example() -> u64 {
    1
}

/// Example value for gas limit
pub fn gas_limit_example() -> u32 {
    500000
}

/// Example value for gas used
pub fn gas_used_example() -> &'static str {
    "567890"
}

/// Example value for callback gas used
pub fn callback_gas_used_example() -> u32 {
    100000
}

/// Example value for callback return value (error code example)
pub fn callback_return_value_example() -> &'static str {
    "0x4e487b710000000000000000000000000000000000000000000000000000000000000011"
}

/// Example list of chain IDs
pub fn chain_ids_example() -> Vec<&'static str> {
    vec!["monad", "avalanche", "arbitrum", "optimism"]
}

/// Example value for binary encoding type
pub fn encoding_example() -> &'static str {
    "hex"
}

/// Example value for limit parameter
pub fn limit_example() -> u64 {
    100
}

/// Example value for offset parameter
pub fn offset_example() -> u64 {
    0
}

/// Example value for total results count
pub fn total_results_example() -> i64 {
    42
}

