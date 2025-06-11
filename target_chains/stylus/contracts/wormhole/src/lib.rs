#![cfg_attr(not(feature = "std"), no_std, no_main)]
extern crate alloc;

#[cfg(not(feature = "std"))]
#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

// #[cfg(all(not(feature = "std"), not(test)))]
// #[panic_handler]
// fn panic(_info: &core::panic::PanicInfo) -> ! {
//     loop {}
// }

use alloc::vec::Vec;
use stylus_sdk::{
    prelude::{entrypoint, public, storage},
    storage::{StorageMap, StorageUint, StorageAddress, StorageBool},
    alloy_primitives::{Address, FixedBytes, U256},
};
use alloy_sol_types::SolValue;
use stylus_sdk::alloy_primitives::keccak256;
use sha3::{Digest, Keccak256};
use secp256k1::{ecdsa::{RecoverableSignature, RecoveryId}, Secp256k1, Message, SecretKey, PublicKey};

pub mod governance;

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

#[derive(Debug, Clone)]
pub enum WormholeError {
    InvalidGuardianSetIndex,
    GuardianSetExpired,
    NoQuorum,
    InvalidSignatureOrder,
    InvalidSignature,
    InvalidVMFormat,
    GovernanceActionConsumed,
    AlreadyInitialized,
    NotInitialized,
    InvalidAddressLength,
    VerfiyVMError,
    InvalidInput,
    InsufficientSignatures,
    InvalidGuardianIndex,
    InvalidModule,
    InvalidAction,
    InvalidChainId,
    TrailingData,
    NotCurrentGuardianSet,
    GuardianSetError,
    WrongChain,
    WrongContract,
}

impl From<WormholeError> for Vec<u8> {
    fn from(error: WormholeError) -> Self {
        match error {
            WormholeError::InvalidGuardianSetIndex => b"Invalid guardian set index".to_vec(),
            WormholeError::GuardianSetExpired => b"Guardian set expired".to_vec(),
            WormholeError::NoQuorum => b"No quorum".to_vec(),
            WormholeError::InvalidSignatureOrder => b"Invalid signature order".to_vec(),
            WormholeError::InvalidAddressLength => b"Invalid address length".to_vec(),
            WormholeError::InvalidSignature => b"Invalid signature".to_vec(),
            WormholeError::InvalidVMFormat => b"Invalid VM format".to_vec(),
            WormholeError::GovernanceActionConsumed => b"Governance action consumed".to_vec(),
            WormholeError::AlreadyInitialized => b"Already initialized".to_vec(),
            WormholeError::NotInitialized => b"Not initialized".to_vec(),
            WormholeError::InvalidInput => b"Invalid input".to_vec(),
            WormholeError::InsufficientSignatures => b"Insufficient signatures".to_vec(),
            WormholeError::InvalidGuardianIndex => b"Invalid guardian index".to_vec(),
            WormholeError::VerfiyVMError => b"Unable to verify signature".to_vec(),
            WormholeError::GuardianSetError => b"Issue with getting guardian set and setting internal".to_vec(),
            WormholeError::InvalidModule => b"Invalid module".to_vec(),
            WormholeError::InvalidAction => b"Invalid action".to_vec(),
            WormholeError::InvalidChainId => b"Invalid chain ID".to_vec(),
            WormholeError::TrailingData => b"Trailing data".to_vec(),
            WormholeError::NotCurrentGuardianSet => b"Not signed by current guardian".to_vec(),
            WormholeError::WrongChain => b"Wrong governance chain".to_vec(),
            WormholeError::WrongContract => b"Wrong governance contract".to_vec(),

        }
    }
}

pub trait IWormhole {
    fn parse_and_verify_vm(&self, encoded_vm: Vec<u8>) -> Result<VerifiedVM, WormholeError>;
    fn get_guardian_set(&self, index: u32) -> Option<GuardianSet>;
    fn get_current_guardian_set_index(&self) -> u32;
    fn governance_action_is_consumed(&self, hash: Vec<u8>) -> bool;
    fn chain_id(&self) -> u16;
    fn governance_chain_id(&self) -> u16;
    fn governance_contract(&self) -> Address;
    fn submit_new_guardian_set(&mut self, encoded_vm: Vec<u8>) -> Result<(), WormholeError>;
}

