use pyth::reader::ByteArray;
use core::starknet::secp256_trait::Signature;
use pyth::util::UnwrapWithFelt252;

#[starknet::interface]
pub trait IWormhole<T> {
    fn submit_new_guardian_set(
        ref self: T, set_index: u32, guardians: Array<felt252>
    ) -> Result<(), SubmitNewGuardianSetError>;
    fn parse_and_verify_vm(ref self: T, encoded_vm: ByteArray) -> Result<VM, ParseAndVerifyVmError>;
}

#[derive(Drop, Debug, Clone, Serde)]
pub struct GuardianSignature {
    pub guardian_index: u8,
    pub signature: Signature,
}

#[derive(Drop, Debug, Clone, Serde)]
pub struct VM {
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
        VM, IWormhole, GuardianSignature, quorum, ParseAndVerifyVmError, SubmitNewGuardianSetError
    };
    use pyth::reader::{Reader, ReaderImpl, ByteArray};
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

    #[generate_trait]
    impl ResultReaderToWormhole<T> of ResultReaderToWormholeTrait<T> {
        fn map_err(self: Result<T, pyth::reader::Error>) -> Result<T, ParseAndVerifyVmError> {
            match self {
                Result::Ok(v) => Result::Ok(v),
                Result::Err(err) => Result::Err(ParseAndVerifyVmError::Reader(err)),
            }
        }
    }

    #[derive(Drop, Debug, Clone, Serde, starknet::Store)]
    struct GuardianSet {
        num_guardians: usize,
        // XXX: storage doesn't work if we use Option here.
        expiration_time: u64,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        current_guardian_set_index: u32,
        guardian_sets: LegacyMap<u32, GuardianSet>,
        // (guardian_set_index, guardian_index) => guardian_address
        guardian_keys: LegacyMap<(u32, u8), u256>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, owner: ContractAddress, initial_guardians: Array<felt252>
    ) {
        self.owner.write(owner);
        let set_index = 0;
        store_guardian_set(ref self, set_index, @initial_guardians).unwrap_with_felt252();
    }

    fn store_guardian_set(
        ref self: ContractState, set_index: u32, guardians: @Array<felt252>
    ) -> Result<(), SubmitNewGuardianSetError> {
        if guardians.len() == 0 {
            return Result::Err(SubmitNewGuardianSetError::NoGuardiansSpecified.into());
        }
        if guardians.len() >= 256 {
            return Result::Err(SubmitNewGuardianSetError::TooManyGuardians.into());
        }

        let mut i = 0;
        let mut result = Result::Ok(());
        while i < guardians.len() {
            if *guardians.at(i) == 0 {
                result = Result::Err(SubmitNewGuardianSetError::InvalidGuardianKey.into());
                break;
            }
            i += 1;
        };
        result?;

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
        Result::Ok(())
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
        ) -> Result<(), SubmitNewGuardianSetError> {
            let execution_info = get_execution_info().unbox();
            if self.owner.read() != execution_info.caller_address {
                return Result::Err(SubmitNewGuardianSetError::AccessDenied);
            }
            let current_set_index = self.current_guardian_set_index.read();
            if set_index != current_set_index + 1 {
                return Result::Err(SubmitNewGuardianSetError::InvalidGuardianSetSequence.into());
            }
            store_guardian_set(ref self, set_index, @guardians)?;
            expire_guardian_set(
                ref self, current_set_index, execution_info.block_info.unbox().block_timestamp
            );
            Result::Ok(())
        }

        fn parse_and_verify_vm(
            ref self: ContractState, encoded_vm: ByteArray
        ) -> Result<VM, ParseAndVerifyVmError> {
            let (vm, body_hash) = parse_vm(encoded_vm)?;
            let guardian_set = self.guardian_sets.read(vm.guardian_set_index);
            if guardian_set.num_guardians == 0 {
                return Result::Err(ParseAndVerifyVmError::InvalidGuardianSetIndex);
            }
            if vm.guardian_set_index != self.current_guardian_set_index.read()
                && guardian_set.expiration_time < get_block_timestamp() {
                return Result::Err(ParseAndVerifyVmError::GuardianSetExpired);
            }
            if vm.signatures.len() < quorum(guardian_set.num_guardians) {
                return Result::Err(ParseAndVerifyVmError::NoQuorum);
            }
            let mut signatures_clone = vm.signatures.clone();
            let mut last_index = Option::None;

            let mut result = Result::Ok(());
            loop {
                let signature = match signatures_clone.pop_front() {
                    Option::Some(v) => { v },
                    Option::None => { break; },
                };

                match last_index {
                    Option::Some(last_index) => {
                        if *(@signature).guardian_index <= last_index {
                            result = Result::Err(ParseAndVerifyVmError::InvalidSignatureOrder);
                            break;
                        }
                    },
                    Option::None => {},
                };
                last_index = Option::Some(*(@signature).guardian_index);

                if signature.guardian_index.into() >= guardian_set.num_guardians {
                    result = Result::Err(ParseAndVerifyVmError::InvalidGuardianIndex);
                    break;
                }

                let guardian_key = self
                    .guardian_keys
                    .read((vm.guardian_set_index, signature.guardian_index));

                let r = verify_signature(body_hash, signature.signature, guardian_key);
                if r.is_err() {
                    result = r;
                    break;
                }
            };
            result?;

            Result::Ok(vm)
        }
    }

    fn parse_signature(ref reader: Reader) -> Result<GuardianSignature, ParseAndVerifyVmError> {
        let guardian_index = reader.read_u8().map_err()?;
        let r = reader.read_u256().map_err()?;
        let s = reader.read_u256().map_err()?;
        let recovery_id = reader.read_u8().map_err()?;
        let y_parity = (recovery_id % 2) > 0;
        let signature = GuardianSignature {
            guardian_index, signature: Signature { r, s, y_parity }
        };
        Result::Ok(signature)
    }

    fn parse_vm(encoded_vm: ByteArray) -> Result<(VM, u256), ParseAndVerifyVmError> {
        let mut reader = ReaderImpl::new(encoded_vm);
        let version = reader.read_u8().map_err()?;
        if version != 1 {
            return Result::Err(ParseAndVerifyVmError::VmVersionIncompatible);
        }
        let guardian_set_index = reader.read_u32().map_err()?;

        let sig_count = reader.read_u8().map_err()?;
        let mut i = 0;
        let mut signatures = array![];

        let mut result = Result::Ok(());
        while i < sig_count {
            match parse_signature(ref reader) {
                Result::Ok(signature) => { signatures.append(signature); },
                Result::Err(err) => {
                    result = Result::Err(err);
                    break;
                },
            }
            i += 1;
        };
        result?;

        let mut reader_for_hash = reader.clone();
        let mut hasher = HasherImpl::new();
        hasher.push_reader(ref reader_for_hash).map_err()?;
        let body_hash1 = hasher.finalize();
        let mut hasher2 = HasherImpl::new();
        hasher2.push_u256(body_hash1);
        let body_hash2 = hasher2.finalize();

        let timestamp = reader.read_u32().map_err()?;
        let nonce = reader.read_u32().map_err()?;
        let emitter_chain_id = reader.read_u16().map_err()?;
        let emitter_address = reader.read_u256().map_err()?;
        let sequence = reader.read_u64().map_err()?;
        let consistency_level = reader.read_u8().map_err()?;
        let payload_len = reader.len();
        let payload = reader.read_byte_array(payload_len).map_err()?;

        let vm = VM {
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
        };
        Result::Ok((vm, body_hash2))
    }

    fn verify_signature(
        body_hash: u256, signature: Signature, guardian_key: u256,
    ) -> Result<(), ParseAndVerifyVmError> {
        let point: Secp256k1Point = recover_public_key(body_hash, signature)
            .ok_or(ParseAndVerifyVmError::InvalidSignature)?;
        let address = eth_address(point)?;
        assert(guardian_key != 0, SubmitNewGuardianSetError::InvalidGuardianKey.into());
        if address != guardian_key {
            return Result::Err(ParseAndVerifyVmError::InvalidSignature);
        }
        Result::Ok(())
    }

    fn eth_address(point: Secp256k1Point) -> Result<u256, ParseAndVerifyVmError> {
        let (x, y) = match point.get_coordinates() {
            Result::Ok(v) => { v },
            Result::Err(_) => { return Result::Err(ParseAndVerifyVmError::InvalidSignature); },
        };

        let mut hasher = HasherImpl::new();
        hasher.push_u256(x);
        hasher.push_u256(y);
        let address = hasher.finalize() % ONE_SHIFT_160;
        Result::Ok(address)
    }
}
