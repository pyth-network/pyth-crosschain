#![cfg_attr(not(any(feature = "std", feature = "export-abi")), no_std)]
extern crate alloc;

#[cfg(not(any(feature = "std", feature = "export-abi")))]
#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;



mod types;
use types::{GuardianSet, GuardianSignature, VerifiedVM, WormholeError};

use alloc::{vec, vec::Vec};
use stylus_sdk::{
    prelude::{entrypoint, public, sol_storage, MessageAccess, MemoryAccess, CalldataAccess, StorageAccess, HostAccess, StorageType},
    alloy_primitives::{Address, FixedBytes, U256, keccak256},
};

use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

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

sol_storage! {
    #[entrypoint]
    pub struct WormholeContract {
        uint256 current_guardian_set_index;
        uint256 chain_id;
        uint256 governance_chain_id;
        address governance_contract;
        mapping(bytes => bool) consumed_governance_actions;
        bool initialized;
        mapping(uint256 => uint256) guardian_set_sizes;
        mapping(uint256 => uint256) guardian_set_expiry;
        mapping(uint256 => address) guardian_keys;
    }
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

        self.current_guardian_set_index.set(U256::from(4));
        self.chain_id.set(U256::from(chain_id));
        self.governance_chain_id.set(U256::from(governance_chain_id));
        self.governance_contract.set(governance_contract);

        self.store_gs(4, initial_guardians, 0)?;

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
            },
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

        Ok(VerifiedVM {
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

    fn verify_vm(&self, vaa: &VerifiedVM) -> Result<(), WormholeError> {

        let guardian_set = self.get_gs_internal(vaa.guardian_set_index)?;
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
#[cfg(test)] mod tests;
