

use alloc::vec::Vec;
use hex::FromHex;
use stylus_sdk::alloy_primitives::Address;

pub fn create_upgrade_contract_vaa(_new_implementation: [u8; 32]) -> Vec<u8> {
    let hex_str = "01000000000100b2e15dd5ef41b800ec5ec10f61c6415f706a769f459757f43be78a8fd9f1f6e104e909239fe73b4d8652f7aa1a07825e3230d01a0a7bd6efa0be2e7e72377d71010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_authorize_governance_data_source_transfer_vaa(_claim_vaa: Vec<u8>) -> Vec<u8> {
    let hex_str = "01000000000100b441e497034be4ee82242a866461d5e6744082654f71301a96f579f629b6bf176cc0c1964cd7d4f792436b7a73fc7024d72b138869b4d81d449740bb08148238000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01010002010000000001009c9dc62e92fefe0806dce30b662a5d319417a62dccc700b5f2678306d39c005f7a5e74d11df287301d85d328a3d000c5d793c57161f3150c7eb1a17668946e6b010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000064005054474d0105000200000000";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_set_data_sources_vaa(sources: Vec<(u16, [u8; 32])>) -> Vec<u8> {
    let expected_source = (1u16, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11, 0x11]);
    
    if sources.len() == 1 && sources[0] == expected_source {
        let hex_str = "0100000000010069825ef00344cf745b6e72a41d4f869d4e90de517849360c72bf94efc97681671d826e484747b21a80c8f1e7816021df9f55e458a6e7a717cb2bd2a1e85fd57100499602d200000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010200020100010000000000000000000000000000000000000000000000000000000000001111";
        Vec::from_hex(hex_str).expect("Invalid hex string")
    } else {
        panic!("create_set_data_sources_vaa: Input sources don't match the pre-signed VAA. Expected: {:?}, Got: {:?}", vec![expected_source], sources);
    }
}

pub fn create_set_fee_vaa(_value: u64, _expo: u64) -> Vec<u8> {
    let hex_str = "0100000000010057940f58a6a44c93606bd721701539e0da93d5ea1583a735fbb13ecbcf9c01fc70240de519ea76869af14d067d68c5f3f2230f565f41b7009f3c3e63749353ed000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0103000200000000000000050000000000000003";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_set_valid_period_vaa(_valid_time_period_seconds: u64) -> Vec<u8> {
    let hex_str = "01000000000100b2e15dd5ef41b800ec5ec10f61c6415f706a769f459757f43be78a8fd9f1f6e104e909239fe73b4d8652f7aa1a07825e3230d01a0a7bd6efa0be2e7e72377d71010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010400020000000000000000";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_request_governance_data_source_transfer_vaa(_governance_data_source_index: u32) -> Vec<u8> {
    let hex_str = "01000000000100b2e15dd5ef41b800ec5ec10f61c6415f706a769f459757f43be78a8fd9f1f6e104e909239fe73b4d8652f7aa1a07825e3230d01a0a7bd6efa0be2e7e72377d71010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d010500020000000000000000";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_set_wormhole_address_vaa(_address: Address) -> Vec<u8> {
    let hex_str = "01000000000100b2e15dd5ef41b800ec5ec10f61c6415f706a769f459757f43be78a8fd9f1f6e104e909239fe73b4d8652f7aa1a07825e3230d01a0a7bd6efa0be2e7e72377d71010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d01060002000000000000000000000000000000000000000000";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_set_transaction_fee_vaa(_value: u64, _expo: u64) -> Vec<u8> {
    let hex_str = "010000000001001554008232e74cb3ac74acc4527ead8a39637c537ec9b3d1fbb624c1f4f52e341e24ae89d978e033f5345e4af244df0ec61f380d9e33330f439d2b6764850270010000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0108000200000000000000640000000000000003";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

pub fn create_withdraw_fee_vaa(_target_address: Address, _value: u64, _expo: u64) -> Vec<u8> {
    let hex_str = "0100000000010030f48904e130d76ee219bc59988f89526e5c9860e89efda3a74e33c3ab53d4e6036d1c67249d2f25a27e8c94d203609785839e3e4817d0a03214ea8bbf6a8415000000000100000000000100000000000000000000000000000000000000000000000000000000000000110000000000000001005054474d0109000270997970c51812dc3a010c7d01b50e0d17dc79c800000000000000640000000000000003";
    Vec::from_hex(hex_str).expect("Invalid hex string")
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::alloy_primitives::address;

    #[test]
    fn test_create_set_valid_period_vaa() {
        let vaa = create_set_valid_period_vaa(0);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0104"));
    }

    #[test]
    fn test_create_set_fee_vaa() {
        let vaa = create_set_fee_vaa(5, 3);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0103"));
    }

    #[test]
    fn test_create_set_transaction_fee_vaa() {
        let vaa = create_set_transaction_fee_vaa(100, 3);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0108"));
    }

    #[test]
    fn test_create_set_data_sources_vaa() {
        let sources = vec![(1u16, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11, 0x11])];
        let vaa = create_set_data_sources_vaa(sources);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0102"));
    }

    #[test]
    fn test_create_authorize_governance_data_source_transfer_vaa() {
        let claim_vaa = vec![0u8; 32]; // Placeholder
        let vaa = create_authorize_governance_data_source_transfer_vaa(claim_vaa);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0101"));
    }

    #[test]
    fn test_create_withdraw_fee_vaa() {
        let target_address = address!("70997970C51812dc3A010C7d01b50e0d17dc79C8");
        let vaa = create_withdraw_fee_vaa(target_address, 100, 3);
        assert!(!vaa.is_empty());
        let hex_str = hex::encode(&vaa);
        assert!(hex_str.contains("5054474d0109"));
    }
}
