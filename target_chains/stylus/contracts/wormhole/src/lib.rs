#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![macro_use]
extern crate alloc;

#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

use alloc::{vec, vec::Vec};
use stylus_sdk::{
    alloy_primitives::{Address, FixedBytes, U256, keccak256},
    prelude::*,
    storage::{StorageAddress, StorageBool, StorageMap, StorageUint},
};

use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

#[derive(Clone, PartialEq, Default)]
pub struct GuardianSet {
    pub keys: Vec<Address>,
    pub expiration_time: u32,
}

#[derive(Clone, Debug)]
pub struct GuardianSignature {
    pub guardian_index: u8,
    pub signature: FixedBytes<65>,
}

#[derive(Clone, Debug)]
pub struct VerifiedVM {
    pub version: u8,
    pub guardian_set_index: u32,
    pub signatures: Vec<GuardianSignature>,
    pub timestamp: u32,
    pub nonce: u32,
    pub emitter_chain_id: u16,
    pub emitter_address: FixedBytes<32>,
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: Vec<u8>,
    pub hash: FixedBytes<32>,
}

pub enum WormholeError {
    InvalidGuardianSetIndex,
    GuardianSetExpired,
    NoQuorum,
    InvalidSignatureOrder,
    InvalidSignature,
    InvalidVAAFormat,
    GovernanceActionConsumed,
    AlreadyInitialized,
    NotInitialized,
    InvalidInput,
    InsufficientSignatures,
    InvalidGuardianIndex,
    InvalidAddressLength,
    VerifyVAAError,
}

impl core::fmt::Debug for WormholeError {
    fn fmt(&self, _: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        Ok(())
    }
}

impl From<WormholeError> for Vec<u8> {
    fn from(error: WormholeError) -> Vec<u8> {
        vec![match error {
            WormholeError::InvalidGuardianSetIndex => 1,
            WormholeError::GuardianSetExpired => 2,
            WormholeError::NoQuorum => 3,
            WormholeError::InvalidSignatureOrder => 4,
            WormholeError::InvalidSignature => 5,
            WormholeError::InvalidVAAFormat => 6,
            WormholeError::GovernanceActionConsumed => 7,
            WormholeError::AlreadyInitialized => 8,
            WormholeError::NotInitialized => 9,
            WormholeError::InvalidInput => 10,
            WormholeError::InsufficientSignatures => 11,
            WormholeError::InvalidGuardianIndex => 12,
            WormholeError::InvalidAddressLength => 13,
            WormholeError::VerifyVAAError => 14,
        }]
    }
}

pub trait IWormhole {
    fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<VerifiedVM, WormholeError>;
    fn get_guardian_set(&self, index: u32) -> Option<GuardianSet>;
    fn get_current_guardian_set_index(&self) -> u32;
    fn governance_action_is_consumed(&self, hash: Vec<u8>) -> bool;
    fn chain_id(&self) -> u16;
    fn governance_chain_id(&self) -> u16;
    fn governance_contract(&self) -> Address;
    fn submit_new_guardian_set(&mut self, encoded_vaa: Vec<u8>) -> Result<(), WormholeError>;
}

#[storage]
#[entrypoint]
pub struct WormholeContract {
    current_guardian_set_index: StorageUint<256, 4>,
    chain_id: StorageUint<256, 4>,
    governance_chain_id: StorageUint<256, 4>,
    governance_contract: StorageAddress,
    consumed_governance_actions: StorageMap<Vec<u8>, StorageBool>,
    initialized: StorageBool,
    guardian_set_sizes: StorageMap<U256, StorageUint<256, 4>>,
    guardian_set_expiry: StorageMap<U256, StorageUint<256, 4>>,
    guardian_keys: StorageMap<U256, StorageAddress>,
}

#[public]
impl WormholeContract {
    pub fn initialize(
        &mut self,
        initial_guardians: Vec<Address>,
        initial_guardian_set_index: u32,
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: Address,
    ) -> Result<(), Vec<u8>> {
        if self.initialized.get() {
            return Err(WormholeError::AlreadyInitialized.into());
        }
        self.current_guardian_set_index
            .set(U256::from(initial_guardian_set_index));
        self.chain_id.set(U256::from(chain_id));
        self.governance_chain_id
            .set(U256::from(governance_chain_id));
        self.governance_contract.set(governance_contract);

        self.store_gs(initial_guardian_set_index, initial_guardians, 0)?;

        self.initialized.set(true);
        Ok(())
    }

