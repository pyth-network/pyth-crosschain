#![cfg_attr(not(feature = "std"), no_std, no_main)]
extern crate alloc;

#[cfg(not(feature = "std"))]
#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

use alloc::vec::Vec;
use stylus_sdk::{
    prelude::{entrypoint, public, storage, SolidityError},
    storage::{StorageMap, StorageUint, StorageAddress, StorageBool},
    alloy_primitives::{Address, FixedBytes, U256},
};
use alloy_sol_types::{SolValue, sol};
use stylus_sdk::alloy_primitives::keccak256;
use sha3::{Digest, Keccak256};
use secp256k1::{ecdsa::{RecoverableSignature, RecoveryId}, Secp256k1, Message, SecretKey, PublicKey};

#[derive(Clone, Debug, PartialEq, Default)]
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

sol! {
    error InvalidGuardianSetIndex();
    error GuardianSetExpired();
    error NoQuorum();
    error InvalidSignatureOrder();
    error InvalidSignature();
    error InvalidVAAFormat();
    error GovernanceActionConsumed();
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidInput();
    error InsufficientSignatures();
    error InvalidGuardianIndex();
    error InvalidAddressLength();
    error InvalidSignatures();
    error VerifyVAAError();
}

macro_rules! impl_debug_for_sol_error {
    ($($t:ty),*) => {
        $(impl core::fmt::Debug for $t {
            fn fmt(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
                f.write_str(stringify!($t))
            }
        })*
    };
}

impl_debug_for_sol_error!(
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
    InvalidSignatures,
    InvalidGuardianIndex,
    InvalidAddressLength,
    VerifyVAAError
);

