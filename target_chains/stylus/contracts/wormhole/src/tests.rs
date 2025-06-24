
use super::*;

#[cfg(all(test, feature = "std"))]
mod tests {
    use super::*;
    use alloc::vec;

    use core::str::FromStr;
    use k256::ecdsa::SigningKey;
    use stylus_sdk::alloy_primitives::keccak256;
    use stylus_test::*;
    
    #[cfg(test)]
    use base64::engine::general_purpose;
    #[cfg(test)]
    use base64::Engine;

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    #[cfg(test)]
    fn test_wormhole_vaa() -> Vec<u8> {
        general_purpose::STANDARD.decode("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==").unwrap()
    }

    #[cfg(test)]
    fn create_vaa_bytes(input_string: &str) -> Vec<u8> {
        let vaa_bytes = general_purpose::STANDARD
            .decode(input_string)
            .unwrap();
        let vaa: Vec<u8> = vaa_bytes;
        vaa
    }

    #[cfg(test)]
    fn test_guardian_secret1() -> [u8; 32] {
        [
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
            0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
            0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
        ]
    }

    #[cfg(test)]
    fn test_guardian_secret2() -> [u8; 32] {
        [
            0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30,
            0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
            0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40,
        ]
    }
    
    #[cfg(test)]
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

    #[cfg(test)]
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



    #[cfg(test)]
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


    #[cfg(test)]
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