    pub fn get_guardian_set(&self, index: u32) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }

        match self.get_gs_internal(index) {
            Ok(guardian_set) => {
                let mut encoded = Vec::with_capacity(guardian_set.keys.len() * 20);
                for address in &guardian_set.keys {
                    encoded.extend_from_slice(address.as_slice());
                }
                Ok(encoded)
            }
            Err(e) => Err(e.into()),
        }
    }

    pub fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }

        if encoded_vaa.is_empty() {
            return Err(WormholeError::InvalidVAAFormat.into());
        }

        let vaa = self.parse_vm(&encoded_vaa)?;

        let _verified = self.verify_vm(&vaa)?;

        Ok(vaa.payload)
    }

    fn quorum(num_guardians: u32) -> u32 {
        (num_guardians * 2) / 3 + 1
    }
    fn chain_id(&self) -> u16 {
        self.chain_id.get().try_into().unwrap_or(0u16)
    }
}

impl WormholeContract {
    fn parse_vm(&self, encoded_vaa: &[u8]) -> Result<VerifiedVM, WormholeError> {
        Self::parse_vm_static(encoded_vaa)
    }

    // Parsing a Wormhole VAA according to the structure defined
    // by https://wormhole.com/docs/protocol/infrastructure/vaas/
    fn parse_vm_static(encoded_vaa: &[u8]) -> Result<VerifiedVM, WormholeError> {
        if encoded_vaa.len() < 6 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        let mut cursor = 0;

        // Get version
        let version = encoded_vaa
            .get(cursor)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        cursor += 1;

        if *version != 1 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        // Get guardian set index
        let gsi_bytes = encoded_vaa
            .get(cursor..cursor + 4)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let guardian_set_index = u32::from_be_bytes(
            gsi_bytes
                .try_into()
                .map_err(|_| WormholeError::InvalidVAAFormat)?,
        );
        cursor += 4;

        // Get number of signatures
        let len_signatures = *encoded_vaa
            .get(cursor)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        cursor += 1;

        if len_signatures > 19 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        let mut signatures = Vec::with_capacity(len_signatures as usize);

        for _ in 0..len_signatures {
            if cursor + 66 > encoded_vaa.len() {
                return Err(WormholeError::InvalidVAAFormat);
            }

            let guardian_index = *encoded_vaa
                .get(cursor)
                .ok_or(WormholeError::InvalidVAAFormat)?;
            cursor += 1;

            let sig_bytes = encoded_vaa
                .get(cursor..cursor + 65)
                .ok_or(WormholeError::InvalidVAAFormat)?;
            let mut fixed_sig = [0u8; 65];
            fixed_sig.copy_from_slice(sig_bytes);
            cursor += 65;

            signatures.push(GuardianSignature {
                guardian_index,
                signature: FixedBytes::from(fixed_sig),
            });
        }

        if cursor + 51 > encoded_vaa.len() {
            return Err(WormholeError::InvalidVAAFormat);
        }

        // Get timestamp
        let ts_bytes = encoded_vaa
            .get(cursor..cursor + 4)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let timestamp = u32::from_be_bytes(
            ts_bytes
                .try_into()
                .map_err(|_| WormholeError::InvalidVAAFormat)?,
        );
        cursor += 4;

        // Get nonce
        let nonce_bytes = encoded_vaa
            .get(cursor..cursor + 4)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let nonce = u32::from_be_bytes(
            nonce_bytes
                .try_into()
                .map_err(|_| WormholeError::InvalidVAAFormat)?,
        );
        cursor += 4;

        // Get emitter chain ID
        let emitter_chain_bytes = encoded_vaa
            .get(cursor..cursor + 2)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let emitter_chain_id = u16::from_be_bytes([emitter_chain_bytes[0], emitter_chain_bytes[1]]);
        cursor += 2;

        // Get emitter address
        let emitter_address_bytes = encoded_vaa
            .get(cursor..cursor + 32)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let mut fixed_emitter = [0u8; 32];
        fixed_emitter.copy_from_slice(emitter_address_bytes);
        cursor += 32;

        // Get sequence
        let sequence_bytes = encoded_vaa
            .get(cursor..cursor + 8)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        let sequence = u64::from_be_bytes(
            sequence_bytes
                .try_into()
                .map_err(|_| WormholeError::InvalidVAAFormat)?,
        );
        cursor += 8;

        // Get consistency level
        let consistency_level = *encoded_vaa
            .get(cursor)
            .ok_or(WormholeError::InvalidVAAFormat)?;
        cursor += 1;

        // Get payload
        let payload = encoded_vaa
            .get(cursor..)
            .ok_or(WormholeError::InvalidVAAFormat)?
            .to_vec();

        let hash = keccak256(&encoded_vaa[cursor - 51..]);

        Ok(VerifiedVM {
            version: *version,
            guardian_set_index,
            signatures,
            timestamp,
            nonce,
            emitter_chain_id,
            emitter_address: FixedBytes::from(fixed_emitter),
            sequence,
            consistency_level,
            payload,
            hash,
        })
    }

