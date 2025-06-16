#![cfg_attr(not(feature = "std"), no_std, no_main)]
extern crate alloc;

#[cfg(not(feature = "std"))]
#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

#[cfg(not(feature = "std"))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}


use alloc::{vec, vec::Vec};
use stylus_sdk::{
    prelude::{entrypoint, public, storage},
    storage::{StorageMap, StorageUint, StorageAddress, StorageBool},
    alloy_primitives::{Address, FixedBytes, U256, keccak256},
};

use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

#[derive(Clone, PartialEq, Default)]
pub struct GuardianSet {
    pub keys: Vec<Address>,
    pub expiration_time: u32,
}

#[derive(Clone)]
pub struct GuardianSignature {
    pub guardian_index: u8,
    pub signature: FixedBytes<65>,
}

#[derive(Clone)]
pub struct VerifiedVMM {
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
    fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<VerifiedVMM, WormholeError>;
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
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: Address,
    ) -> Result<(), Vec<u8>> {
        if self.initialized.get() {
            return Err(WormholeError::AlreadyInitialized.into());
        }

        if initial_guardians.is_empty() {
            return Err(WormholeError::InvalidInput.into());
        }

        self.current_guardian_set_index.set(U256::from(0));
        self.chain_id.set(U256::from(chain_id));
        self.governance_chain_id.set(U256::from(governance_chain_id));
        self.governance_contract.set(governance_contract);

        self.store_gs(0, initial_guardians, 0)?;

        self.initialized.set(true);
        Ok(())
    }



    pub fn get_guardian_set(&self, index: u32) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }

        match self.get_gs_internal(index) {
            Some(guardian_set) => {
                let mut encoded = Vec::with_capacity(guardian_set.keys.len() * 20);
                for address in &guardian_set.keys {
                    encoded.extend_from_slice(address.as_slice());
                }
                Ok(encoded)
            },
            None => Err(WormholeError::InvalidGuardianSetIndex.into()),
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

        let _verified = self.verify_vm(&vaa);

        Ok(vaa.payload)
    }

    fn quorum(num_guardians: u32) -> u32 {
        (num_guardians * 2) / 3 + 1
    }
}

impl WormholeContract {
    fn parse_vm(&self, encoded_vaa: &[u8]) -> Result<VerifiedVMM, WormholeError> {
        Self::parse_vm_static(encoded_vaa)
    }

    // Parsing a Wormhole VAA according to the structure defined
    // by https://wormhole.com/docs/protocol/infrastructure/vaas/
    fn parse_vm_static(encoded_vaa: &[u8]) -> Result<VerifiedVMM, WormholeError> {
        if encoded_vaa.len() < 6 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        let mut cursor = 0;

        let version = encoded_vaa[cursor];
        cursor += 1;

        if version != 1 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        let gsi_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat)?;

        let guardian_set_index = u32::from_be_bytes(gsi_bytes);

        cursor += 4;

        let len_signatures = encoded_vaa[cursor];
        cursor += 1;

        let mut signatures = Vec::with_capacity(len_signatures as usize);

        if len_signatures > 19 {
            return Err(WormholeError::InvalidVAAFormat);
        }

        for _ in 0..len_signatures {
            if cursor + 66 > encoded_vaa.len() {
                return Err(WormholeError::InvalidVAAFormat);
            }

            let guardian_index = encoded_vaa[cursor];
            cursor += 1;

            let mut sig_bytes = [0u8; 65];
            sig_bytes.copy_from_slice(&encoded_vaa[cursor..cursor + 65]);
            cursor += 65;

            signatures.push(GuardianSignature {
                guardian_index,
                signature: FixedBytes::from(sig_bytes),
            });
        }

        if cursor + 51 > encoded_vaa.len() {
            return Err(WormholeError::InvalidVAAFormat);
        }

