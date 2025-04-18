mod errors;
mod governance;
mod interface;
mod parse_vm;

pub use errors::{
    GetGuardianSetError, GovernanceError, ParseAndVerifyVmError, SubmitNewGuardianSetError,
};
pub use interface::{
    GuardianSet, GuardianSignature, IWormhole, IWormholeDispatcher, IWormholeDispatcherTrait,
    VerifiedVM, quorum,
};
pub use wormhole::{Event, GuardianSetAdded};

/// Implementation of the Wormhole contract.
#[starknet::contract]
mod wormhole {
    use core::array::ArrayTrait;
    use core::panic_with_felt252;
    use pyth::byte_buffer::ByteBuffer;
    use pyth::reader::ReaderImpl;
    use pyth::util::{UNEXPECTED_OVERFLOW, UnwrapWithFelt252};
    use starknet::eth_signature::is_eth_signature_valid;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{EthAddress, get_block_timestamp};
    use super::parse_vm::parse_vm;
    use super::{
        GetGuardianSetError, GovernanceError, IWormhole, ParseAndVerifyVmError,
        SubmitNewGuardianSetError, VerifiedVM, governance, quorum,
    };

    /// Events emitted by the contract.
    #[event]
    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub enum Event {
        GuardianSetAdded: GuardianSetAdded,
    }

    /// Emitted when a new guardian set is added.
    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct GuardianSetAdded {
        /// Index of the new guardian set.
        pub index: u32,
    }

    /// Guardian set storage.
    #[derive(Drop, Copy, Debug, PartialEq, Serde, Hash, starknet::Store)]
    struct GuardianSet {
        /// Number of guardians in this guardian set.
        /// Guardian keys are stored separately.
        num_guardians: usize,
        /// Timestamp of expiry, or 0 if there is no expiration time.
        // XXX: storage doesn't work if we use Option here.
        expiration_time: u64,
    }

    #[storage]
    struct Storage {
        /// ID of the chain the contract is deployed on.
        chain_id: u16,
        /// ID of the chain containing the Wormhole governance contract.
        governance_chain_id: u16,
        /// Address of the Wormhole governance contract.
        governance_contract: u256,
        /// Index of the last added set.
        current_guardian_set_index: u32,
        /// For every executed governance actions, contains an entry with
        /// key = hash of the message and value = true.
        consumed_governance_actions: Map<u256, bool>,
        /// All known guardian sets.
        guardian_sets: Map<u32, GuardianSet>,
        /// Public keys of guardians in all known guardian sets.
        /// Key = (guardian_set_index, guardian_index).
        guardian_keys: Map<(u32, u8), EthAddress>,
    }

    /// Initializes the contract.
    /// `initial_guardians` is the list of public keys of guardians.
    /// `chain_id` is the ID of the chain the contract is being deployed on.
    /// `governance_chain_id` is the ID of the chain containing the Wormhole governance contract.
    /// `governance_contract` is the address of the Wormhole governance contract.
    #[constructor]
    fn constructor(
        ref self: ContractState,
        initial_guardian_set_index: u32,
        initial_guardians: Array<EthAddress>,
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: u256,
    ) {
        self.chain_id.write(chain_id);
        self.governance_chain_id.write(governance_chain_id);
        self.governance_contract.write(governance_contract);
        self.store_guardian_set(initial_guardian_set_index, @initial_guardians);
    }

    #[abi(embed_v0)]
    impl WormholeImpl of IWormhole<ContractState> {
        fn parse_and_verify_vm(self: @ContractState, encoded_vm: ByteBuffer) -> VerifiedVM {
            let vm = parse_vm(encoded_vm);
            let guardian_set = self.guardian_sets.entry(vm.guardian_set_index).read();
            if guardian_set.num_guardians == 0 {
                panic_with_felt252(ParseAndVerifyVmError::InvalidGuardianSetIndex.into());
            }
            if vm.guardian_set_index != self.current_guardian_set_index.read()
                && guardian_set.expiration_time < get_block_timestamp() {
                panic_with_felt252(ParseAndVerifyVmError::GuardianSetExpired.into());
            }
            if vm.signatures.len() < quorum(guardian_set.num_guardians) {
                panic_with_felt252(ParseAndVerifyVmError::NoQuorum.into());
            }
            let mut signatures_clone = vm.signatures.clone();
            let mut last_index = Option::None;

            loop {
                let signature = match signatures_clone.pop_front() {
                    Option::Some(v) => { v },
                    Option::None => { break; },
                };

                if let Some(last_index) = last_index {
                    let guardian_index = *(@signature).guardian_index;
                    if guardian_index <= last_index {
                        panic_with_felt252(ParseAndVerifyVmError::InvalidSignatureOrder.into());
                    }
                }
                last_index = Option::Some(*(@signature).guardian_index);

                if signature.guardian_index.into() >= guardian_set.num_guardians {
                    panic_with_felt252(ParseAndVerifyVmError::InvalidGuardianIndex.into());
                }

                let guardian_key = self
                    .guardian_keys
                    .entry((vm.guardian_set_index, signature.guardian_index))
                    .read()
                    .try_into()
                    .expect(UNEXPECTED_OVERFLOW);

                is_eth_signature_valid(vm.hash, signature.signature, guardian_key)
                    .unwrap_with_felt252();
            }
            vm
        }