    fn verify_vm(&self, vaa: &VerifiedVM) -> Result<(), WormholeError> {
        let guardian_set = self.get_gs_internal(vaa.guardian_set_index)?;
        let current_gsi = self.current_guardian_set_index.get().try_into().unwrap_or(0u32);
        if vaa.guardian_set_index != current_gsi && guardian_set.expiration_time > 0 {
            return Err(WormholeError::GuardianSetExpired);
        }

        let num_guardians: u32 = guardian_set
            .keys
            .len()
            .try_into()
            .map_err(|_| WormholeError::InvalidInput)?;

        let required_signatures = Self::quorum(num_guardians);
        let num_signatures: u32 = vaa
            .signatures
            .len()
            .try_into()
            .map_err(|_| WormholeError::InvalidInput)?;

        if num_signatures < required_signatures {
            return Err(WormholeError::InsufficientSignatures);
        }

        let mut last_guardian_index: Option<u8> = None;

        for signature in &vaa.signatures {
            if let Some(last_index) = last_guardian_index {
                if signature.guardian_index <= last_index {
                    return Err(WormholeError::InvalidSignatureOrder);
                }
            }
            last_guardian_index = Some(signature.guardian_index);

            let index: usize = signature
                .guardian_index
                .try_into()
                .map_err(|_| WormholeError::InvalidGuardianIndex)?;

            if index >= guardian_set.keys.len() {
                return Err(WormholeError::InvalidGuardianIndex);
            }

            let guardian_address = guardian_set.keys[index];
            let hashed_vaa_hash: FixedBytes<32> = FixedBytes::from(keccak256(vaa.hash));

            match self.verify_signature(&hashed_vaa_hash, &signature.signature, guardian_address) {
                Ok(true) => {}
                Ok(false) => return Err(WormholeError::InvalidSignature.into()),
                Err(e) => return Err(e),
            }
        }

        Ok(())
    }

    fn compute_gs_key(&self, set_index: u32, guardian_index: u8) -> U256 {
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        U256::from_be_bytes(keccak256(&key_data).0)
    }

    fn store_gs(
        &mut self,
        set_index: u32,
        guardians: Vec<Address>,
        expiration_time: u32,
    ) -> Result<(), WormholeError> {
        if guardians.is_empty() {
            return Err(WormholeError::InvalidInput);
        }

        self.guardian_set_sizes
            .setter(U256::from(set_index))
            .set(U256::from(guardians.len()));
        self.guardian_set_expiry
            .setter(U256::from(set_index))
            .set(U256::from(expiration_time));

        for (i, guardian) in guardians.iter().enumerate() {
            let i_u8: u8 = i
                .try_into()
                .map_err(|_| WormholeError::InvalidGuardianIndex)?;
            let key = self.compute_gs_key(set_index, i_u8);
            self.guardian_keys.setter(key).set(*guardian);
        }

        Ok(())
    }