#[entrypoint]
#[storage]
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

        self.current_guardian_set_index.set(U256::from(0u32));
        self.chain_id.set(U256::from(chain_id));
        self.governance_chain_id.set(U256::from(governance_chain_id));
        self.governance_contract.set(governance_contract);

        self.store_guardian_set(0, initial_guardians.clone(), 0)?;
        self.store_guardian_set(4, initial_guardians.clone(), 0)?;

        self.initialized.set(true);
        Ok(())
    }

    pub fn get_current_guardian_set_index(&self) -> Result<u32, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }
        Ok(self.current_guardian_set_index.get().try_into().unwrap_or(0u32))
    }

    pub fn get_chain_id(&self) -> Result<u16, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }
        Ok(self.chain_id.get().try_into().unwrap_or(0u16))
    }

    pub fn get_governance_chain_id(&self) -> Result<u16, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }
        Ok(self.governance_chain_id.get().try_into().unwrap_or(0u16))
    }

    pub fn get_governance_contract(&self) -> Result<Address, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }
        Ok(self.governance_contract.get())
    }

    pub fn is_governance_action_consumed(&self, hash: Vec<u8>) -> Result<bool, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }
        Ok(self.consumed_governance_actions.get(hash))
    }

    pub fn get_guardian_set(&self, index: u32) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }

        match self.get_guardian_set_internal(index) {
            Some(guardian_set) => Ok(guardian_set.keys.abi_encode()),
            None => Err(WormholeError::InvalidGuardianSetIndex.into()),
        }
    }

    pub fn parse_and_verify_vm(&self, encoded_vm: Vec<u8>) -> Result<Vec<u8>, Vec<u8>> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized.into());
        }

        if encoded_vm.is_empty() {
            return Err(WormholeError::InvalidVMFormat.into());
        }

        let vm = self.parse_vm(&encoded_vm)?;

        let verified = self.verify_vm(&vm);

        Ok(vm.payload)
    }

    fn quorum(num_guardians: u32) -> u32 {
        (num_guardians * 2) / 3 + 1
    }
}

impl WormholeContract {
    fn parse_vm(&self, encoded_vm: &[u8]) -> Result<VerifiedVM, WormholeError> {
        Self::parse_vm_static(encoded_vm)
    }