        fn get_guardian_set(self: @ContractState, index: u32) -> super::GuardianSet {
            let mut keys = array![];
            let set = self.guardian_sets.entry(index).read();
            if set.num_guardians == 0 {
                panic_with_felt252(GetGuardianSetError::InvalidIndex.into());
            }
            let mut i: u8 = 0;
            while i.into() < set.num_guardians {
                keys.append(self.guardian_keys.entry((index, i)).read());
                i += 1;
            }
            super::GuardianSet {
                keys,
                expiration_time: if set.expiration_time == 0 {
                    Option::None
                } else {
                    Option::Some(set.expiration_time)
                },
            }
        }
        fn get_current_guardian_set_index(self: @ContractState) -> u32 {
            self.current_guardian_set_index.read()
        }
        fn governance_action_is_consumed(self: @ContractState, hash: u256) -> bool {
            self.consumed_governance_actions.entry(hash).read()
        }
        fn chain_id(self: @ContractState) -> u16 {
            self.chain_id.read()
        }
        fn governance_chain_id(self: @ContractState) -> u16 {
            self.governance_chain_id.read()
        }
        fn governance_contract(self: @ContractState) -> u256 {
            self.governance_contract.read()
        }

        fn submit_new_guardian_set(ref self: ContractState, encoded_vm: ByteBuffer) {
            let vm = self.parse_and_verify_vm(encoded_vm);
            self.verify_governance_vm(@vm);
            let mut reader = ReaderImpl::new(vm.payload);
            let header = governance::parse_header(ref reader);
            if header.action != governance::Action::GuardianSetUpgrade {
                panic_with_felt252(GovernanceError::InvalidAction.into());
            }
            if header.chain_id != 0 && header.chain_id != self.chain_id.read() {
                panic_with_felt252(GovernanceError::InvalidChainId.into());
            }
            let new_set = governance::parse_new_guardian_set(ref reader);
            let current_set_index = self.current_guardian_set_index.read();
            if new_set.set_index != current_set_index + 1 {
                panic_with_felt252(SubmitNewGuardianSetError::InvalidGuardianSetSequence.into());
            }
            self.store_guardian_set(new_set.set_index, @new_set.keys);
            self.expire_guardian_set(current_set_index, get_block_timestamp());

            self.consumed_governance_actions.entry(vm.hash).write(true);

            let event = GuardianSetAdded { index: new_set.set_index };
            self.emit(event);
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateImplTrait {
        /// Validates the new guardian set and writes it to the storage.
        /// `SubmitNewGuardianSetError` enumerates possible panic payloads.
        fn store_guardian_set(
            ref self: ContractState, set_index: u32, guardians: @Array<EthAddress>,
        ) {
            if guardians.len() == 0 {
                panic_with_felt252(SubmitNewGuardianSetError::NoGuardiansSpecified.into());
            }
            if guardians.len() >= 256 {
                panic_with_felt252(SubmitNewGuardianSetError::TooManyGuardians.into());
            }

            let mut i = 0;
            while i < guardians.len() {
                if (*guardians.at(i)).into() == 0 {
                    panic_with_felt252(SubmitNewGuardianSetError::InvalidGuardianKey.into());
                }
                i += 1;
            }

            let set = GuardianSet { num_guardians: guardians.len(), expiration_time: 0 };
            self.guardian_sets.entry(set_index).write(set);
            i = 0;
            while i < guardians.len() {
                let key = *guardians.at(i);
                // i < 256
                self
                    .guardian_keys
                    .entry((set_index, i.try_into().expect(UNEXPECTED_OVERFLOW)))
                    .write(key.into());
                i += 1;
            }
            self.current_guardian_set_index.write(set_index);
        }

        /// Marks the specified guardian set to expire in 24 hours.
        fn expire_guardian_set(ref self: ContractState, set_index: u32, now: u64) {
            let mut set = self.guardian_sets.entry(set_index).read();
            set.expiration_time = now + 86400;
            self.guardian_sets.entry(set_index).write(set);
        }

        /// Checks required properties of the governance instruction.
        /// `GovernanceError` enumerates possible panic payloads.
        fn verify_governance_vm(self: @ContractState, vm: @VerifiedVM) {
            if self.current_guardian_set_index.read() != *vm.guardian_set_index {
                panic_with_felt252(GovernanceError::NotCurrentGuardianSet.into());
            }
            if self.governance_chain_id.read() != *vm.emitter_chain_id {
                panic_with_felt252(GovernanceError::WrongChain.into());
            }
            if self.governance_contract.read() != *vm.emitter_address {
                panic_with_felt252(GovernanceError::WrongContract.into());
            }
            if self.consumed_governance_actions.entry(*vm.hash).read() {
                panic_with_felt252(GovernanceError::ActionAlreadyConsumed.into());
            }
        }
    }
}
