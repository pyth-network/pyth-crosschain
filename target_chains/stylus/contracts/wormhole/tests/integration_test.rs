use wormhole_contract::*;
use std::vec;
use motsu::prelude::*;
use core::str::FromStr;
use stylus_sdk::alloy_primitives::{Address, FixedBytes, U256};
use motsu::prelude::Contract;
use k256::ecdsa::SigningKey;
use motsu::prelude::DefaultStorage;
use stylus_sdk::alloy_primitives::keccak256;
use wormhole_contract::*;

use base64::Engine;
use base64::engine::general_purpose;

const CHAIN_ID: u16 = 60051;
const GOVERNANCE_CHAIN_ID: u16 = 1;
const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

fn test_wormhole_vaa() -> Vec<u8> {
    general_purpose::STANDARD.decode("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==").unwrap()
}

fn create_vaa_bytes(input_string: &str) -> Vec<u8> {
    let vaa_bytes = general_purpose::STANDARD.decode(input_string).unwrap();
    let vaa: Vec<u8> = vaa_bytes;
    vaa
}

fn test_guardian_secret1() -> [u8; 32] {
    [
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e,
        0x1f, 0x20,
    ]
}

fn test_guardian_secret2() -> [u8; 32] {
    [
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
        0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e,
        0x3f, 0x40,
    ]
}

fn current_guardians() -> Vec<Address> {
    vec![
        Address::from_str("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3").unwrap(), // Rockaway
        Address::from_str("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").unwrap(), // Staked
        Address::from_str("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").unwrap(), // Figment
        Address::from_str("0x107A0086b32d7A0977926A205131d8731D39cbEB").unwrap(), // ChainodeTech
        Address::from_str("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2").unwrap(), // Inotel
        Address::from_str("0x11b39756C042441BE6D8650b69b54EbE715E2343").unwrap(), // HashKey Cloud
        Address::from_str("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd").unwrap(), // ChainLayer
        Address::from_str("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20").unwrap(), // xLabs
        Address::from_str("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0").unwrap(), // Forbole
        Address::from_str("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e").unwrap(), // Staking Fund
        Address::from_str("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14").unwrap(), // Moonlet Wallet
        Address::from_str("0xf93124b7c738843CBB89E864c862c38cddCccF95").unwrap(), // P2P Validator
        Address::from_str("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890").unwrap(), // 01node
        Address::from_str("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811").unwrap(), // MCF
        Address::from_str("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3").unwrap(), // Everstake
        Address::from_str("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf").unwrap(), // Chorus One
        Address::from_str("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8").unwrap(), // Syncnode
        Address::from_str("0x5E1487F35515d02A92753504a8D75471b9f49EdB").unwrap(), // Triton
        Address::from_str("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d").unwrap(), // Staking Facilities
    ]
}

fn current_guardians_duplicate() -> Vec<Address> {
    vec![
        Address::from_str("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3").unwrap(), // Rockaway
        Address::from_str("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").unwrap(), // Staked
        Address::from_str("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").unwrap(), // Figment
        Address::from_str("0x107A0086b32d7A0977926A205131d8731D39cbEB").unwrap(), // ChainodeTech
        Address::from_str("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2").unwrap(), // Inotel
        Address::from_str("0x11b39756C042441BE6D8650b69b54EbE715E2343").unwrap(), // HashKey Cloud
        Address::from_str("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd").unwrap(), // ChainLayer
        Address::from_str("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20").unwrap(), // xLabs
        Address::from_str("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0").unwrap(), // Forbole
        Address::from_str("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e").unwrap(), // Staking Fund
        Address::from_str("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14").unwrap(), // Moonlet Wallet
        Address::from_str("0xf93124b7c738843CBB89E864c862c38cddCccF95").unwrap(), // P2P Validator
        Address::from_str("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890").unwrap(), // 01node
        Address::from_str("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811").unwrap(), // MCF
        Address::from_str("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3").unwrap(), // Everstake
        Address::from_str("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf").unwrap(), // Chorus One
        Address::from_str("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8").unwrap(), // Syncnode
        Address::from_str("0x5E1487F35515d02A92753504a8D75471b9f49EdB").unwrap(), // Triton
        Address::from_str("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d").unwrap(), // Staking Facilities
        Address::from_str("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d").unwrap(), // duplicate of Staking Facilities
    ]
}

fn test_guardian_address1() -> Address {
    let secret = test_guardian_secret1();
    let signing_key = SigningKey::from_bytes(&secret.into()).expect("key");
    let verifying_key = signing_key.verifying_key();
    let public_key_bytes = verifying_key.to_encoded_point(false);
    let public_key_slice = &public_key_bytes.as_bytes()[1..];
    let hash = keccak256(public_key_slice);
    let address_bytes: [u8; 20] = hash[12..].try_into().unwrap();
    Address::from(address_bytes)
}