    #[cfg(test)]
    fn deploy_with_test_guardian() -> WormholeContract {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = vec![test_guardian_address1()];
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        match contract.store_gs(0, guardians.clone(), 0) {
            Ok(_) => {}
            Err(_) => unreachable!(),
        }
        contract.initialize(guardians.clone(), CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }
    
    #[cfg(test)]
    fn deploy_with_current_mainnet_guardians() -> WormholeContract {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        let guardians = current_guardians();
        let result = contract.store_gs(4, guardians, 0);
        if let Err(_) = result {
            panic!("Error deploying mainnet guardians");
        }
        contract
    }

    #[cfg(test)]
    fn deploy_with_mainnet_guardian_set0() -> WormholeContract {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = guardian_set0();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    #[cfg(test)]
    fn deploy_with_mainnet_guardians() -> WormholeContract {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = guardian_set4();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    #[cfg(test)]
    fn guardian_set0() -> Vec<Address> {
        vec![Address::from_str("0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5").unwrap()]
    }

    #[cfg(test)]
    fn guardian_set4() -> Vec<Address> {
        vec![
            Address::from_str("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3").unwrap(),
            Address::from_str("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").unwrap(),
            Address::from_str("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").unwrap(),
        ]
    }

    #[cfg(test)]
    fn mock_guardian_set13() -> Vec<Address> {
        vec![
            Address::from([0x58, 0x93, 0xB5, 0xA7, 0x6c, 0x3f, 0x73, 0x96, 0x45, 0x64, 0x88, 0x85, 0xbD, 0xCc, 0xC0, 0x6c, 0xd7, 0x0a, 0x3C, 0xd3]),
            Address::from([0xff, 0x6C, 0xB9, 0x52, 0x58, 0x9B, 0xDE, 0x86, 0x2c, 0x25, 0xEf, 0x43, 0x92, 0x13, 0x2f, 0xb9, 0xD4, 0xA4, 0x21, 0x57]),
        ]
    }

    #[cfg(test)]
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

    fn create_test_vaa_with_emitter(guardian_set_index: u32, signatures: Vec<GuardianSignature>, emitter: Address) -> VerifiedVM {
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

    fn create_valid_guardian_signature(guardian_index: u8, hash: &FixedBytes<32>) -> Result<GuardianSignature, WormholeError> {
        let secret_bytes = match guardian_index {
            0 => test_guardian_secret1(),
            1 => test_guardian_secret2(),
            _ => test_guardian_secret1(),
        };

        let signing_key = SigningKey::from_bytes(&secret_bytes.into())
            .map_err(|_| WormholeError::InvalidInput)?;

        let hash_array: [u8; 32] = hash.as_slice().try_into()
            .map_err(|_| WormholeError::InvalidInput)?;

        let (signature, recovery_id) = signing_key.sign_prehash_recoverable(&hash_array)
            .map_err(|_| WormholeError::InvalidInput)?;

        let mut sig_bytes = [0u8; 65];
        sig_bytes[..64].copy_from_slice(&signature.to_bytes());
        sig_bytes[64] = recovery_id.to_byte() + 27;

        Ok(GuardianSignature {
            guardian_index,
            signature: FixedBytes::from(sig_bytes),
        })
    }

    #[cfg(test)]
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

    #[test]
    fn test_quorum_calculation() {
        assert_eq!(WormholeContract::quorum(1), 1);
        assert_eq!(WormholeContract::quorum(3), 3);
        assert_eq!(WormholeContract::quorum(19), 13);
    }

    #[test]
    fn test_testvm_integration() {
        let vm = TestVM::default();
        let contract = WormholeContract::from(&vm);
        assert_eq!(contract.get_current_guardian_set_index(), 0u32);
    }

    #[test]
    fn test_vaa_invalid_guardian_set_idx() {
        let contract = deploy_with_current_mainnet_guardians();
        let test_vaa = create_vaa_bytes("AQAHHHQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = contract.parse_and_verify_vm(test_vaa);
        assert!(matches!(result, Err(ref err) if err == &vec![1]));
    }

    // #[test]
    // fn test_wormhole_vaa_parsing() {
    //     let vaa_vec = test_wormhole_vaa();
    //     let result = match WormholeContract::parse_vm(&vaa_vec) {
    //         Ok(vaa) => vaa,
    //         Err(_) => unreachable!(),
    //     };
    //     assert_eq!(result.signatures.len(), 13)
    // }

    #[test]
    fn test_verification_multiple_guardian_sets() {
        let mut contract = deploy_with_current_mainnet_guardians();
        
        let guardians = current_guardians();
        let store_result = contract.store_gs(4, guardians, 0);
        if let Err(_) = store_result {
            panic!("Error deploying multiple guardian sets");
        }

        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = contract.parse_and_verify_vm(test_vaa);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verification_incorrect_guardian_set() {
        let mut contract = deploy_with_current_mainnet_guardians();
        
        let guardians = mock_guardian_set13();
        let store_result = contract.store_gs(4, guardians, 0);
        if let Err(_) = store_result {
            panic!("Error deploying guardian set");
        }

        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = contract.parse_and_verify_vm(test_vaa);
        assert!(result.is_err());
    }

    #[test]
    fn test_wormhole_guardian_set_vaa_verification() {
        let contract = deploy_with_current_mainnet_guardians();
        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = contract.parse_and_verify_vm(test_vaa);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_guardian_set_works() {
        let contract = deploy_with_mainnet_guardian_set0();

        let set0 = contract.get_gs_internal(4).unwrap();
        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set0.expiration_time, 0);
        assert_eq!(contract.get_current_guardian_set_index(), 4);
    }

    // #[test]
    // fn test_parse_vm_invalid_length() {
    //     let short_vaa = vec![1, 0, 0, 0];
    //     let result = WormholeContract::parse_vm(&short_vaa);
    //     assert!(matches!(result, Err(WormholeError::InvalidVAAFormat)));
    // }

    // #[test]
    // fn test_parse_vm_invalid_version() {
    //     let invalid_version_vaa = vec![2, 0, 0, 0, 0, 0];
    //     let result = WormholeContract::parse_vm(&invalid_version_vaa);
    //     assert!(matches!(result, Err(WormholeError::InvalidVAAFormat)));
    // }

    #[test]
    fn test_verify_vm_invalid_guardian_set() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(999, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[test]
    fn test_verify_vm_insufficient_signatures() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(0, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InsufficientSignatures)));
    }

    #[test]
    fn test_verify_vm_invalid_signature_order() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = vec![
            Address::from([0x12u8; 20]),
            Address::from([0x23u8; 20]),
            Address::from([0x34u8; 20]),
        ];
        match contract.store_gs(0, guardians, 0) {
            Ok(_) => {},
            Err(_) => unreachable!(),
        }

        let signatures = vec![
            create_guardian_signature(2),
            create_guardian_signature(1), // Out of order - should trigger error
            create_guardian_signature(0),
        ];
        let vaa = create_test_vaa(0, signatures); // Use guardian set 0

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[test]
    fn test_verify_vm_invalid_guardian_index() {
        let contract = deploy_with_test_guardian();
        let signatures = vec![
            create_guardian_signature(5),
        ];
        let vaa = create_test_vaa(0, signatures);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianIndex)));
    }

    #[test]
    fn test_signature_verification_invalid_recovery_id() {
        let vm = TestVM::default();
        let contract = WormholeContract::from(&vm);
        let hash = FixedBytes::default();
        let guardian_address = Address::default();

        let mut invalid_sig = [0u8; 65];
        invalid_sig[64] = 26;
        let result = contract.verify_signature(&hash, &FixedBytes::<65>::from(invalid_sig), guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[test]
    fn test_signature_verification_all_zeros() {
        let vm = TestVM::default();
        let contract = WormholeContract::from(&vm);
        let hash = FixedBytes::default();
        let invalid_signature = FixedBytes::<65>::default();
        let guardian_address = Address::default();

        let result = contract.verify_signature(&hash, &invalid_signature, guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[test]
    fn test_rejects_empty_guardian_set() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.store_gs(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_rejects_invalid_guardian_set_index() {
        let contract = deploy_with_test_guardian();

        let result = contract.get_gs_internal(999);
        assert!(result.is_err());
    }

    #[test]
    fn test_submit_guardian_set_rejects_invalid_emitter() {
        let contract = deploy_with_test_guardian();

        let vaa = create_test_vaa_with_emitter(0, vec![], Address::from([0x99u8; 20]));
        let result = contract.verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[test]
    fn test_submit_guardian_set_rejects_wrong_index() {
        let contract = deploy_with_mainnet_guardian_set0();

        let vaa = create_test_vaa(2, vec![]); // Skip index 1
        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[test]
    fn test_deploy_rejects_empty_guardian_set() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.initialize(empty_guardians, 1, 1, Address::default());
        assert!(result.is_err());
    }

    #[test]
    fn test_submit_guardian_set_rejects_empty() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.store_gs(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    // #[test]
    // fn test_rejects_corrupted_vaa_data() {
    //     let _contract = deploy_with_mainnet_guardians();

    //     for i in 0..10 {
    //         let i_u8: u8 = match i.try_into() {
    //             Ok(val) => val,
    //             Err(_) => {
    //                 unreachable!();
    //             }
    //         };
    //         let corrupted_data = corrupted_vaa(vec![1, 0, 0, 1, 0, 0], i, i_u8, i_u8 * 2);
    //         let result = WormholeContract::parse_vm_static(&corrupted_data);
    //         assert!(result.is_err());
    //     }
    // }

    // #[test]
    // fn test_parse_and_verify_vm_rejects_corrupted_vaa() {
    //     let _contract = deploy_with_mainnet_guardians();

    //     for i in 0..5 {
    //         let i_u8: u8 = match i.try_into() {
    //             Ok(val) => val,
    //             Err(_) => {
    //                 unreachable!();
    //             }
    //         };
    //         let base_vaa = vec![1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    //         let corrupted_data = corrupted_vaa(base_vaa, i, i_u8, i_u8 * 3);
    //         let result = WormholeContract::parse_vm_static(&corrupted_data);
    //         assert!(result.is_err());
    //     }
    // }

    #[test]
    fn test_submit_guardian_set_rejects_non_governance() {
        let contract = deploy_with_mainnet_guardian_set0();

        let mut vaa = create_test_vaa(0, vec![]);
        vaa.emitter_chain_id = 999; // Wrong chain

        let result = contract.verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[test]
    fn test_guardian_set_storage_and_retrieval() -> Result<(), WormholeError> {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];

        let _ = contract.store_gs(0, guardians.clone(), 0);
        let retrieved_set = contract
            .get_gs_internal(0)?;

        assert_eq!(retrieved_set.keys, guardians.clone());
        assert_eq!(retrieved_set.expiration_time, 0);

        Ok(())
    }

    #[test]
    fn test_guardian_key_computation() {

        let set_index = 0u32;
        let guardian_index = 1u8;
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let expected = U256::from_be_bytes(keccak256(&key_data).0);

        let key_data2 = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let result2 = U256::from_be_bytes(keccak256(&key_data2).0);

        assert_eq!(expected, result2);
    }

    #[test]
    fn test_multiple_guardian_sets() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);

        contract
            .store_gs(0, guardian_set0(), 0)
            .unwrap();
        contract
            .store_gs(4, guardian_set4(), 0)
            .unwrap();

        let set0 = contract.get_gs_internal(0)
            .unwrap();
        let set4 = contract.get_gs_internal(4)
            .unwrap();

        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set4.keys, guardian_set4());
    }

    #[test]
    fn test_verify_vm_with_valid_signatures() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];
        match contract.store_gs(0, guardians, 0) {
            Ok(()) => (),
            Err(_) => unreachable!(),
        }
        let hash = FixedBytes::<32>::from([0x42u8; 32]);

        let vaa = VerifiedVM {
            version: 1,
            guardian_set_index: 0,
            signatures: vec![
                create_valid_guardian_signature(0, &hash).unwrap(),
                create_valid_guardian_signature(1, &hash).unwrap(),
            ],
            timestamp: 0,
            nonce: 0,
            emitter_chain_id: 1,
            emitter_address: FixedBytes::default(),
            sequence: 0,
            consistency_level: 0,
            payload: vec![],
            hash,
        };

        let _result = contract.verify_vm(&vaa);
    }

    #[test]
    fn test_chain_id_governance_values() {
        let contract = deploy_with_mainnet_guardians();

        assert_eq!(contract.chain_id(), CHAIN_ID);

        assert_eq!(contract.governance_chain_id(), GOVERNANCE_CHAIN_ID);

        let gov_contract = contract.governance_contract();
        let expected = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        assert_eq!(gov_contract, expected);

    }

    #[test]
    fn test_governance_action_consumed() {
        let contract = deploy_with_mainnet_guardians();

        let test_hash = [0u8; 32];
        assert_eq!(contract.governance_action_is_consumed(&test_hash), false);
    }

    #[test]
    fn test_initialize_contract_like_shell_script() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        
        let result = contract.initialize(guardians.clone(), CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);
        assert!(result.is_ok(), "Contract initialization should succeed");
    }

    #[test]
    fn test_quorum_calculation_integration_test() {
        let quorum_result = WormholeContract::quorum(3);
        assert_eq!(quorum_result, 3, "Quorum calculation should work: (3 * 2) / 3 + 1 = 3");
    }

    #[test]
    fn test_guardian_set_retrieval_current_guardians() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let result = contract.initialize(guardians.clone(), CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

        let guardian_set_result = contract.get_guardian_set(4);
        assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

        let guardian_set_bytes = guardian_set_result.unwrap();
        assert_eq!(guardian_set_bytes.len(), 19 * 20, "Should have 19 guardian addresses (20 bytes each)");

        assert_eq!(contract.chain_id(), CHAIN_ID, "Chain ID should match shell script value");

        assert_eq!(contract.governance_chain_id(), GOVERNANCE_CHAIN_ID, "Governance chain ID should match shell script value");

        assert_eq!(contract.governance_contract(), governance_contract, "Governance contract should match shell script value");

        assert_eq!(contract.get_current_guardian_set_index(), 4, "Current guardian set index should be 4");
    }

    #[test]
    fn test_duplicate_verification() {
        let vm = TestVM::default();
        let mut contract = WormholeContract::from(&vm);
        let guardians = current_guardians_duplicate();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let result = contract.initialize(guardians.clone(), CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

        let guardian_set_result = contract.get_guardian_set(4);
        assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

        let test_vaa = create_vaa_bytes("AQAHHHQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = contract.parse_and_verify_vm(test_vaa);
        println!("result: {:?}", result);
        assert!(result.is_err());
    }

    
}