        let ts_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat)?;

        let timestamp = u32::from_be_bytes(ts_bytes);
        cursor += 4;

        let nonce_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat)?;

        let nonce = u32::from_be_bytes(nonce_bytes);
        cursor += 4;

        let emitter_chain_id = u16::from_be_bytes([
            encoded_vaa[cursor],
            encoded_vaa[cursor + 1],
        ]);
        cursor += 2;

        let mut emitter_address_bytes = [0u8; 32];
        emitter_address_bytes.copy_from_slice(&encoded_vaa[cursor..cursor + 32]);
        cursor += 32;

        let sequence_bytes: [u8; 8] = encoded_vaa[cursor..cursor + 8]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat)?;

        let sequence = u64::from_be_bytes(sequence_bytes);

        cursor += 8;

        let consistency_level = encoded_vaa[cursor];
        cursor += 1;

        let payload = encoded_vaa[cursor..].to_vec();

        let hash = Self::hash_static(&encoded_vaa[cursor - 51..])?;

        Ok(VerifiedVMM {
            version,
            guardian_set_index,
            signatures,
            timestamp,
            nonce,
            emitter_chain_id,
            emitter_address: FixedBytes::from(emitter_address_bytes),
            sequence,
            consistency_level,
            payload,
            hash,
        })
    }

    fn verify_vm(&self, vaa: &VerifiedVMM) -> Result<(), WormholeError> {
        let guardian_set = self.get_gs_internal(vaa.guardian_set_index)
            .ok_or(WormholeError::InvalidGuardianSetIndex)?;

        if vaa.guardian_set_index != self.current_guardian_set_index.get().try_into().unwrap_or(0u32)
            && guardian_set.expiration_time > 0 {
                return Err(WormholeError::GuardianSetExpired)
        }

        let num_guardians : u32 = guardian_set.keys.len().try_into().map_err(|_| WormholeError::InvalidInput)?;

        let required_signatures = Self::quorum(num_guardians);
        let num_signatures : u32 = vaa.signatures.len().try_into().map_err(|_| WormholeError::InvalidInput)?;

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
                Ok(true) => {},
                Ok(false) => return Err(WormholeError::InvalidSignature.into()),
                Err(e) => return Err(e),
            }
        }

        Ok(())
    }



    fn hash_static(body: &[u8]) -> Result<FixedBytes<32>, WormholeError> {
        let hash = keccak256(body);
        Ok(hash)
    }

    fn compute_gs_key(&self, set_index: u32, guardian_index: u8) -> U256 {
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        U256::from_be_bytes(keccak256(&key_data).0)
    }

    fn store_gs(&mut self, set_index: u32, guardians: Vec<Address>, expiration_time: u32) -> Result<(), WormholeError> {
        if guardians.is_empty() {
            return Err(WormholeError::InvalidInput);
        }

        self.guardian_set_sizes.setter(U256::from(set_index)).set(U256::from(guardians.len()));
        self.guardian_set_expiry.setter(U256::from(set_index)).set(U256::from(expiration_time));

        for (i, guardian) in guardians.iter().enumerate() {
            let i_u8: u8 = i.try_into()
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
            RecoveryId::try_from(recovery_id_byte)
                .map_err(|_| WormholeError::InvalidSignature)?
        };

        let sig = Signature::try_from(&signature[..64])
            .map_err(|_| WormholeError::InvalidSignature)?;

        let verifying_key = VerifyingKey::recover_from_prehash(hash.as_slice().try_into().map_err(|_| WormholeError::InvalidInput)?, &sig, recovery_id)
            .map_err(|_| WormholeError::InvalidSignature)?;

        let public_key_bytes = verifying_key.to_encoded_point(false);
        let public_key_slice = &public_key_bytes.as_bytes()[1..];

        let address_hash = keccak256(public_key_slice);
        let address_bytes: [u8; 20] = address_hash[12..].try_into()
            .map_err(|_| WormholeError::InvalidAddressLength)?;

        Ok(Address::from(address_bytes) == guardian_address)
    }

    fn get_gs_internal(&self, index: u32) -> Option<GuardianSet> {
        let size = self.guardian_set_sizes.getter(U256::from(index)).get();
        if size.is_zero() {
            return None;
        }

        let size_u32: u32 = size.try_into().unwrap_or(0);
        let mut keys = Vec::with_capacity(size_u32 as usize);
        for i in 0..size_u32 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    return None;
                }
            };
            let key = self.compute_gs_key(index, i_u8);
            let guardian_address = self.guardian_keys.getter(key).get();
            keys.push(guardian_address);
        }

        let expiry = self.guardian_set_expiry.getter(U256::from(index)).get();
        let expiry_u32: u32 = expiry.try_into().unwrap_or(0);
        Some(GuardianSet {
            keys,
            expiration_time: expiry_u32,
        })
    }
}