fn test_guardian_address2() -> Address {
    let secret = test_guardian_secret2();
    let signing_key = SigningKey::from_bytes(&secret.into()).expect("key");
    let verifying_key = signing_key.verifying_key();
    let public_key_bytes = verifying_key.to_encoded_point(false);
    let public_key_slice = &public_key_bytes.as_bytes()[1..];
    let hash = keccak256(public_key_slice);
    let address_bytes: [u8; 20] = hash[12..].try_into().unwrap();
    Address::from(address_bytes)
}


fn deploy_with_test_guardian(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
    let guardians = vec![test_guardian_address1()];
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
}


fn deploy_with_current_mainnet_guardians(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
    let guardians = current_guardians();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    wormhole_contract.sender(*alice).initialize(guardians, 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
}


fn deploy_with_mainnet_guardian_set0(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
    let guardians = guardian_set0();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
}


fn deploy_with_mainnet_guardians(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
    let guardians = guardian_set4();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
}

fn guardian_set0() -> Vec<Address> {
    vec![Address::from_str("0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5").unwrap()]
}

fn guardian_set4() -> Vec<Address> {
    vec![
        Address::from_str("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3").unwrap(),
        Address::from_str("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").unwrap(),
        Address::from_str("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").unwrap(),
    ]
}

fn mock_guardian_set13() -> Vec<Address> {
    vec![
        Address::from([
            0x58, 0x93, 0xB5, 0xA7, 0x6c, 0x3f, 0x73, 0x96, 0x45, 0x64, 0x88, 0x85, 0xbD, 0xCc,
            0xC0, 0x6c, 0xd7, 0x0a, 0x3C, 0xd3,
        ]),
        Address::from([
            0xff, 0x6C, 0xB9, 0x52, 0x58, 0x9B, 0xDE, 0x86, 0x2c, 0x25, 0xEf, 0x43, 0x92, 0x13,
            0x2f, 0xb9, 0xD4, 0xA4, 0x21, 0x57,
        ]),
    ]
}

fn corrupted_vaa(mut real_data: Vec<u8>, pos: usize, random1: u8, random2: u8) -> Vec<u8> {
    if real_data.len() < 2 {
        return real_data;
    }
    let pos = pos % real_data.len();
    let pos2 = (pos + 1) % real_data.len();

    real_data[pos] = real_data[pos].wrapping_add(random1).wrapping_add(1);
    real_data[pos2] = real_data[pos2].wrapping_add(random2).wrapping_add(1);
    real_data
}

fn create_test_vaa(guardian_set_index: u32, signatures: Vec<GuardianSignature>) -> VerifiedVM {
    VerifiedVM {
        version: 1,
        guardian_set_index,
        signatures,
        timestamp: 0,
        nonce: 0,
        emitter_chain_id: 1,
        emitter_address: FixedBytes::default(),
        sequence: 0,
        consistency_level: 0,
        payload: vec![],
        hash: FixedBytes::default(),
    }
}

fn create_test_vaa_with_emitter(
    guardian_set_index: u32,
    signatures: Vec<GuardianSignature>,
    emitter: Address,
) -> VerifiedVM {
    let mut emitter_bytes = [0u8; 32];
    emitter_bytes[12..32].copy_from_slice(emitter.as_slice());

    VerifiedVM {
        version: 1,
        guardian_set_index,
        signatures,
        timestamp: 0,
        nonce: 0,
        emitter_chain_id: 1,
        emitter_address: FixedBytes::from(emitter_bytes),
        sequence: 0,
        consistency_level: 0,
        payload: vec![],
        hash: FixedBytes::default(),
    }
}

fn create_valid_guardian_signature(
    guardian_index: u8,
    hash: &FixedBytes<32>,
) -> Result<GuardianSignature, WormholeError> {
    let secret_bytes = match guardian_index {
        0 => test_guardian_secret1(),
        1 => test_guardian_secret2(),
        _ => test_guardian_secret1(),
    };

    let signing_key =
        SigningKey::from_bytes(&secret_bytes.into()).map_err(|_| WormholeError::InvalidInput)?;

    let hash_array: [u8; 32] = hash
        .as_slice()
        .try_into()
        .map_err(|_| WormholeError::InvalidInput)?;

    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(&hash_array)
        .map_err(|_| WormholeError::InvalidInput)?;

    let mut sig_bytes = [0u8; 65];
    sig_bytes[..64].copy_from_slice(&signature.to_bytes());
    sig_bytes[64] = recovery_id.to_byte() + 27;

    Ok(GuardianSignature {
        guardian_index,
        signature: FixedBytes::from(sig_bytes),
    })
}

fn create_guardian_signature(guardian_index: u8) -> GuardianSignature {
    GuardianSignature {
        guardian_index,
        signature: {
            let mut sig = [0u8; 65];
            sig[64] = 27;
            FixedBytes::from(sig)
        },
    }
}

#[motsu::test]
fn test_vaa_invalid_guardian_set_idx(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
    let test_vaa = create_vaa_bytes("AQAHHHQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
    assert!(matches!(result, Err(ref err) if err == &vec![1]));
}

#[motsu::test]
fn test_verification_multiple_guardian_sets(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
    

    let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
    assert!(result.is_ok());
}

#[motsu::test]
fn test_verification_incorrect_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
    

    let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
    assert!(result.is_ok());
}

#[motsu::test]
fn test_wormhole_guardian_set_vaa_verification(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
    let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
    assert!(result.is_ok());
}


#[motsu::test]
fn test_rejects_invalid_guardian_set_index(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_test_guardian(&wormhole_contract, &alice);

    let result = wormhole_contract.sender(alice).get_guardian_set(999);
    assert!(result.is_err());
}

#[motsu::test]
fn test_submit_guardian_set_rejects_invalid_emitter(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_test_guardian(&wormhole_contract, &alice);

    let vaa_bytes = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(vaa_bytes);
    assert!(result.is_err());
}

#[motsu::test]
fn test_submit_guardian_set_rejects_wrong_index(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_mainnet_guardian_set0(&wormhole_contract, &alice);

    let vaa_bytes = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(vaa_bytes);
    assert!(result.is_err());
}

#[motsu::test]
fn test_rejects_corrupted_vaa_data(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_mainnet_guardians(&wormhole_contract, &alice);

    for i in 0..10 {
        let i_u8: u8 = match i.try_into() {
            Ok(val) => val,
            Err(_) => {
                unreachable!();
            }
        };
        let corrupted_data = corrupted_vaa(vec![1, 0, 0, 1, 0, 0], i, i_u8, i_u8 * 2);
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(corrupted_data);
        assert!(result.is_err());
    }
}

#[motsu::test]
fn test_submit_guardian_set_rejects_non_governance(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_mainnet_guardian_set0(&wormhole_contract, &alice);

    let vaa_bytes = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(vaa_bytes);
    assert!(result.is_err());
}

#[motsu::test]
fn test_chain_id_governance_values(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_mainnet_guardians(&wormhole_contract, &alice);

    assert_eq!(wormhole_contract.sender(alice).chain_id(), CHAIN_ID);

    assert_eq!(wormhole_contract.sender(alice).governance_chain_id(), GOVERNANCE_CHAIN_ID);

    let gov_contract = wormhole_contract.sender(alice).governance_contract();
    let expected = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    assert_eq!(gov_contract, expected);
}

#[motsu::test]
fn test_governance_action_consumed(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    deploy_with_mainnet_guardians(&wormhole_contract, &alice);

    let test_hash = vec![0u8; 32];
    assert_eq!(wormhole_contract.sender(alice).governance_action_is_consumed(test_hash), false);
}

#[motsu::test]
fn test_initialize_contract_like_shell_script(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    let guardians = current_guardians();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
    
    let result = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);
    assert!(result.is_ok(), "Contract initialization should succeed");
}