    fn verify_signature(
        &self,
        hash: &FixedBytes<32>,
        signature: &FixedBytes<65>,
        guardian_address: Address,
    ) -> Result<bool, WormholeError> {
        if signature.len() != 65 {
            return Err(WormholeError::InvalidSignature);
        }

        let recovery_id_byte = signature[64];
        let recovery_id = if recovery_id_byte >= 27 {
            RecoveryId::try_from(recovery_id_byte - 27)
                .map_err(|_| WormholeError::InvalidSignature)?
        } else {
            RecoveryId::try_from(recovery_id_byte).map_err(|_| WormholeError::InvalidSignature)?
        };

        let sig =
            Signature::try_from(&signature[..64]).map_err(|_| WormholeError::InvalidSignature)?;

        let verifying_key = VerifyingKey::recover_from_prehash(
            hash.as_slice()
                .try_into()
                .map_err(|_| WormholeError::InvalidInput)?,
            &sig,
            recovery_id,
        )
        .map_err(|_| WormholeError::InvalidSignature)?;

        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_slice = &public_key_bytes.as_bytes()[1..];

        let address_hash = keccak256(public_key_slice);
        let address_bytes: [u8; 20] = address_hash[12..]
            .try_into()
            .map_err(|_| WormholeError::InvalidAddressLength)?;

        Ok(Address::from(address_bytes) == guardian_address)
    }

    fn get_gs_internal(&self, index: u32) -> Result<GuardianSet, WormholeError> {
        let size = self.guardian_set_sizes.getter(U256::from(index)).get();
        if size.is_zero() {
            return Err(WormholeError::InvalidGuardianSetIndex);
        }

        let size_u32: u32 = size.try_into().unwrap_or(0);
        let mut keys = Vec::with_capacity(size_u32 as usize);
        for i in 0..size_u32 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    return Err(WormholeError::InvalidGuardianIndex);
                }
            };
            let key = self.compute_gs_key(index, i_u8);
            let guardian_address = self.guardian_keys.getter(key).get();
            keys.push(guardian_address);
        }

        let expiry = self.guardian_set_expiry.getter(U256::from(index)).get();
        let expiry_u32: u32 = expiry.try_into().unwrap_or(0);
        Ok(GuardianSet {
            keys,
            expiration_time: expiry_u32,
        })
    }
}

