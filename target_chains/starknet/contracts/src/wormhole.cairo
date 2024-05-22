mod interface;
mod errors;
mod governance;
mod parse_vm;

pub use errors::{GovernanceError, SubmitNewGuardianSetError, ParseAndVerifyVmError};
pub use interface::{
    VerifiedVM, IWormhole, IWormholeDispatcher, IWormholeDispatcherTrait, GuardianSignature, quorum
};
pub use wormhole::{Event, GuardianSetAdded};

#[starknet::contract]
mod wormhole {
    use pyth::util::UnwrapWithFelt252;
    use core::box::BoxTrait;
    use core::array::ArrayTrait;
    use super::{
        VerifiedVM, IWormhole, quorum, ParseAndVerifyVmError, SubmitNewGuardianSetError,
        GovernanceError
    };
    use super::governance;
    use super::parse_vm::parse_vm;
    use pyth::reader::{Reader, ReaderImpl};
    use pyth::byte_array::ByteArray;
    use core::starknet::{get_block_timestamp, EthAddress};
    use core::starknet::eth_signature::is_eth_signature_valid;
    use core::panic_with_felt252;
    use pyth::util::{UNEXPECTED_OVERFLOW};

    #[event]
    #[derive(Drop, PartialEq, starknet::Event)]
    pub enum Event {
        GuardianSetAdded: GuardianSetAdded,
    }

    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct GuardianSetAdded {
        pub index: u32,
    }

    #[derive(Drop, Debug, Clone, Serde, starknet::Store)]
    struct GuardianSet {
        num_guardians: usize,
        // XXX: storage doesn't work if we use Option here.
        expiration_time: u64,
    }

    #[storage]
    struct Storage {
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: u256,
        current_guardian_set_index: u32,
        consumed_governance_actions: LegacyMap<u256, bool>,
        guardian_sets: LegacyMap<u32, GuardianSet>,
        // (guardian_set_index, guardian_index) => guardian_address
        guardian_keys: LegacyMap<(u32, u8), EthAddress>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        initial_guardians: Array<EthAddress>,
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: u256,
    ) {
        self.chain_id.write(chain_id);
        self.governance_chain_id.write(governance_chain_id);
        self.governance_contract.write(governance_contract);
        let set_index = 0;
        self.store_guardian_set(set_index, @initial_guardians);
    }

    #[abi(embed_v0)]
    impl WormholeImpl of IWormhole<ContractState> {
        fn parse_and_verify_vm(self: @ContractState, encoded_vm: ByteArray) -> VerifiedVM {
            let vm = parse_vm(encoded_vm);
            let guardian_set = self.guardian_sets.read(vm.guardian_set_index);
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

                match last_index {
                    Option::Some(last_index) => {
                        if *(@signature).guardian_index <= last_index {
                            panic_with_felt252(ParseAndVerifyVmError::InvalidSignatureOrder.into());
                        }
                    },
                    Option::None => {},
                };
                last_index = Option::Some(*(@signature).guardian_index);

                if signature.guardian_index.into() >= guardian_set.num_guardians {
                    panic_with_felt252(ParseAndVerifyVmError::InvalidGuardianIndex.into());
                }

                let guardian_key = self
                    .guardian_keys
                    .read((vm.guardian_set_index, signature.guardian_index))
                    .try_into()
                    .expect(UNEXPECTED_OVERFLOW);

                is_eth_signature_valid(vm.hash, signature.signature, guardian_key)
                    .unwrap_with_felt252();
            };
            vm
        }

        fn chain_id(self: @ContractState) -> u16 {
            self.chain_id.read()
        }

        fn submit_new_guardian_set(ref self: ContractState, encoded_vm: ByteArray) {
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

            self.consumed_governance_actions.write(vm.hash, true);

            let event = GuardianSetAdded { index: new_set.set_index };
            self.emit(event);
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateImplTrait {
        fn store_guardian_set(
            ref self: ContractState, set_index: u32, guardians: @Array<EthAddress>
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
            };

            let set = GuardianSet { num_guardians: guardians.len(), expiration_time: 0 };
            self.guardian_sets.write(set_index, set);
            i = 0;
            while i < guardians.len() {
                let key = *guardians.at(i);
                // i < 256
                self
                    .guardian_keys
                    .write((set_index, i.try_into().expect(UNEXPECTED_OVERFLOW)), key.into());
                i += 1;
            };
            self.current_guardian_set_index.write(set_index);
        }

        fn expire_guardian_set(ref self: ContractState, set_index: u32, now: u64) {
            let mut set = self.guardian_sets.read(set_index);
            set.expiration_time = now + 86400;
            self.guardian_sets.write(set_index, set);
        }

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
            if self.consumed_governance_actions.read(*vm.hash) {
                panic_with_felt252(GovernanceError::ActionAlreadyConsumed.into());
            }
        }
    }
}
