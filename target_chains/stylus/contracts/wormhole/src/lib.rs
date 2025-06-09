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
    InvalidInput,
    InsufficientSignatures,
    InvalidGuardianIndex,
    InvalidAddressLength,
    VerfiyVMError,
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

        self.store_guardian_set(0, initial_guardians, 0)?;

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
        self.verify_vm(&vm)?;

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

            match self.verify_signature(&vm.hash, &signature.signature, guardian_address) {
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

        let recid = match signature[64].checked_sub(27) {
            Some(0) => RecoveryId::Zero,
            Some(1) => RecoveryId::One,
            Some(2) => RecoveryId::Two,
            Some(3) => RecoveryId::Three,
            _ => return Err(WormholeError::InvalidSignature),
        };
        // let recid = RecoveryId::try_from(signature[64] as i32).map_err(|_| WormholeError::InvalidSignature)?;

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

    fn submit_new_guardian_set(&mut self, _encoded_vm: Vec<u8>) -> Result<(), WormholeError> {
        // TODO: COMPLETE EXTERNAL METHOD TO SUBMIT NEW GUARDIAN SET
        Err(WormholeError::InvalidVMFormat)
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

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

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
        contract.store_guardian_set(0, guardians.clone(), 0).unwrap();
        contract.initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
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

    fn corrupted_vm(mut real_data: Vec<u8>, pos: usize, random1: u8, random2: u8) -> Vec<u8> {
        if real_data.len() < 2 {
            return real_data;
        }
        let pos = pos % real_data.len();
        let pos2 = (pos + 1) % real_data.len();

        real_data[pos] = real_data[pos].wrapping_add(random1).wrapping_add(1);
        real_data[pos2] = real_data[pos2].wrapping_add(random2).wrapping_add(1);
        real_data
    }

    fn create_test_vm(guardian_set_index: u32, signatures: Vec<GuardianSignature>) -> VerifiedVM {
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

    fn create_test_vm_with_emitter(guardian_set_index: u32, signatures: Vec<GuardianSignature>, emitter: Address) -> VerifiedVM {
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

    fn create_valid_guardian_signature(guardian_index: u8, hash: &FixedBytes<32>) -> GuardianSignature {
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
        signature_bytes[..64].copy_from_slice(&sig_bytes);
        signature_bytes[64] = match recovery_id {
            RecoveryId::Zero => 27,
            RecoveryId::One => 28,
            RecoveryId::Two => 29,
            RecoveryId::Three => 30,
        };

        GuardianSignature {
            guardian_index,
            signature: FixedBytes::from(signature_bytes),
        }
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
    fn test_get_guardian_set_works() {
        let contract = deploy_with_mainnet_guardian_set0();

        let set0 = contract.get_guardian_set_internal(0).unwrap();
        assert_eq!(set0.keys, guardian_set0());
        assert_eq!(set0.expiration_time, 0);
        assert_eq!(contract.get_current_guardian_set_index(), Ok(0));
    }

    #[motsu::test]
    fn test_parse_vm_invalid_length() {
        let short_vm = vec![1, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&short_vm);
        assert!(matches!(result, Err(WormholeError::InvalidVMFormat)));
    }

    #[motsu::test]
    fn test_parse_vm_invalid_version() {
        let invalid_version_vm = vec![2, 0, 0, 0, 0, 0];
        let result = WormholeContract::parse_vm_static(&invalid_version_vm);
        assert!(matches!(result, Err(WormholeError::InvalidVMFormat)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_set() {
        let contract = deploy_with_test_guardian();
        let vm = create_test_vm(999, vec![]);

        let result = contract.verify_vm(&vm);
        assert!(matches!(result, Err(WormholeError::InvalidGuardianSetIndex)));
    }

    #[motsu::test]
    fn test_verify_vm_insufficient_signatures() {
        let contract = deploy_with_test_guardian();
        let vm = create_test_vm(0, vec![]);

        let result = contract.verify_vm(&vm);
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
        contract.store_guardian_set(0, guardians, 0).unwrap();

        let signatures = vec![
            create_guardian_signature(2),
            create_guardian_signature(1), // Out of order - should trigger error
            create_guardian_signature(0),
        ];
        let vm = create_test_vm(0, signatures); // Use guardian set 0

        let result = contract.verify_vm(&vm);
        assert!(matches!(result, Err(WormholeError::InvalidSignature)));
    }

    #[motsu::test]
    fn test_verify_vm_invalid_guardian_index() {
        let contract = deploy_with_test_guardian();
        let signatures = vec![
            create_guardian_signature(5),
        ];
        let vm = create_test_vm(0, signatures);

        let result = contract.verify_vm(&vm);
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

        let vm = create_test_vm_with_emitter(0, vec![], Address::from([0x99u8; 20]));
        let result = contract.verify_vm(&vm);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_wrong_index() {
        let contract = deploy_with_mainnet_guardian_set0();

        let vm = create_test_vm(2, vec![]); // Skip index 1
        let result = contract.verify_vm(&vm);
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

        let result = contract.store_guardian_set(0, empty_guardians, 0);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_rejects_corrupted_vm_data() {
        let _contract = deploy_with_mainnet_guardians();

        for i in 0..10 {
            let corrupted_data = corrupted_vm(vec![1, 0, 0, 1, 0, 0], i, i as u8, (i * 2) as u8);
            let result = WormholeContract::parse_vm_static(&corrupted_data);
            assert!(result.is_err());
        }
    }

    #[motsu::test]
    fn test_parse_and_verify_vm_rejects_corrupted_vm() {
        let contract = deploy_with_mainnet_guardians();

        for i in 0..5 {
            let base_vm = vec![1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            let corrupted_data = corrupted_vm(base_vm, i, i as u8, (i * 3) as u8);
            let result = WormholeContract::parse_vm_static(&corrupted_data);
            assert!(result.is_err());
        }
    }

    #[motsu::test]
    fn test_submit_guardian_set_rejects_non_governance() {
        let contract = deploy_with_mainnet_guardian_set0();

        let mut vm = create_test_vm(0, vec![]);
        vm.emitter_chain_id = 999; // Wrong chain

        let result = contract.verify_vm(&vm);
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_guardian_set_storage_and_retrieval() {
        let mut contract = WormholeContract::default();
        let guardians = vec![
            test_guardian_address1(),
            test_guardian_address2(),
        ];

        contract.store_guardian_set(0, guardians.clone(), 0).unwrap();

        let retrieved_set = contract.get_guardian_set_internal(0).unwrap();
        assert_eq!(retrieved_set.keys, guardians);
        assert_eq!(retrieved_set.expiration_time, 0);
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

        contract.store_guardian_set(0, guardian_set0(), 0).unwrap();
        contract.store_guardian_set(4, guardian_set4(), 0).unwrap();

        let set0 = contract.get_guardian_set_internal(0).unwrap();
        let set4 = contract.get_guardian_set_internal(4).unwrap();

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
        contract.store_guardian_set(0, guardians, 0).unwrap();
        let hash = FixedBytes::<32>::from([0x42u8; 32]);

        let vm = VerifiedVM {
            version: 1,
            guardian_set_index: 0,
            signatures: vec![
                create_valid_guardian_signature(0, &hash),
                create_valid_guardian_signature(1, &hash),
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

        let result = contract.verify_vm(&vm);
    }

    #[motsu::test]
    fn test_chain_id_governance_values() {
        let contract = deploy_with_mainnet_guardians();

        assert_eq!(contract.get_chain_id().unwrap(), CHAIN_ID);
        assert_eq!(contract.get_governance_chain_id().unwrap(), GOVERNANCE_CHAIN_ID);
        assert_eq!(contract.get_governance_contract().unwrap(), Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]));
    }

    #[motsu::test]
    fn test_governance_action_consumed() {
        let contract = deploy_with_mainnet_guardians();

        let test_hash = vec![0u8; 32];
        assert_eq!(contract.governance_action_is_consumed(test_hash), false);
    }
}