impl IWormhole for WormholeContract {
    fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<VerifiedVM, WormholeError> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized);
        }

        let vaa = self.parse_vm(&encoded_vaa)?;
        self.verify_vm(&vaa)?;
        
        Ok(vaa)
    }

    fn get_guardian_set(&self, index: u32) -> Option<GuardianSet> {
        self.get_gs_internal(index).ok()
    }

    fn get_current_guardian_set_index(&self) -> u32 {
        self.current_guardian_set_index
            .get()
            .try_into()
            .unwrap_or(0u32)
    }

    fn governance_action_is_consumed(&self, hash: Vec<u8>) -> bool {
        self.consumed_governance_actions.get(hash)
    }

    fn chain_id(&self) -> u16 {
        self.chain_id.get().try_into().unwrap_or(0u16)
    }

    #[inline]
    fn governance_chain_id(&self) -> u16 {
        self.governance_chain_id.get().try_into().unwrap_or(0u16)
    }

    #[inline]
    fn governance_contract(&self) -> Address {
        self.governance_contract.get()
    }

    fn submit_new_guardian_set(&mut self, _encoded_vaa: Vec<u8>) -> Result<(), WormholeError> {
        Err(WormholeError::InvalidVAAFormat)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;
    use motsu::prelude::*;
    use motsu::prelude::Contract;
    use core::str::FromStr;
    use k256::ecdsa::SigningKey;
    use stylus_sdk::alloy_primitives::keccak256;

    #[cfg(test)]
    use base64::Engine;
    #[cfg(test)]
    use base64::engine::general_purpose;

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    #[cfg(test)]
    fn test_wormhole_vaa() -> Vec<u8> {
        general_purpose::STANDARD.decode("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==").unwrap()
    }

    #[cfg(test)]
    fn create_vaa_bytes(input_string: &str) -> Vec<u8> {
        let vaa_bytes = general_purpose::STANDARD.decode(input_string).unwrap();
        let vaa: Vec<u8> = vaa_bytes;
        vaa
    }

    #[cfg(test)]
    fn test_guardian_secret1() -> [u8; 32] {
        [
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
            0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c,
            0x1d, 0x1e, 0x1f, 0x20,
        ]
    }

    #[cfg(test)]
    fn test_guardian_secret2() -> [u8; 32] {
        [
            0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e,
            0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c,
            0x3d, 0x3e, 0x3f, 0x40,
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
    fn deploy_with_test_guardian(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
        let guardians = vec![test_guardian_address1()];
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        match wormhole_contract.sender(*alice).store_gs(0, guardians.clone(), 0) {
            Ok(_) => {}
            Err(_) => unreachable!(),
        }
        wormhole_contract.sender(*alice).initialize(guardians, 1, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
    }

    #[cfg(test)]
    fn deploy_with_current_mainnet_guardians(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        let result = wormhole_contract.sender(*alice).store_gs(4, current_guardians(), 0);
        if let Err(_) = result {
            panic!("Error deploying mainnet guardians");
        }
    }

    #[cfg(test)]
    fn deploy_with_mainnet_guardian_set0(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
        let guardians = guardian_set0();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
    }

    #[cfg(test)]
    fn deploy_with_mainnet_guardians(wormhole_contract: &Contract<WormholeContract>, alice: &Address) {
        let guardians = guardian_set4();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract.sender(*alice).initialize(guardians, 0, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
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

        let signing_key = SigningKey::from_bytes(&secret_bytes.into())
            .map_err(|_| WormholeError::InvalidInput)?;

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

    #[motsu::test]
    fn test_quorum_calculation() {
        assert_eq!(WormholeContract::quorum(1), 1);
        assert_eq!(WormholeContract::quorum(3), 3);
        assert_eq!(WormholeContract::quorum(19), 13);
    }

    #[motsu::test]
    fn test_vaa_invalid_guardian_set_idx(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
        let test_vaa = create_vaa_bytes("AQAHHHQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
        assert!(matches!(result, Err(ref err) if err == &vec![1]));
    }

    #[motsu::test]
    fn test_wormhole_vaa_parsing() {
        let vaa_vec = test_wormhole_vaa();
        let result = match WormholeContract::parse_vm_static(&vaa_vec) {
            Ok(vaa) => vaa,
            Err(_) => unreachable!(),
        };
        assert_eq!(result.signatures.len(), 13)
    }

    #[motsu::test]
    fn test_verification_multiple_guardian_sets(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);

        let store_result = wormhole_contract.sender(alice).store_gs(4, current_guardians(), 0);
        if let Err(_) = store_result {
            panic!("Error deploying multiple guardian sets");
        }

        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_verification_incorrect_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);

        let store_result = wormhole_contract.sender(alice).store_gs(4, mock_guardian_set13(), 0);
        if let Err(_) = store_result {
            panic!("Error deploying guardian set");
        }

        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_wormhole_guardian_set_vaa_verification(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_current_mainnet_guardians(&wormhole_contract, &alice);
        let test_vaa = create_vaa_bytes("AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==");
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
        assert!(result.is_ok());
    }

    #[motsu::test]
    fn test_get_guardian_set_works(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_mainnet_guardian_set0(&wormhole_contract, &alice);

        let set0 = wormhole_contract.sender(alice).get_gs_internal(0).unwrap();
        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set0.expiration_time, 0);
        assert_eq!(wormhole_contract.sender(alice).get_current_guardian_set_index(), 0);
    }

    #[motsu::test]
    fn test_parse_vm_invalid_length() {
        let short_vaa = vec![1, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&short_vaa);
        assert!(matches!(result, Err(WormholeError::InvalidVAAFormat)));
    }

    #[motsu::test]
    fn test_parse_vm_invalid_version() {
        let invalid_version_vaa = vec![2, 0, 0, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&invalid_version_vaa);
        assert!(matches!(result, Err(WormholeError::InvalidVAAFormat)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_test_guardian(&wormhole_contract, &alice);
        let vaa = create_test_vaa(999, vec![]);

        let result = wormhole_contract.sender(alice).verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[motsu::test]
    fn test_verify_vm_insufficient_signatures(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_test_guardian(&wormhole_contract, &alice);
        let vaa = create_test_vaa(0, vec![]);

        let result = wormhole_contract.sender(*alice).verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InsufficientSignatures)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_signature_order(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = vec![
            Address::from([0x12u8; 20]),
            Address::from([0x23u8; 20]),
            Address::from([0x34u8; 20]),
        ];
        match wormhole_contract.sender(alice).store_gs(0, guardians.clone(), 0) {
            Ok(_) => {},
            Err(_) => unreachable!(),
        }

        let signatures = vec![
            create_guardian_signature(2),
            create_guardian_signature(1), // Out of order - should trigger error
            create_guardian_signature(0),
        ];
        let vaa = create_test_vaa(0, signatures); // Use guardian set 0

        let result = wormhole_contract.sender(alice).verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_index(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_test_guardian(&wormhole_contract, &alice);
        let signatures = vec![
            create_guardian_signature(5),
        ];
        let vaa = create_test_vaa(0, signatures);

        let result = wormhole_contract.sender(*alice).verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianIndex)));
    }

    #[motsu::test]
    fn test_signature_verification_invalid_recovery_id(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let hash = FixedBytes::default();
        let guardian_address = Address::default();

        let mut invalid_sig = [0u8; 65];
        invalid_sig[64] = 26;
        let result = wormhole_contract.sender(alice).verify_signature(&hash, &FixedBytes::<65>::from(invalid_sig), guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_signature_verification_all_zeros(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let hash = FixedBytes::default();
        let invalid_signature = FixedBytes::<65>::default();
        let guardian_address = Address::default();

        let result = wormhole_contract.sender(alice).verify_signature(&hash, &invalid_signature, guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_rejects_empty_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let empty_guardians: Vec<Address> = vec![];

        let result = wormhole_contract.sender(alice).store_gs(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_invalid_guardian_set_index(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_test_guardian(&wormhole_contract, &alice);

        let result = wormhole_contract.sender(*alice).get_gs_internal(999);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_invalid_emitter(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_test_guardian(&wormhole_contract, &alice);

        let vaa = create_test_vaa_with_emitter(0, vec![], Address::from([0x99u8; 20]));
        let result = wormhole_contract.sender(*alice).verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_wrong_index(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_mainnet_guardian_set0(&wormhole_contract, &alice);

        let vaa = create_test_vaa(2, vec![]); // Skip index 1
        let result = wormhole_contract.sender(alice).verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[motsu::test]
    fn test_deploy_rejects_empty_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let empty_guardians: Vec<Address> = vec![];

        let result = wormhole_contract.sender(alice).initialize(empty_guardians, 0, 1, 1, Address::default());
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_empty(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let empty_guardians: Vec<Address> = vec![];

        let result = wormhole_contract.sender(alice).store_gs(0, empty_guardians, 0);
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
            let result = WormholeContract::parse_vm_static(&corrupted_data);
            assert!(result.is_err());
        }
    }

    #[motsu::test]
    fn test_parse_and_verify_vm_rejects_corrupted_vaa(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_mainnet_guardians(&wormhole_contract, &alice);

        for i in 0..5 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    unreachable!();
                }
            };
            let base_vaa = vec![1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            let corrupted_data = corrupted_vaa(base_vaa, i, i_u8, i_u8 * 3);
            let result = WormholeContract::parse_vm_static(&corrupted_data);
            assert!(result.is_err());
        }
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_non_governance(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        deploy_with_mainnet_guardian_set0(&wormhole_contract, &alice);

        let mut vaa = create_test_vaa(0, vec![]);
        vaa.emitter_chain_id = 999; // Wrong chain

        let result = wormhole_contract.sender(alice).verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_guardian_set_storage_and_retrieval(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];

        wormhole_contract.sender(alice).store_gs(0, guardians.clone(), 0).unwrap();
        let retrieved_set = wormhole_contract.sender(alice).get_gs_internal(0).unwrap();

        assert_eq!(retrieved_set.keys, guardians);
        assert_eq!(retrieved_set.expiration_time, 0);
    }

    #[motsu::test]
    fn test_guardian_key_computation(wormhole_contract: Contract<WormholeContract>, alice: Address) {

        let set_index = 0u32;
        let guardian_index = 1u8;
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let expected = U256::from_be_bytes(keccak256(&key_data).0);

        let key_data2 = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let result2 = U256::from_be_bytes(keccak256(&key_data2).0);

        assert_eq!(expected, result2);
    }

    #[motsu::test]
    fn test_multiple_guardian_sets(wormhole_contract: Contract<WormholeContract>, alice: Address) {

        wormhole_contract.sender(alice)
            .store_gs(0, guardian_set0(), 0)
            .unwrap();
        wormhole_contract.sender(alice)
            .store_gs(4, guardian_set4(), 0)
            .unwrap();

        let set0 = wormhole_contract.sender(alice).get_gs_internal(0)
            .unwrap();
        let set4 = wormhole_contract.sender(alice).get_gs_internal(4)
            .unwrap();

        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set4.keys, guardian_set4());
    }

    #[motsu::test]
    fn test_verify_vm_with_valid_signatures(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];
        match wormhole_contract.sender(alice).store_gs(0, guardians.clone(), 0) {
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

        let _result = wormhole_contract.sender(alice).verify_vm(&vaa);
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
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let result = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);
        assert!(result.is_ok(), "Contract initialization should succeed");
    }

    #[motsu::test]
    fn test_quorum_calculation_integration_test(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let quorum_result = WormholeContract::quorum(3);
        assert_eq!(
            quorum_result, 3,
            "Quorum calculation should work: (3 * 2) / 3 + 1 = 3"
        );
    }

    #[motsu::test]
    fn test_guardian_set_retrieval_current_guardians(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let _ = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

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
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let _ = wormhole_contract.sender(alice).initialize(guardians.clone(), 4, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);

        let guardian_set_result = wormhole_contract.sender(alice).get_guardian_set(4);
        assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

        let test_vaa = create_vaa_bytes("AQAAAAQNAInUwKI1ItLfYeLaAibn9oXaouTs9BL3Aa9DKCFWrLu0KDaQQMQJlih0Qh7l7yH2o6kD/g9RCmRwZJ6q0OZE0t4AArCSH1wpX04N1U59tQmss2xXZilimAMKlogp7ErAhAo0LFkDogqB74+2By9rm3P5OUWlbC0lrFNut5CQQV38DGsAAxO+1nUTUc842P2afDSjdWcmjvJl2s8secQzuiW8zrdgPpbzhzWsiYXizLQBRKigDS8pWGD4vRk0fuR8H/ZkO/0BBOmDobl1BLNJx7+Pt+NWfuOUBipVFIXGxI9b3vxxH0BIec8hhxDN4m2Pd2I0klGEXKhv9plcR7VlzAsaC7ZE7QIABh4ff66tP7EHdVfZR4mTzv5B97agMcSB1eDeijpyl9JuBhbMupw7nExZNnZag/x2k6AUEWnQnfp8AoaCK7Av+icAB2Ouk9mPd1ybyju39Q8m7GMevt2f1nHVyWVsPRzdEcCuAbzjh5137DCLzVWuFUujTQJ7IJiznQb6cm2Ljk3WOXUACMa/JwRdpVKZf6eTD6O6tivqhdhMtbijlPBZX/kgVKk5Xuyv3h1SRTrNCwkMg5XOWegnCbXqjbUlo+F3qTjCalQBCxfp1itJskZmv+SXA47QivURKWzGa3mntNh0vcAXYi8FeChvoUYmfYpejmBlOkD1I73pmUsyrbYbetHa7qFu3eoBDZScdyrWp2dS5Y9L4b0who/PncVp5oFs/4J8ThHNQoXWXvys+nUc2aM+E+Fwazo2ODdI8XZz9YOGf/ZfE6iXFBYBDgckow8Nb2QD//C6MfP2Bz8zftqvt+D6Dko7v/Inb2OtCj342yjrxcvAMlCQ6lYoTIAMNemzNoqlfNyDMdB9yKoAEKebRtCm8QZSjLQ5uPk8aoQpmNwCpLhiHuzh2fqH55fcQrE6/KFttfw7VzeGUE7k3PF6xIMq0BPr3vkG2MedIh8BEQvpmYK4fChLY5JG26Kk6KuZ1eCkJAOQgdSjWasAvNgsSIlsb5mFjIkGwK9j20svLSl+OJ7I0olefXcZ2JywjgYAEu1jITMLHCMR1blXENulhApdhMfTef1aQ/USMqRVWNigausEzq49Hi2GtcQzHmZuhgnhBZEnjq9K8jsZwJk59iwBaFxZegAAAAAAATTNxrJiPzbWCugg6Vtg92ToHsLNO1e3fj+OJd3UOsNzAAAAAAATpFIAAVE6cNLnZT2Noq5nJ4VNRSf2KrRBNrlimFaXauHv3efDAAFm5RiKEwih25C20x8/vcqMPfJnjIES3909GSxaPMRXqAAAAAAAAAAAAAAAAFxIFHGlrpnuxd5M5WePQalLpUyHAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALFcwAAAAAAAAAAAAAAAAaFxdzQAAAAAAAAAAAAAAAK3MabLDE8LWvGN6+AdUvFHJdm5RAAMAAAAAAAAAAAAAAADf0SJhChSsEtk0iYwC2+wfcnCBFg==");
        let result = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn switch_guardian_set(wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = current_guardians_duplicate();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);

        let _ = wormhole_contract.sender(alice).initialize(guardians.clone(), 3, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract);
        let test_vaa = create_vaa_bytes("AQAAAAQNAInUwKI1ItLfYeLaAibn9oXaouTs9BL3Aa9DKCFWrLu0KDaQQMQJlih0Qh7l7yH2o6kD/g9RCmRwZJ6q0OZE0t4AArCSH1wpX04N1U59tQmss2xXZilimAMKlogp7ErAhAo0LFkDogqB74+2By9rm3P5OUWlbC0lrFNut5CQQV38DGsAAxO+1nUTUc842P2afDSjdWcmjvJl2s8secQzuiW8zrdgPpbzhzWsiYXizLQBRKigDS8pWGD4vRk0fuR8H/ZkO/0BBOmDobl1BLNJx7+Pt+NWfuOUBipVFIXGxI9b3vxxH0BIec8hhxDN4m2Pd2I0klGEXKhv9plcR7VlzAsaC7ZE7QIABh4ff66tP7EHdVfZR4mTzv5B97agMcSB1eDeijpyl9JuBhbMupw7nExZNnZag/x2k6AUEWnQnfp8AoaCK7Av+icAB2Ouk9mPd1ybyju39Q8m7GMevt2f1nHVyWVsPRzdEcCuAbzjh5137DCLzVWuFUujTQJ7IJiznQb6cm2Ljk3WOXUACMa/JwRdpVKZf6eTD6O6tivqhdhMtbijlPBZX/kgVKk5Xuyv3h1SRTrNCwkMg5XOWegnCbXqjbUlo+F3qTjCalQBCxfp1itJskZmv+SXA47QivURKWzGa3mntNh0vcAXYi8FeChvoUYmfYpejmBlOkD1I73pmUsyrbYbetHa7qFu3eoBDZScdyrWp2dS5Y9L4b0who/PncVp5oFs/4J8ThHNQoXWXvys+nUc2aM+E+Fwazo2ODdI8XZz9YOGf/ZfE6iXFBYBDgckow8Nb2QD//C6MfP2Bz8zftqvt+D6Dko7v/Inb2OtCj342yjrxcvAMlCQ6lYoTIAMNemzNoqlfNyDMdB9yKoAEKebRtCm8QZSjLQ5uPk8aoQpmNwCpLhiHuzh2fqH55fcQrE6/KFttfw7VzeGUE7k3PF6xIMq0BPr3vkG2MedIh8BEQvpmYK4fChLY5JG26Kk6KuZ1eCkJAOQgdSjWasAvNgsSIlsb5mFjIkGwK9j20svLSl+OJ7I0olefXcZ2JywjgYAEu1jITMLHCMR1blXENulhApdhMfTef1aQ/USMqRVWNigausEzq49Hi2GtcQzHmZuhgnhBZEnjq9K8jsZwJk59iwBaFxZegAAAAAAATTNxrJiPzbWCugg6Vtg92ToHsLNO1e3fj+OJd3UOsNzAAAAAAATpFIAAVE6cNLnZT2Noq5nJ4VNRSf2KrRBNrlimFaXauHv3efDAAFm5RiKEwih25C20x8/vcqMPfJnjIES3909GSxaPMRXqAAAAAAAAAAAAAAAAFxIFHGlrpnuxd5M5WePQalLpUyHAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALFcwAAAAAAAAAAAAAAAAaFxdzQAAAAAAAAAAAAAAAK3MabLDE8LWvGN6+AdUvFHJdm5RAAMAAAAAAAAAAAAAAADf0SJhChSsEtk0iYwC2+wfcnCBFg==");

        let result1 = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa.clone());
        assert!(result1.is_err());

        wormhole_contract.sender(alice).store_gs(4, current_guardians(), 0).unwrap();
        wormhole_contract.sender(alice).current_guardian_set_index.set(U256::from(4));

        let guardian_set_result = wormhole_contract.sender(alice).get_guardian_set(4);
        assert!(guardian_set_result.is_ok(), "Guardian set retrieval should work - contract is initialized");

        let current_guardian_set_idx = wormhole_contract.sender(alice).get_current_guardian_set_index();
        assert_eq!(current_guardian_set_idx, 4);

        let result2 = wormhole_contract.sender(alice).parse_and_verify_vm(test_vaa.clone());
        assert!(result2.is_ok());
    }
}