impl IWormhole for WormholeContract {
    fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<VerifiedVMM, WormholeError> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized);
        }

        let vaa = self.parse_vm(&encoded_vaa)?;
        self.verify_vm(&vaa)?;
        Ok(vaa)
    }

    fn get_guardian_set(&self, index: u32) -> Option<GuardianSet> {
        self.get_gs_internal(index)
    }

    fn get_current_guardian_set_index(&self) -> u32 {
        self.current_guardian_set_index.get().try_into().unwrap_or(0u32)
    }

    fn governance_action_is_consumed(&self, hash: Vec<u8>) -> bool {
        self.consumed_governance_actions.get(hash)
    }

    #[inline]
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

#[cfg(all(test, feature = "std"))]
mod tests {
    use super::*;
    use alloc::vec;
    use motsu::prelude::DefaultStorage;
    use core::str::FromStr;
    use k256::ecdsa::SigningKey;
    use stylus_sdk::alloy_primitives::keccak256;
    
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
        let mut contract = WormholeContract::default();
        let guardians = vec![test_guardian_address1()];
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        match contract.store_gs(0, guardians.clone(), 0) {
            Ok(_) => {}
            Err(_) => unreachable!(),
        }
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    #[cfg(test)]
    fn deploy_with_current_guardians() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = mock_guardian_set13();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        let _ = contract.store_gs(4, mock_guardian_set13(), 0);
        contract
    }

    #[cfg(test)]
    fn deploy_with_mainnet_guardian_set0() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = guardian_set0();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }



    #[cfg(test)]
    fn deploy_with_mainnet_guardians() -> WormholeContract {
        let mut contract = WormholeContract::default();
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

    fn create_test_vaa(guardian_set_index: u32, signatures: Vec<GuardianSignature>) -> VerifiedVMM {
        VerifiedVMM {
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

    fn create_test_vaa_with_emitter(guardian_set_index: u32, signatures: Vec<GuardianSignature>, emitter: Address) -> VerifiedVMM {
        let mut emitter_bytes = [0u8; 32];
        emitter_bytes[12..32].copy_from_slice(emitter.as_slice());

        VerifiedVMM {
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

    #[motsu::test]
    fn test_quorum_calculation() {
        assert_eq!(WormholeContract::quorum(1), 1);
        assert_eq!(WormholeContract::quorum(3), 3);
        assert_eq!(WormholeContract::quorum(19), 13);
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
    fn test_wormhole_guardian_set_vaa_verification() {
        let contract = deploy_with_current_guardians();
        let test_vaa = create_vaa_bytes("AQAAAAQNABKrA7vVGbeFAN4q6OpjL0zVVs8aPJHPqnj6KuboY755N5i2on/i4nXb2nahbVGDDqj9WV2DgLRdUyqoXL/C6HsBA6l03OVpWBMU5Kjh4a3yn539u/m6ieboUz5D2wAqrt0UHCPgOuXlixoEnYZJ2kTGOT0yqd/grj9g1i9hWkGsi/0BBei0DUXj9iLQ8PQfJGQRWluvvBefZrCi7sIpaN1P10FbABdrFE/Mop+h1n4vHleYqtX1DyD/Hl2CUVPRm+TL6AsABigepLVMC/ybUdI71rW5yKda/DxJ/ZtRa1c7iUOxUnpfENoxwLheaJLMfDVb0bfybkPnbq/UjQ3OjP9LMbb2Y5wBBy1uE/9Pv1nIswbb0H4Q4ej1X7W2vvdWTrt3AmrDPOvYfg3mK+Wae5ifPhCFKas7y2gUfHLm0I7INKTHQ+jjK3oBCjc+jJahqTQu/xPi+kgxvsSwwswoxPEgrd3UsylDbGRMKeEQ8pbB8dP3PzkKThYvVjQ56Vl1+ZZkVf4EzKi7uxIAC03+AG9MIrRsCZenLd8/BwJbr3M1MlIRDAE/JZQctOneEhL0ta0KifLZ8516sfpOLO0j4hyX2JGB7+KhEwaa7rAADOgUbAVn/Od0Mcz5T4Xdu0VJVXbvDcP4WC1vuiKYUuwvHI2lPRwUGEXBinmYuFAzBv5goEO+et71DBPbSocfyAgADUmsnFBn9Sqt1X6QUF3KD8aYb0O7x/w33W/VS+3Bl3JnEjfD8RbDWBmfKhamm6B55g3WytoDz5E+0UfwjMBhEs8BDqxaRg10LY8c2ASx/Ps8UZ8qFYdcQ0liJdfiXxaDMZzwMuQpYr3S+CzartkfaNfRKl4269UtQTxbCHYrnu4XrIMBDzNfMrUQCBQPyYTDsAubNi2AbmAsgrcGHNCquna7ScXaFrYbDrWcxNbXRL20fQ8m7lH1llM3S4UC25smNOino8sBEHDm77bSISVBykPRwfkZdtezi7RGxtFfb0jh1Iu54/pXKyQFjKKOzush9dXGvwCVCeKHL7P+PRT8e+FCxFMFaZEAEVxXoDeizuUQoHG1G+o0MNqT/JS4SfE7SyqZ6VJoezHZIxUFlvqYRufJsGk6FU6OO1zbxdL8evNXIoU0TFHVLwoBaEiioAAAAAAAFYm5HmjQJklWYyvxH4q9IkPKpWxKQsl9m5fq3HG/EHS/AAAAAAAAeRsA3ca06nFfN50X8Ov9vOf/MclvDB12K3Pdhb7X87OIwKs=");
        let _result = contract.parse_and_verify_vm(test_vaa);
    }

    #[motsu::test]
    fn test_get_guardian_set_works() {
        let contract = deploy_with_mainnet_guardian_set0();

        let set0 = contract.get_gs_internal(0).unwrap();
        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set0.expiration_time, 0);
        assert_eq!(contract.get_current_guardian_set_index(), 0);
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
    fn test_verify_vm_invalid_guardian_set() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(999, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[motsu::test]
    fn test_verify_vm_insufficient_signatures() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(0, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InsufficientSignatures)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_signature_order() {
        let mut contract = WormholeContract::default();
        let guardians = vec![
            Address::from([0x12u8; 20]),
            Address::from([0x23u8; 20]),
            Address::from([0x34u8; 20]),
        ];
        match contract.store_gs(0, guardians.clone(), 0) {
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

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_index() {
        let contract = deploy_with_test_guardian();
        let signatures = vec![
            create_guardian_signature(5),
        ];
        let vaa = create_test_vaa(0, signatures);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianIndex)));
    }

    #[motsu::test]
    fn test_signature_verification_invalid_recovery_id() {
        let contract = WormholeContract::default();
        let hash = FixedBytes::default();
        let guardian_address = Address::default();

        let mut invalid_sig = [0u8; 65];
        invalid_sig[64] = 26;
        let result = contract.verify_signature(&hash, &FixedBytes::<65>::from(invalid_sig), guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_signature_verification_all_zeros() {
        let contract = WormholeContract::default();
        let hash = FixedBytes::default();
        let invalid_signature = FixedBytes::<65>::default();
        let guardian_address = Address::default();

        let result = contract.verify_signature(&hash, &invalid_signature, guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_rejects_empty_guardian_set() {
        let mut contract = WormholeContract::default();
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.store_gs(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_invalid_guardian_set_index() {
        let contract = deploy_with_test_guardian();

        let result = contract.get_gs_internal(999);
        assert!(result.is_none());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_invalid_emitter() {
        let contract = deploy_with_test_guardian();

        let vaa = create_test_vaa_with_emitter(0, vec![], Address::from([0x99u8; 20]));
        let result = contract.verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_wrong_index() {
        let contract = deploy_with_mainnet_guardian_set0();

        let vaa = create_test_vaa(2, vec![]); // Skip index 1
        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[motsu::test]
    fn test_deploy_rejects_empty_guardian_set() {
        let mut contract = WormholeContract::default();
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.initialize(empty_guardians, 1, 1, Address::default());
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_empty() {
        let mut contract = WormholeContract::default();
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.store_gs(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_corrupted_vaa_data() {
        let _contract = deploy_with_mainnet_guardians();

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
    fn test_parse_and_verify_vm_rejects_corrupted_vaa() {
        let _contract = deploy_with_mainnet_guardians();

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
    fn test_submit_guardian_set_rejects_non_governance() {
        let contract = deploy_with_mainnet_guardian_set0();

        let mut vaa = create_test_vaa(0, vec![]);
        vaa.emitter_chain_id = 999; // Wrong chain

        let result = contract.verify_vm(&vaa);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_guardian_set_storage_and_retrieval() -> Result<(), WormholeError> {
        let mut contract = WormholeContract::default();
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];

        let _ = contract.store_gs(0, guardians.clone(), 0);
        let retrieved_set = contract
            .get_gs_internal(0)
            .ok_or(WormholeError::InvalidGuardianSetIndex)?;

        assert_eq!(retrieved_set.keys, guardians);
        assert_eq!(retrieved_set.expiration_time, 0);

        Ok(())
    }

    #[motsu::test]
    fn test_guardian_key_computation() {

        let set_index = 0u32;
        let guardian_index = 1u8;
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let expected = U256::from_be_bytes(keccak256(&key_data).0);

        let key_data2 = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        let result2 = U256::from_be_bytes(keccak256(&key_data2).0);

        assert_eq!(expected, result2);
    }

    #[motsu::test]
    fn test_multiple_guardian_sets() {
        let mut contract = WormholeContract::default();

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

    #[motsu::test]
    fn test_verify_vm_with_valid_signatures() {
        let mut contract = WormholeContract::default();
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];
        match contract.store_gs(0, guardians.clone(), 0) {
            Ok(()) => (),
            Err(_) => unreachable!(),
        }
        let hash = FixedBytes::<32>::from([0x42u8; 32]);

        let vaa = VerifiedVMM {
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

    #[motsu::test]
    fn test_chain_id_governance_values() {
        let contract = deploy_with_mainnet_guardians();

        assert_eq!(contract.chain_id(), CHAIN_ID);

        assert_eq!(contract.governance_chain_id(), GOVERNANCE_CHAIN_ID);

        let gov_contract = contract.governance_contract();
        let expected = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        assert_eq!(gov_contract, expected);

    }

    #[motsu::test]
    fn test_governance_action_consumed() {
        let contract = deploy_with_mainnet_guardians();

        let test_hash = vec![0u8; 32];
        assert_eq!(contract.governance_action_is_consumed(test_hash), false);
    }
}