#[motsu::test]
fn test_guardian_set_retrieval_current_guardians(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    let guardians = current_guardians();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

    let result = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

    let guardian_set_result = wormhole_contract.sender(alice).get_guardian_set(4);
    assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

    let guardian_set_bytes = guardian_set_result.unwrap();
    assert_eq!(
        guardian_set_bytes.len(),
        19 * 20,
        "Should have 19 guardian addresses (20 bytes each)"
    );

    assert_eq!(wormhole_contract.sender(alice).chain_id(), CHAIN_ID, "Chain ID should match shell script value");

    assert_eq!(wormhole_contract.sender(alice).governance_chain_id(), GOVERNANCE_CHAIN_ID, "Governance chain ID should match shell script value");

    assert_eq!(wormhole_contract.sender(alice).governance_contract(), governance_contract, "Governance contract should match shell script value");

    assert_eq!(wormhole_contract.sender(alice).get_current_guardian_set_index(), 4, "Current guardian set index should be 4");
}

#[motsu::test]
fn test_duplicate_verification(wormhole_contract: Contract<WormholeContract>, alice: Address) {
    let guardians = current_guardians_duplicate();
    let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

    let result = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

    let guardian_set_result = wormhole_contract.sender(alice).get_guardian_set(4);
    assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

    let test_vaa = create_vaa_bytes("AQAHHHQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
    let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
    println!("result: {:?}", result);
    assert!(result.is_err());
}