    fn parse_vm_static(encoded_vm: &[u8]) -> Result<VerifiedVM, WormholeError> {
        if encoded_vm.len() < 6 {
            return Err(WormholeError::InvalidVMFormat);
        }

        let mut cursor = 0;

        let version = encoded_vm[cursor];
        cursor += 1;

        if version != 1 {
            return Err(WormholeError::InvalidVMFormat);
        }

        let guardian_set_index = u32::from_be_bytes([
            encoded_vm[cursor],
            encoded_vm[cursor + 1],
            encoded_vm[cursor + 2],
            encoded_vm[cursor + 3],
        ]);
        cursor += 4;

        let len_signatures = encoded_vm[cursor];
        cursor += 1;

        let mut signatures = Vec::new();
        for _ in 0..len_signatures {
            if cursor + 66 > encoded_vm.len() {
                return Err(WormholeError::InvalidVMFormat);
            }

            let guardian_index = encoded_vm[cursor];
            cursor += 1;

            let mut signature_bytes = [0u8; 65];
            signature_bytes.copy_from_slice(&encoded_vm[cursor..cursor + 65]);
            cursor += 65;

            signatures.push(GuardianSignature {
                guardian_index,
                signature: FixedBytes::from(signature_bytes),
            });
        }

        if cursor + 51 > encoded_vm.len() {
            return Err(WormholeError::InvalidVMFormat);
        }

        let timestamp = u32::from_be_bytes([
            encoded_vm[cursor],
            encoded_vm[cursor + 1],
            encoded_vm[cursor + 2],
            encoded_vm[cursor + 3],
        ]);
        cursor += 4;

        let nonce = u32::from_be_bytes([
            encoded_vm[cursor],
            encoded_vm[cursor + 1],
            encoded_vm[cursor + 2],
            encoded_vm[cursor + 3],
        ]);
        cursor += 4;

        let emitter_chain_id = u16::from_be_bytes([
            encoded_vm[cursor],
            encoded_vm[cursor + 1],
        ]);
        cursor += 2;

        let mut emitter_address_bytes = [0u8; 32];
        emitter_address_bytes.copy_from_slice(&encoded_vm[cursor..cursor + 32]);
        cursor += 32;

        let sequence = u64::from_be_bytes([
            encoded_vm[cursor],
            encoded_vm[cursor + 1],
            encoded_vm[cursor + 2],
            encoded_vm[cursor + 3],
            encoded_vm[cursor + 4],
            encoded_vm[cursor + 5],
            encoded_vm[cursor + 6],
            encoded_vm[cursor + 7],
        ]);
        cursor += 8;

        let consistency_level = encoded_vm[cursor];
        cursor += 1;

        let payload = encoded_vm[cursor..].to_vec();

        let hash = Self::compute_hash_static(&encoded_vm[cursor - 51..])?;

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

    fn verify_vm(&self, vm: &VerifiedVM) -> Result<(), WormholeError> {
        let guardian_set = self.get_guardian_set_internal(vm.guardian_set_index)
            .ok_or(WormholeError::InvalidGuardianSetIndex)?;

        if vm.guardian_set_index != self.current_guardian_set_index.get().try_into().unwrap_or(0u32)
            && guardian_set.expiration_time > 0 {
                return Err(WormholeError::GuardianSetExpired)
        }

        let required_signatures = Self::quorum(guardian_set.keys.len() as u32);

        if vm.signatures.len() < required_signatures as usize {
            return Err(WormholeError::InsufficientSignatures);
        }

        let mut last_guardian_index: Option<u8> = None;

        for signature in &vm.signatures {
            if let Some(last_index) = last_guardian_index {
                if signature.guardian_index <= last_index {
                    return Err(WormholeError::InvalidSignatureOrder);
                }
            }
            last_guardian_index = Some(signature.guardian_index);

            if signature.guardian_index as usize >= guardian_set.keys.len() {
                return Err(WormholeError::InvalidGuardianIndex);
            }

            let guardian_address = guardian_set.keys[signature.guardian_index as usize];
            let hashed_vm_hash: FixedBytes<32> = FixedBytes::from(keccak256(vm.hash));

            match self.verify_signature(&hashed_vm_hash, &signature.signature, guardian_address) {
                Ok(true) => {},
                Ok(false) => return Err(WormholeError::InvalidSignature.into()),
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
            return Err(WormholeError::InvalidInput);
        }

        self.guardian_set_sizes.setter(U256::from(set_index)).set(U256::from(guardians.len()));
        self.guardian_set_expiry.setter(U256::from(set_index)).set(U256::from(expiration_time));

        for (i, guardian) in guardians.iter().enumerate() {
            let key = self.compute_guardian_key(set_index, i as u8);
            self.guardian_keys.setter(key).set(*guardian);
        }

        Ok(())
    }

    // fn expire_guardian_set(&mut self, set_index: u32, now: u32) -> Result<(), WormholeError> {
    //     let mut guardian_set = self.get_guardian_set_internal(set_index).ok_or(WormholeError::GuardianSetError);
    //     guardian_set.expiration_time = now; // 24 hours
    //     self.store_guardian_set(set_index, guardian_set.keys, guardian_set.unwrap().expiration_time)?;
    //     Ok(())
    // }

    // fn is_guardian_set_expired(&self, set_index: u32, current_time: u64) -> Result<bool, WormholeError> {
    //     let guardian_set = self.get_guardian_set_internal(set_index).ok_or(WormholeError::GuardianSetError);
    //     Ok(current_time > guardian_set.expiration_time)
    // }

    fn verify_governance_vm(&self, vm: &VerifiedVM) -> Result<(), WormholeError> {
        let current_index = self.get_current_guardian_set_index().map_err(|_| WormholeError::NotInitialized)?;
        if vm.guardian_set_index != current_index {
            return Err(WormholeError::NotCurrentGuardianSet);
        }

        let governance_chain_id = self.get_governance_chain_id().map_err(|_| WormholeError::NotInitialized)?;
        if vm.emitter_chain_id != governance_chain_id {
            return Err(WormholeError::WrongChain);
        }

        let governance_contract = self.get_governance_contract().map_err(|_| WormholeError::NotInitialized)?;
        let governance_contract_bytes = governance_contract.into_array();
        if vm.emitter_address.as_slice() != &governance_contract_bytes {
            return Err(WormholeError::WrongContract);
        }

        if self.consumed_governance_actions.get(vm.hash.to_vec()) {
            return Err(WormholeError::GovernanceActionConsumed);
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
            return Err(WormholeError::InvalidSignature);
        }

        let secp = Secp256k1::new();

        let recid = RecoveryId::try_from(signature[64] as i32)
            .map_err(|_| WormholeError::InvalidSignature)?;
        let recoverable_sig = RecoverableSignature::from_compact(&signature[..64], recid)
            .map_err(|_| WormholeError::InvalidSignature)?;

        let hash_array: [u8; 32] = hash.as_slice().try_into().map_err(|_| WormholeError::InvalidInput)?;
        let message = Message::from_digest(hash_array);

        let pubkey_orig = secp
            .recover_ecdsa(message, &recoverable_sig)
            .map_err(|_| WormholeError::InvalidSignature)?;

        let pubkey: &[u8; 65] = &pubkey_orig.serialize_uncompressed();

        let address: [u8; 32] = Keccak256::new_with_prefix(&pubkey[1..]).finalize().into();
        let address: [u8; 20] = address[address.len() - 20..].try_into().map_err(|_| WormholeError::InvalidAddressLength)?;

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
            let key = self.compute_guardian_key(index, i as u8);
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
    fn parse_and_verify_vm(&self, encoded_vm: Vec<u8>) -> Result<VerifiedVM, WormholeError> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized);
        }

        let vm = self.parse_vm(&encoded_vm)?;
        self.verify_vm(&vm)?;
        Ok(vm)
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

    fn submit_new_guardian_set(&mut self, encoded_vm: Vec<u8>) -> Result<(), WormholeError> {
        if !self.initialized.get() {
            return Err(WormholeError::NotInitialized);
        }

        if encoded_vm.is_empty() {
            return Err(WormholeError::InvalidVMFormat);
        }

        let vm = self.parse_vm(&encoded_vm)?;
        self.verify_vm(&vm)?;

        self.verify_governance_vm(&vm)?;

        let mut cursor = 0;
        let header = governance::Governance::parse_header(&vm.payload, &mut cursor)?;

        if header.action != governance::Action::GuardianSetUpgrade {
            return Err(WormholeError::InvalidAction);
        }

        let chain_id = self.get_chain_id().map_err(|_| WormholeError::NotInitialized)?;
        if header.chain_id != 0 && header.chain_id != chain_id {
            return Err(WormholeError::InvalidChainId);
        }

        let new_set = governance::Governance::parse_new_guardian_set(&vm.payload, &mut cursor)?;

        let current_set_index = self.get_current_guardian_set_index().map_err(|_| WormholeError::NotInitialized)?;
        if new_set.set_index != current_set_index + 1 {
            return Err(WormholeError::InvalidInput);
        }

        self.store_guardian_set(new_set.set_index, new_set.keys, 0)?;

        self.consumed_governance_actions.insert(vm.hash.to_vec(), true);

        Ok(())
    }
}

#[cfg(test)]
mod tests;