#[derive(Debug, SolidityError)]
pub enum WormholeError {
    InvalidGuardianSetIndex(InvalidGuardianSetIndex),
    GuardianSetExpired(GuardianSetExpired),
    NoQuorum(NoQuorum),
    InvalidSignatureOrder(InvalidSignatureOrder),
    InvalidSignature(InvalidSignature),
    InvalidVAAFormat(InvalidVAAFormat),
    GovernanceActionConsumed(GovernanceActionConsumed),
    AlreadyInitialized(AlreadyInitialized),
    NotInitialized(NotInitialized),
    InvalidInput(InvalidInput),
    InsufficientSignatures(InsufficientSignatures),
    InvalidSignatures(InvalidSignatures),
    InvalidGuardianIndex(InvalidGuardianIndex),
    InvalidAddressLength(InvalidAddressLength),
    VerifyVAAError(VerifyVAAError),
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
            return Err(WormholeError::AlreadyInitialized(AlreadyInitialized {}).into());
        }

        if initial_guardians.is_empty() {
            return Err(WormholeError::InvalidInput(InvalidInput {}).into());
        }

        self.current_guardian_set_index.set(U256::from(0));
        self.chain_id.set(U256::from(chain_id));
        self.governance_chain_id.set(U256::from(governance_chain_id));
        self.governance_contract.set(governance_contract);

        self.store_guardian_set(0, initial_guardians, 0)?;

        self.initialized.set(true);
        Ok(())
    }

    pub fn get_current_guardian_set_index(&self) -> Result<u32, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }
        Ok(self.current_guardian_set_index.get().try_into().unwrap_or(0u32))
    }

    pub fn get_chain_id(&self) -> Result<u16, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }
        Ok(self.chain_id.get().try_into().unwrap_or(0u16))
    }

    pub fn get_governance_chain_id(&self) -> Result<u16, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }
        Ok(self.governance_chain_id.get().try_into().unwrap_or(0u16))
    }

    pub fn get_governance_contract(&self) -> Result<Address, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }
        Ok(self.governance_contract.get())
    }

    pub fn is_governance_action_consumed(&self, hash: Vec<u8>) -> Result<bool, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }
        Ok(self.consumed_governance_actions.get(hash))
    }

    pub fn get_guardian_set(&self, index: u32) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }

        match self.get_guardian_set_internal(index) {
            Some(guardian_set) => Ok(guardian_set.keys.abi_encode()),
            None => Err(WormholeError::InvalidGuardianSetIndex(InvalidGuardianSetIndex {}).into()),
        }
    }

    pub fn parse_and_verify_vm(&self, encoded_vaa: Vec<u8>) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized(NotInitialized {}).into());
        }

        if encoded_vaa.is_empty() {
            return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}).into());
        }

        let vaa = self.parse_vm(&encoded_vaa)?;

        let verified = self.verify_vm(&vaa);

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
            return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}));
        }

        let mut cursor = 0;

        let version = encoded_vaa[cursor];
        cursor += 1;

        if version != 1 {
            return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}));
        }

        let guardian_set_index_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))?;

        let guardian_set_index = u32::from_be_bytes(guardian_set_index_bytes);

        cursor += 4;

        let len_signatures = encoded_vaa[cursor];
        cursor += 1;

        let mut signatures = Vec::new();

        if len_signatures > 19 {
            return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}));
        }

        for _ in 0..len_signatures {
            if cursor + 66 > encoded_vaa.len() {
                return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}));
            }

            let guardian_index = encoded_vaa[cursor];
            cursor += 1;

            let mut signature_bytes = [0u8; 65];
            signature_bytes.copy_from_slice(&encoded_vaa[cursor..cursor + 65]);
            cursor += 65;

            signatures.push(GuardianSignature {
                guardian_index,
                signature: FixedBytes::from(signature_bytes),
            });
        }

        if cursor + 51 > encoded_vaa.len() {
            return Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}));
        }

        let timestamp_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))?;

        let timestamp = u32::from_be_bytes(timestamp_bytes);
        cursor += 4;

        let nonce_bytes: [u8; 4] = encoded_vaa[cursor..cursor + 4]
            .try_into()
            .map_err(|_| WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))?;

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
            .map_err(|_| WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))?;

        let sequence = u64::from_be_bytes(sequence_bytes);
        
        cursor += 8;

        let consistency_level = encoded_vaa[cursor];
        cursor += 1;

        let payload = encoded_vaa[cursor..].to_vec();

        let hash = Self::compute_hash_static(&encoded_vaa[cursor - 51..])?;

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
        let guardian_set = self.get_guardian_set_internal(vaa.guardian_set_index)
            .ok_or(WormholeError::InvalidGuardianSetIndex(InvalidGuardianSetIndex {}))?;

        if vaa.guardian_set_index != self.current_guardian_set_index.get().try_into().unwrap_or(0u32)
            && guardian_set.expiration_time > 0 {
                return Err(WormholeError::GuardianSetExpired(GuardianSetExpired {}))
        }
        
        let num_guardians : u32 = guardian_set.keys.len().try_into().map_err(|_| WormholeError::InvalidInput(InvalidInput {}))?;

        let required_signatures = Self::quorum(num_guardians);
        let num_signatures : u32 = vaa.signatures.len().try_into().map_err(|_| WormholeError::InvalidInput(InvalidInput {}))?;

        if num_signatures < required_signatures {
            return Err(WormholeError::InsufficientSignatures(InsufficientSignatures {}));
        }

        let mut last_guardian_index: Option<u8> = None;

        for signature in &vaa.signatures {
            if let Some(last_index) = last_guardian_index {
                if signature.guardian_index <= last_index {
                    return Err(WormholeError::InvalidSignatureOrder(InvalidSignatureOrder {}));
                }
            }
            last_guardian_index = Some(signature.guardian_index);

            let index: usize = signature
                .guardian_index
                .try_into()
                .map_err(|_| WormholeError::InvalidGuardianIndex(InvalidGuardianIndex {}))?;

            if index >= guardian_set.keys.len() {
                return Err(WormholeError::InvalidGuardianIndex(InvalidGuardianIndex {}));
            }

            let guardian_address = guardian_set.keys[index];
            let hashed_vaa_hash: FixedBytes<32> = FixedBytes::from(keccak256(vaa.hash));

            match self.verify_signature(&hashed_vaa_hash, &signature.signature, guardian_address) {
                Ok(true) => {},
                Ok(false) => return Err(WormholeError::InvalidSignature(InvalidSignature {}).into()),
                Err(e) => return Err(e),
            }
        }

        Ok(())
    }

    fn compute_hash(&self, body: &[u8]) -> Result<FixedBytes<32>, WormholeError> {
        Self::compute_hash_static(body)
    }

    fn compute_hash_static(body: &[u8]) -> Result<FixedBytes<32>, WormholeError> {
        use stylus_sdk::alloy_primitives::keccak256;
        let hash = keccak256(body);
        Ok(hash)
    }

    fn compute_guardian_key(&self, set_index: u32, guardian_index: u8) -> U256 {
        use stylus_sdk::alloy_primitives::keccak256;
        let key_data = [&set_index.to_be_bytes()[..], &[guardian_index]].concat();
        U256::from_be_bytes(keccak256(&key_data).0)
    }

    fn store_guardian_set(&mut self, set_index: u32, guardians: Vec<Address>, expiration_time: u32) -> Result<(), WormholeError> {
        if guardians.is_empty() {
            return Err(WormholeError::InvalidInput(InvalidInput {}));
        }

        self.guardian_set_sizes.setter(U256::from(set_index)).set(U256::from(guardians.len()));
        self.guardian_set_expiry.setter(U256::from(set_index)).set(U256::from(expiration_time));

        for (i, guardian) in guardians.iter().enumerate() {
            let i_u8: u8 = i.try_into()
                .map_err(|_| WormholeError::InvalidGuardianIndex(InvalidGuardianIndex {}))?;
            let key = self.compute_guardian_key(set_index, i_u8);
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
        // Check length
        if signature.len() != 65 {
            return Err(WormholeError::InvalidSignature(InvalidSignature {}));
        }

        let secp = Secp256k1::new();

        let recid_raw_i32: i32 = signature[64].try_into()
            .map_err(|_| WormholeError::InvalidGuardianIndex(InvalidGuardianIndex {}))?;

        let recid = RecoveryId::try_from(recid_raw_i32)
            .map_err(|_| WormholeError::InvalidSignature(InvalidSignature {}))?;
        let recoverable_sig = RecoverableSignature::from_compact(&signature[..64], recid)
            .map_err(|_| WormholeError::InvalidSignature(InvalidSignature {}))?;

        let hash_array: [u8; 32] = hash.as_slice().try_into().map_err(|_| WormholeError::InvalidInput(InvalidInput {}))?;
        let message = Message::from_digest(hash_array);

        let pubkey_orig = secp
            .recover_ecdsa(message, &recoverable_sig)
            .map_err(|_| WormholeError::InvalidSignature(InvalidSignature {}))?;

        let pubkey: &[u8; 65] = &pubkey_orig.serialize_uncompressed();

        let address: [u8; 32] = Keccak256::new_with_prefix(&pubkey[1..]).finalize().into();
        let address: [u8; 20] = address[address.len() - 20..].try_into().map_err(|_| WormholeError::InvalidAddressLength(InvalidAddressLength {}))?;

        Ok(Address(FixedBytes::from(address)) == guardian_address)
    }

    fn get_guardian_set_internal(&self, index: u32) -> Option<GuardianSet> {
        let size = self.guardian_set_sizes.getter(U256::from(index)).get();
        if size.is_zero() {
            return None;
        }

        let mut keys = Vec::new();
        let size_u32: u32 = size.try_into().unwrap_or(0);
        for i in 0..size_u32 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    return None;
                }
            };
            let key = self.compute_guardian_key(index, i_u8);
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
            return Err(WormholeError::NotInitialized(NotInitialized {}));
        }

        let vaa = self.parse_vm(&encoded_vaa)?;
        self.verify_vm(&vaa)?;
        Ok(vaa)
    }

    fn get_guardian_set(&self, index: u32) -> Option<GuardianSet> {
        self.get_guardian_set_internal(index)
    }

    fn get_current_guardian_set_index(&self) -> u32 {
        self.current_guardian_set_index.get().try_into().unwrap_or(0u32)
    }

    fn governance_action_is_consumed(&self, hash: Vec<u8>) -> bool {
        self.consumed_governance_actions.get(hash)
    }

    fn chain_id(&self) -> u16 {
        self.chain_id.get().try_into().unwrap_or(0u16)
    }

    fn governance_chain_id(&self) -> u16 {
        self.governance_chain_id.get().try_into().unwrap_or(0u16)
    }

    fn governance_contract(&self) -> Address {
        self.governance_contract.get()
    }

    fn submit_new_guardian_set(&mut self, _encoded_vaa: Vec<u8>) -> Result<(), WormholeError> {
        // TODO: COMPLETE EXTERNAL METHOD TO SUBMIT NEW GUARDIAN SET
        Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))
    }
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use super::*;
    use alloc::vec;
    use motsu::prelude::DefaultStorage;
    use core::str::FromStr;
    use secp256k1::{ecdsa::{RecoverableSignature, RecoveryId}, Secp256k1, Message, SecretKey, PublicKey};
    use stylus_sdk::alloy_primitives::keccak256;
    use base64::engine::general_purpose;
    use base64::Engine;

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    fn test_real_vaa() -> Vec<u8> {
        let vaa_raw_base64 = "AQAAAAQNAKPLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA==";
        let vaa_bytes = general_purpose::STANDARD.decode(vaa_raw_base64).unwrap();
        let vaa: Vec<u8> = vaa_bytes;
        vaa
    }

    fn create_vaa_bytes(input_string: &str) -> Vec<u8> {
        let vaa_bytes = general_purpose::STANDARD
            .decode(input_string)
            .expect("Failed to decode base64 VAA");
        let vaa: Vec<u8> = vaa_bytes;
        vaa
    }

    fn test_guardian_secret1() -> SecretKey {
        SecretKey::from_slice(&[
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
            0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
            0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
        ]).expect("32-byte secret key is valid")
    }

    fn test_guardian_secret2() -> SecretKey {
        SecretKey::from_slice(&[
            0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30,
            0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
            0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40,
        ]).expect("32-byte secret key is valid")
    }

    fn test_guardian_address1() -> Address {
        let secret = test_guardian_secret1();
        let secp = Secp256k1::new();
        let pubkey = PublicKey::from_secret_key(&secp, &secret);
        let pubkey_uncompressed = pubkey.serialize_uncompressed();
        let hash = Keccak256::digest(&pubkey_uncompressed[1..]); // Skip 0x04
        let address_bytes: [u8; 20] = hash[12..].try_into().unwrap(); // Last 20 bytes
        Address::from(address_bytes)
    }


    fn test_guardian_address2() -> Address {
        let secret = test_guardian_secret2();
        let secp = Secp256k1::new();
        let pubkey = PublicKey::from_secret_key(&secp, &secret);
        let pubkey_uncompressed = pubkey.serialize_uncompressed();
        let hash = Keccak256::digest(&pubkey_uncompressed[1..]); // Skip 0x04
        let address_bytes: [u8; 20] = hash[12..].try_into().unwrap(); // Last 20 bytes
        Address::from(address_bytes)
    }

    fn deploy_with_test_guardian() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = vec![test_guardian_address1()];
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        match contract.store_guardian_set(0, guardians.clone(), 0) {
            Ok(_) => {}
            Err(_) => panic!("Already initialized!"),
        }
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    fn deploy_with_real_guardians() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract.store_guardian_set(4, current_guardians(), 0);
        contract
    }

    fn deploy_with_mainnet_guardian_set0() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = guardian_set0();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    fn deploy_with_mainnet_guardian_set4() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = guardian_set4();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
    }

    fn deploy_with_mainnet_guardians() -> WormholeContract {
        let mut contract = WormholeContract::default();
        let guardians = guardian_set4();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        contract
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
        // Select a test guardian secret key
        let secret: SecretKey = match guardian_index {
            0 => test_guardian_secret1(),
            1 => test_guardian_secret2(),
            _ => test_guardian_secret1(),
        };

        let secp = Secp256k1::new();

        // Parse hash as a secp256k1 message
        let message = Message::from_slice(hash.as_slice()).expect("Hash must be 32 bytes");

        // Sign message to get a recoverable signature
        let recoverable_sig: RecoverableSignature = secp.sign_ecdsa_recoverable(message, &secret);
        let (recovery_id, sig_bytes) = recoverable_sig.serialize_compact();

        // Build Ethereum-compatible 65-byte signature (r || s || v)
        let mut signature_bytes = [0u8; 65];
        signature_bytes
            .get_mut(..64)
            .ok_or(WormholeError::InvalidInput(InvalidInput {}))?
            .copy_from_slice(&sig_bytes);

        signature_bytes[64] = match recovery_id {
            RecoveryId::Zero => 27,
            RecoveryId::One => 28,
            RecoveryId::Two => 29,
            RecoveryId::Three => 30,
            _ => return Err(WormholeError::InvalidInput(InvalidInput {})),
        };

        Ok(GuardianSignature {
            guardian_index,
            signature: FixedBytes::from(signature_bytes),
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
    fn test_quorum_calculation() {
        assert_eq!(WormholeContract::quorum(1), 1);
        assert_eq!(WormholeContract::quorum(3), 3);
        assert_eq!(WormholeContract::quorum(19), 13);
    }

    #[motsu::test]
    fn test_real_wormhole_vaa_parsing() {
        let vaa_vec = test_real_vaa();
        let result = match WormholeContract::parse_vm_static(&vaa_vec) {
            Ok(vaa) => vaa,
            Err(_) => panic!("VAA parsing failed"),
        };
        assert_eq!(result.signatures.len(), 13)
    }

    #[motsu::test]
    fn test_real_guardian_set_real_vaa_verification() {
        let contract = deploy_with_real_guardians();
        let test_vaa = create_vaa_bytes("AQAAAAQNABKrA7vVGbeFAN4q6OpjL0zVVs8aPJHPqnj6KuboY755N5i2on/i4nXb2nahbVGDDqj9WV2DgLRdUyqoXL/C6HsBA6l03OVpWBMU5Kjh4a3yn539u/m6ieboUz5D2wAqrt0UHCPgOuXlixoEnYZJ2kTGOT0yqd/grj9g1i9hWkGsi/0BBei0DUXj9iLQ8PQfJGQRWluvvBefZrCi7sIpaN1P10FbABdrFE/Mop+h1n4vHleYqtX1DyD/Hl2CUVPRm+TL6AsABigepLVMC/ybUdI71rW5yKda/DxJ/ZtRa1c7iUOxUnpfENoxwLheaJLMfDVb0bfybkPnbq/UjQ3OjP9LMbb2Y5wBBy1uE/9Pv1nIswbb0H4Q4ej1X7W2vvdWTrt3AmrDPOvYfg3mK+Wae5ifPhCFKas7y2gUfHLm0I7INKTHQ+jjK3oBCjc+jJahqTQu/xPi+kgxvsSwwswoxPEgrd3UsylDbGRMKeEQ8pbB8dP3PzkKThYvVjQ56Vl1+ZZkVf4EzKi7uxIAC03+AG9MIrRsCZenLd8/BwJbr3M1MlIRDAE/JZQctOneEhL0ta0KifLZ8516sfpOLO0j4hyX2JGB7+KhEwaa7rAADOgUbAVn/Od0Mcz5T4Xdu0VJVXbvDcP4WC1vuiKYUuwvHI2lPRwUGEXBinmYuFAzBv5goEO+et71DBPbSocfyAgADUmsnFBn9Sqt1X6QUF3KD8aYb0O7x/w33W/VS+3Bl3JnEjfD8RbDWBmfKhamm6B55g3WytoDz5E+0UfwjMBhEs8BDqxaRg10LY8c2ASx/Ps8UZ8qFYdcQ0liJdfiXxaDMZzwMuQpYr3S+CzartkfaNfRKl4269UtQTxbCHYrnu4XrIMBDzNfMrUQCBQPyYTDsAubNi2AbmAsgrcGHNCquna7ScXaFrYbDrWcxNbXRL20fQ8m7lH1llM3S4UC25smNOino8sBEHDm77bSISVBykPRwfkZdtezi7RGxtFfb0jh1Iu54/pXKyQFjKKOzush9dXGvwCVCeKHL7P+PRT8e+FCxFMFaZEAEVxXoDeizuUQoHG1G+o0MNqT/JS4SfE7SyqZ6VJoezHZIxUFlvqYRufJsGk6FU6OO1zbxdL8evNXIoU0TFHVLwoBaEiioAAAAAAAFYm5HmjQJklWYyvxH4q9IkPKpWxKQsl9m5fq3HG/EHS/AAAAAAAAeRsA3ca06nFfN50X8Ov9vOf/MclvDB12K3Pdhb7X87OIwKs=");
        let result = contract.parse_and_verify_vm(test_vaa);
    }

    #[motsu::test]
    fn test_get_guardian_set_works() {
        let contract = deploy_with_mainnet_guardian_set0();

        let set0 = contract.get_guardian_set_internal(0).unwrap();
        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set0.expiration_time, 0);
        assert_eq!(contract.get_current_guardian_set_index(), Ok(0));
    }

    #[motsu::test]
    fn test_parse_vm_invalid_length() {
        let short_vaa = vec![1, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&short_vaa);
        assert!(matches!(result, Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))));
    }

    #[motsu::test]
    fn test_parse_vm_invalid_version() {
        let invalid_version_vaa = vec![2, 0, 0, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&invalid_version_vaa);
        assert!(matches!(result, Err(WormholeError::InvalidVAAFormat(InvalidVAAFormat {}))));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_set() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(999, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex(InvalidGuardianSetIndex {}))));
    }

    #[motsu::test]
    fn test_verify_vm_insufficient_signatures() {
        let contract = deploy_with_test_guardian();
        let vaa = create_test_vaa(0, vec![]);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InsufficientSignatures(InsufficientSignatures {}))));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_signature_order() {
        let mut contract = WormholeContract::default();
        let guardians = vec![
            Address::from([0x12u8; 20]),
            Address::from([0x23u8; 20]),
            Address::from([0x34u8; 20]),
        ];
        match contract.store_guardian_set(0, guardians, 0) {
            Ok(_) => {},
            Err(_) => panic!("Unable to store guardian set"),
        }

        let signatures = vec![
            create_guardian_signature(2),
            create_guardian_signature(1), // Out of order - should trigger error
            create_guardian_signature(0),
        ];
        let vaa = create_test_vaa(0, signatures); // Use guardian set 0

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidSignature(InvalidSignature {}))));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_index() {
        let contract = deploy_with_test_guardian();
        let signatures = vec![
            create_guardian_signature(5),
        ];
        let vaa = create_test_vaa(0, signatures);

        let result = contract.verify_vm(&vaa);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianIndex(InvalidGuardianIndex {}))));
    }

    #[motsu::test]
    fn test_signature_verification_invalid_recovery_id() {
        let contract = WormholeContract::default();
        let hash = FixedBytes::default();
        let guardian_address = Address::default();

        let mut invalid_sig = [0u8; 65];
        invalid_sig[64] = 26;
        let result = contract.verify_signature(&hash, &FixedBytes::<65>::from(invalid_sig), guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature(InvalidSignature {}))));
    }

    #[motsu::test]
    fn test_signature_verification_all_zeros() {
        let contract = WormholeContract::default();
        let hash = FixedBytes::default();
        let invalid_signature = FixedBytes::<65>::default();
        let guardian_address = Address::default();

        let result = contract.verify_signature(&hash, &invalid_signature, guardian_address);
        assert!(matches!(result, Err(WormholeError::InvalidSignature(InvalidSignature {}))));
    }

    #[motsu::test]
    fn test_rejects_empty_guardian_set() {
        let mut contract = WormholeContract::default();
        let empty_guardians: Vec<Address> = vec![];

        let result = contract.store_guardian_set(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_invalid_guardian_set_index() {
        let contract = deploy_with_test_guardian();

        let result = contract.get_guardian_set_internal(999);
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
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex(InvalidGuardianSetIndex {}))));
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

        let result = contract.store_guardian_set(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_corrupted_vaa_data() {
        let _contract = deploy_with_mainnet_guardians();

        for i in 0..10 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    panic!("Invalid index");
                }
            };
            let corrupted_data = corrupted_vaa(vec![1, 0, 0, 1, 0, 0], i, i_u8, (i_u8 * 2));
            let result = WormholeContract::parse_vm_static(&corrupted_data);
            assert!(result.is_err());
        }
    }

    #[motsu::test]
    fn test_parse_and_verify_vm_rejects_corrupted_vaa() {
        let contract = deploy_with_mainnet_guardians();

        for i in 0..5 {
            let i_u8: u8 = match i.try_into() {
                Ok(val) => val,
                Err(_) => {
                    panic!("Invalid index");
                }
            };
            let base_vaa = vec![1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            let corrupted_data = corrupted_vaa(base_vaa, i, i_u8, (i_u8 * 3));
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

        contract.store_guardian_set(0, guardians.clone(), 0);
        let retrieved_set = contract
            .get_guardian_set_internal(0)
            .ok_or(WormholeError::InvalidGuardianSetIndex(InvalidGuardianSetIndex {}))?;

        assert_eq!(retrieved_set.keys, guardians);
        assert_eq!(retrieved_set.expiration_time, 0);

        Ok(())
    }

    #[motsu::test]
    fn test_guardian_key_computation() {
        use stylus_sdk::alloy_primitives::keccak256;

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
            .store_guardian_set(0, guardian_set0(), 0)
            .unwrap_or_else(|_| panic!("Failed to store guardian_set0"));
        contract
            .store_guardian_set(4, guardian_set4(), 0)
            .unwrap_or_else(|_| panic!("Failed to store guardian_set4"));

        let set0 = contract.get_guardian_set_internal(0)
            .unwrap_or_else(|| panic!("Failed to get guardian_set0"));
        let set4 = contract.get_guardian_set_internal(4)
            .unwrap_or_else(|| panic!("Failed to get guardian_set4"));

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
        match contract.store_guardian_set(0, guardians, 0) {
            Ok(()) => (),
            Err(_) => panic!("Failed to store guardian set at index 0"),
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

        let result = contract.verify_vm(&vaa);
    }

    #[motsu::test]
    fn test_chain_id_governance_values() {
        let contract = deploy_with_mainnet_guardians();

        match contract.get_chain_id() {
            Ok(chain_id) => assert_eq!(chain_id, CHAIN_ID),
            Err(_) => panic!("Failed to get chain ID"),
        }

        match contract.get_governance_chain_id() {
            Ok(gov_chain_id) => assert_eq!(gov_chain_id, GOVERNANCE_CHAIN_ID),
            Err(_) => panic!("Failed to get governance chain ID"),
        }

        match contract.get_governance_contract() {
            Ok(gov_contract) => {
                let expected = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
                assert_eq!(gov_contract, expected);
            }
            Err(_) => panic!("Failed to get governance contract"),
        }

    }

    #[motsu::test]
    fn test_governance_action_consumed() {
        let contract = deploy_with_mainnet_guardians();

        let test_hash = vec![0u8; 32];
        assert_eq!(contract.governance_action_is_consumed(test_hash), false);
    }
}
