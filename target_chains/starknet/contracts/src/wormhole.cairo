use super::byte_array::ByteArray;
use core::starknet::secp256_trait::Signature;
use pyth::util::UnwrapWithFelt252;

mod governance;

#[starknet::interface]
pub trait IWormhole<T> {
    fn submit_new_guardian_set(ref self: T, set_index: u32, guardians: Array<felt252>);
    fn parse_and_verify_vm(self: @T, encoded_vm: ByteArray) -> VerifiedVM;

    // We don't need to implement other governance actions for now.
    // Instead of upgrading the Wormhole contract, we can switch to another Wormhole address
    // in the Pyth contract.
    fn submit_new_guardian_set2(ref self: T, encoded_vm: ByteArray);
}

#[derive(Drop, Debug, Clone, Serde)]
pub struct GuardianSignature {
    pub guardian_index: u8,
    pub signature: Signature,
}

#[derive(Drop, Debug, Clone, Serde)]
pub struct VerifiedVM {
    pub version: u8,
    pub guardian_set_index: u32,
    pub signatures: Array<GuardianSignature>,
    pub timestamp: u32,
    pub nonce: u32,
    pub emitter_chain_id: u16,
    pub emitter_address: u256,
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: ByteArray,
    pub hash: u256,
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum GovernanceError {
    InvalidModule,
    InvalidAction,
    InvalidChainId,
    TrailingData,
    NotCurrentGuardianSet,
    WrongChain,
    WrongContract,
    ActionAlreadyConsumed,
}

pub impl GovernanceErrorUnwrapWithFelt252<T> of UnwrapWithFelt252<T, GovernanceError> {
    fn unwrap_with_felt252(self: Result<T, GovernanceError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

impl GovernanceErrorIntoFelt252 of Into<GovernanceError, felt252> {
    fn into(self: GovernanceError) -> felt252 {
        match self {
            GovernanceError::InvalidModule => 'invalid module',
            GovernanceError::InvalidAction => 'invalid action',
            GovernanceError::InvalidChainId => 'invalid chain ID',
            GovernanceError::TrailingData => 'trailing data',
            GovernanceError::NotCurrentGuardianSet => 'not signed by current guard.set',
            GovernanceError::WrongChain => 'wrong governance chain',
            GovernanceError::WrongContract => 'wrong governance contract',
            GovernanceError::ActionAlreadyConsumed => 'gov. action already consumed',
        }
    }
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum SubmitNewGuardianSetError {
    NoGuardiansSpecified,
    TooManyGuardians,
    InvalidGuardianKey,
    // guardian set index must increase in steps of 1
    InvalidGuardianSetSequence,
    AccessDenied,
}

pub impl SubmitNewGuardianSetErrorUnwrapWithFelt252<
    T
> of UnwrapWithFelt252<T, SubmitNewGuardianSetError> {
    fn unwrap_with_felt252(self: Result<T, SubmitNewGuardianSetError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

impl SubmitNewGuardianSetErrorIntoFelt252 of Into<SubmitNewGuardianSetError, felt252> {
    fn into(self: SubmitNewGuardianSetError) -> felt252 {
        match self {
            SubmitNewGuardianSetError::NoGuardiansSpecified => 'no guardians specified',
            SubmitNewGuardianSetError::TooManyGuardians => 'too many guardians',
            SubmitNewGuardianSetError::InvalidGuardianKey => 'invalid guardian key',
            SubmitNewGuardianSetError::InvalidGuardianSetSequence => 'invalid guardian set sequence',
            SubmitNewGuardianSetError::AccessDenied => 'access denied',
        }
    }
}


#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum ParseAndVerifyVmError {
    Reader: pyth::reader::Error,
    VmVersionIncompatible,
    InvalidGuardianSetIndex,
    InvalidSignature,
    GuardianSetExpired,
    NoQuorum,
    InvalidSignatureOrder,
    InvalidGuardianIndex,
}

pub impl ParseAndVerifyVmErrorUnwrapWithFelt252<T> of UnwrapWithFelt252<T, ParseAndVerifyVmError> {
    fn unwrap_with_felt252(self: Result<T, ParseAndVerifyVmError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}


impl ErrorIntoFelt252 of Into<ParseAndVerifyVmError, felt252> {
    fn into(self: ParseAndVerifyVmError) -> felt252 {
        match self {
            ParseAndVerifyVmError::Reader(err) => err.into(),
            ParseAndVerifyVmError::VmVersionIncompatible => 'VM version incompatible',
            ParseAndVerifyVmError::InvalidGuardianSetIndex => 'invalid guardian set index',
            ParseAndVerifyVmError::InvalidSignature => 'invalid signature',
            ParseAndVerifyVmError::GuardianSetExpired => 'guardian set expired',
            ParseAndVerifyVmError::NoQuorum => 'no quorum',
            ParseAndVerifyVmError::InvalidSignatureOrder => 'invalid signature order',
            ParseAndVerifyVmError::InvalidGuardianIndex => 'invalid guardian index',
        }
    }
}

pub fn quorum(num_guardians: usize) -> usize {
    assert(num_guardians < 256, SubmitNewGuardianSetError::TooManyGuardians.into());
    ((num_guardians * 2) / 3) + 1
}

#[starknet::contract]
mod wormhole {
    use pyth::util::UnwrapWithFelt252;
    use core::box::BoxTrait;
    use core::array::ArrayTrait;
    use super::{
        VerifiedVM, IWormhole, GuardianSignature, quorum, ParseAndVerifyVmError,
        SubmitNewGuardianSetError, GovernanceError
    };
    use super::governance;
    use pyth::reader::{Reader, ReaderImpl};
    use pyth::byte_array::ByteArray;
    use core::starknet::secp256_trait::{Signature, recover_public_key, Secp256PointTrait};
    use core::starknet::secp256k1::Secp256k1Point;
    use core::starknet::{
        ContractAddress, get_execution_info, get_caller_address, get_block_timestamp
    };
    use core::keccak::cairo_keccak;
    use core::integer::u128_byte_reverse;
    use core::panic_with_felt252;
    use pyth::hash::{Hasher, HasherImpl};
    use pyth::util::{ONE_SHIFT_160, UNEXPECTED_OVERFLOW};

    #[derive(Drop, Debug, Clone, Serde, starknet::Store)]
    struct GuardianSet {
        num_guardians: usize,
        // XXX: storage doesn't work if we use Option here.
        expiration_time: u64,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: u256,
        current_guardian_set_index: u32,
        consumed_governance_actions: LegacyMap<u256, bool>,
        guardian_sets: LegacyMap<u32, GuardianSet>,
        // (guardian_set_index, guardian_index) => guardian_address
        guardian_keys: LegacyMap<(u32, u8), u256>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        initial_guardians: Array<felt252>,
        chain_id: u16,
        governance_chain_id: u16,
        governance_contract: u256,
    ) {
        self.owner.write(owner);
        self.chain_id.write(chain_id);
        self.governance_chain_id.write(governance_chain_id);
        self.governance_contract.write(governance_contract);
        let set_index = 0;
        store_guardian_set(ref self, set_index, @initial_guardians);
    }

    fn store_guardian_set(ref self: ContractState, set_index: u32, guardians: @Array<felt252>) {
        if guardians.len() == 0 {
            panic_with_felt252(SubmitNewGuardianSetError::NoGuardiansSpecified.into());
        }
        if guardians.len() >= 256 {
            panic_with_felt252(SubmitNewGuardianSetError::TooManyGuardians.into());
        }

        let mut i = 0;
        while i < guardians.len() {
            if *guardians.at(i) == 0 {
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

    #[abi(embed_v0)]
    impl WormholeImpl of IWormhole<ContractState> {
        fn submit_new_guardian_set(
            ref self: ContractState, set_index: u32, guardians: Array<felt252>
        ) {
            let execution_info = get_execution_info().unbox();
            if self.owner.read() != execution_info.caller_address {
                panic_with_felt252(SubmitNewGuardianSetError::AccessDenied.into());
            }
            let current_set_index = self.current_guardian_set_index.read();
            if set_index != current_set_index + 1 {
                panic_with_felt252(SubmitNewGuardianSetError::InvalidGuardianSetSequence.into());
            }
            store_guardian_set(ref self, set_index, @guardians);
            expire_guardian_set(
                ref self, current_set_index, execution_info.block_info.unbox().block_timestamp
            );
        }

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
                    .read((vm.guardian_set_index, signature.guardian_index));

                verify_signature(vm.hash, signature.signature, guardian_key);
            };
            vm
        }

        fn submit_new_guardian_set2(ref self: ContractState, encoded_vm: ByteArray) {
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
            store_guardian_set(ref self, new_set.set_index, @new_set.keys);
            expire_guardian_set(ref self, current_set_index, get_block_timestamp());

            self.consumed_governance_actions.write(vm.hash, true);
        }
    }

    fn parse_signature(ref reader: Reader) -> GuardianSignature {
        let guardian_index = reader.read_u8();
        let r = reader.read_u256();
        let s = reader.read_u256();
        let recovery_id = reader.read_u8();
        let y_parity = (recovery_id % 2) > 0;
        GuardianSignature { guardian_index, signature: Signature { r, s, y_parity } }
    }

    fn parse_vm(encoded_vm: ByteArray) -> VerifiedVM {
        let mut reader = ReaderImpl::new(encoded_vm);
        let version = reader.read_u8();
        if version != 1 {
            panic_with_felt252(ParseAndVerifyVmError::VmVersionIncompatible.into());
        }
        let guardian_set_index = reader.read_u32();

        let sig_count = reader.read_u8();
        let mut i = 0;
        let mut signatures = array![];

        while i < sig_count {
            signatures.append(parse_signature(ref reader));
            i += 1;
        };

        let mut reader_for_hash = reader.clone();
        let mut hasher = HasherImpl::new();
        hasher.push_reader(ref reader_for_hash);
        let body_hash1 = hasher.finalize();
        let mut hasher2 = HasherImpl::new();
        hasher2.push_u256(body_hash1);
        let body_hash2 = hasher2.finalize();

        let timestamp = reader.read_u32();
        let nonce = reader.read_u32();
        let emitter_chain_id = reader.read_u16();
        let emitter_address = reader.read_u256();
        let sequence = reader.read_u64();
        let consistency_level = reader.read_u8();
        let payload_len = reader.len();
        let payload = reader.read_byte_array(payload_len);

        VerifiedVM {
            version,
            guardian_set_index,
            signatures,
            timestamp,
            nonce,
            emitter_chain_id,
            emitter_address,
            sequence,
            consistency_level,
            payload,
            hash: body_hash2,
        }
    }

    fn verify_signature(body_hash: u256, signature: Signature, guardian_key: u256,) {
        let point: Secp256k1Point = recover_public_key(body_hash, signature)
            .expect(ParseAndVerifyVmError::InvalidSignature.into());
        let address = eth_address(point);
        assert(guardian_key != 0, SubmitNewGuardianSetError::InvalidGuardianKey.into());
        if address != guardian_key {
            panic_with_felt252(ParseAndVerifyVmError::InvalidSignature.into());
        }
    }

    fn eth_address(point: Secp256k1Point) -> u256 {
        let (x, y) = point.get_coordinates().expect(ParseAndVerifyVmError::InvalidSignature.into());

        let mut hasher = HasherImpl::new();
        hasher.push_u256(x);
        hasher.push_u256(y);
        hasher.finalize() % ONE_SHIFT_160
    }

    #[generate_trait]
    impl PrivateImpl of PrivateImplTrait {
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
