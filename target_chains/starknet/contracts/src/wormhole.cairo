use pyth::reader::ByteArray;
use core::starknet::secp256_trait::Signature;

#[starknet::interface]
pub trait IWormhole<T> {
    fn submit_new_guardian_set(ref self: T, set_index: u32, guardians: Array<felt252>);
    fn parse_and_verify_vm(ref self: T, encoded_vm: ByteArray) -> Result<VM, felt252>;
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

pub mod error_codes {
    pub const NO_GUARDIANS_SPECIFIED: felt252 = 'no guardians specified';
    pub const TOO_MANY_GUARDIANS: felt252 = 'too many guardians';
    pub const INVALID_GUARDIAN_KEY: felt252 = 'invalid guardian key';
    // guardian set index must increase in steps of 1
    pub const INVALID_GUARDIAN_SET_SEQUENCE: felt252 = 'invalid guardian set sequence';
    pub const ACCESS_DENIED: felt252 = 'access denied';

    pub const VM_VERSION_INCOMPATIBLE: felt252 = 'VM version incompatible';
    pub const INVALID_GUARDIAN_SET_INDEX: felt252 = 'invalid guardian set index';
    pub const INVALID_SIGNATURE: felt252 = 'invalid signature';
    pub const GUARDIAN_SET_EXPIRED: felt252 = 'guardian set expired';
    pub const NO_QUORUM: felt252 = 'no quorum';
    pub const INVALID_SIGNATURE_ORDER: felt252 = 'invalid signature order';
    pub const INVALID_GUARDIAN_INDEX: felt252 = 'invalid guardian index';
}

pub fn quorum(num_guardians: usize) -> usize {
    assert(num_guardians < 256, error_codes::TOO_MANY_GUARDIANS);
    ((num_guardians * 2) / 3) + 1
}

#[starknet::contract]
mod wormhole {
    use core::box::BoxTrait;
    use core::array::ArrayTrait;
    use super::{VM, IWormhole, GuardianSignature, error_codes, quorum};
    use pyth::reader::{Reader, ReaderImpl, ByteArray, UNEXPECTED_OVERFLOW};
    use core::starknet::secp256_trait::{Signature, recover_public_key, Secp256PointTrait};
    use core::starknet::secp256k1::Secp256k1Point;
    use core::starknet::{
        ContractAddress, get_execution_info, get_caller_address, get_block_timestamp
    };
    use core::keccak::cairo_keccak;
    use core::integer::u128_byte_reverse;
    use core::panic_with_felt252;

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
        store_guardian_set(ref self, set_index, initial_guardians);
    }

    fn store_guardian_set(ref self: ContractState, set_index: u32, guardians: Array<felt252>) {
        assert(guardians.len() > 0, error_codes::NO_GUARDIANS_SPECIFIED);
        assert(guardians.len() < 256, error_codes::TOO_MANY_GUARDIANS);
        let set = GuardianSet { num_guardians: guardians.len(), expiration_time: 0 };
        self.guardian_sets.write(set_index, set);
        let mut i = 0;
        while i < guardians.len() {
            let key = *guardians.at(i);
            assert(key != 0, error_codes::INVALID_GUARDIAN_KEY);
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
            assert(self.owner.read() == execution_info.caller_address, error_codes::ACCESS_DENIED);

            let current_set_index = self.current_guardian_set_index.read();
            assert(set_index == current_set_index + 1, error_codes::INVALID_GUARDIAN_SET_SEQUENCE);
            expire_guardian_set(
                ref self, current_set_index, execution_info.block_info.unbox().block_timestamp
            );
            store_guardian_set(ref self, set_index, guardians);
        }

        fn parse_and_verify_vm(
            ref self: ContractState, encoded_vm: ByteArray
        ) -> Result<VM, felt252> {
            let (vm, body_hash) = parse_vm(encoded_vm)?;
            let guardian_set = self.guardian_sets.read(vm.guardian_set_index);
            if guardian_set.num_guardians == 0 {
                return Result::Err(error_codes::INVALID_GUARDIAN_SET_INDEX);
            }
            if vm.guardian_set_index != self.current_guardian_set_index.read()
                && guardian_set.expiration_time < get_block_timestamp() {
                return Result::Err(error_codes::GUARDIAN_SET_EXPIRED);
            }
            if vm.signatures.len() < quorum(guardian_set.num_guardians) {
                return Result::Err(error_codes::NO_QUORUM);
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
                            result = Result::Err(error_codes::INVALID_SIGNATURE_ORDER);
                            break;
                        }
                    },
                    Option::None => {},
                };
                last_index = Option::Some(*(@signature).guardian_index);

                if signature.guardian_index.into() >= guardian_set.num_guardians {
                    result = Result::Err(error_codes::INVALID_GUARDIAN_INDEX);
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

    fn parse_signature(ref reader: Reader) -> Result<GuardianSignature, felt252> {
        let guardian_index = reader.read_u8()?;
        let r = reader.read_u256()?;
        let s = reader.read_u256()?;
        let recovery_id = reader.read_u8()?;
        let y_parity = (recovery_id % 2) > 0;
        let signature = GuardianSignature {
            guardian_index, signature: Signature { r, s, y_parity }
        };
        Result::Ok(signature)
    }

    fn parse_vm(encoded_vm: ByteArray) -> Result<(VM, u256), felt252> {
        let mut reader = ReaderImpl::new(encoded_vm);
        let version = reader.read_u8()?;
        if version != 1 {
            return Result::Err(error_codes::VM_VERSION_INCOMPATIBLE);
        }
        let guardian_set_index = reader.read_u32()?;

        let sig_count = reader.read_u8()?;
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
        let body_hash1_le = reader_for_hash.keccak256()?;
        let mut body_hash1_le_u64s = split_hash(body_hash1_le);
        let body_hash2_le = cairo_keccak(ref body_hash1_le_u64s, 0, 0);
        let body_hash2 = u256 {
            low: u128_byte_reverse(body_hash2_le.high), high: u128_byte_reverse(body_hash2_le.low),
        };

        let timestamp = reader.read_u32()?;
        let nonce = reader.read_u32()?;
        let emitter_chain_id = reader.read_u16()?;
        let emitter_address = reader.read_u256()?;
        let sequence = reader.read_u64()?;
        let consistency_level = reader.read_u8()?;
        let payload_len = reader.len();
        let payload = reader.read_bytes(payload_len)?;

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
    ) -> Result<(), felt252> {
        let point: Secp256k1Point = recover_public_key(body_hash, signature)
            .ok_or(error_codes::INVALID_SIGNATURE)?;
        let address = eth_address(point)?;
        if guardian_key == 0 {
            return Result::Err(error_codes::INVALID_GUARDIAN_KEY);
        }
        if address != guardian_key {
            return Result::Err(error_codes::INVALID_SIGNATURE);
        }
        Result::Ok(())
    }

    const ONE_SHIFT_64: u256 = 0x10000000000000000;
    const ONE_SHIFT_160: u256 = 0x10000000000000000000000000000000000000000;

    fn eth_address(point: Secp256k1Point) -> Result<u256, felt252> {
        let (x, y) = match point.get_coordinates() {
            Result::Ok(v) => { v },
            Result::Err(_) => { return Result::Err(error_codes::INVALID_SIGNATURE); },
        };

        let mut array = array![];
        push_reversed(ref array, x);
        push_reversed(ref array, y);
        let key_hash = cairo_keccak(ref array, 0, 0);
        let reversed_key_hash = u256 {
            low: u128_byte_reverse(key_hash.high), high: u128_byte_reverse(key_hash.low)
        };
        Result::Ok(reversed_key_hash % ONE_SHIFT_160)
    }

    fn split_hash(val: u256) -> Array<u64> {
        let divisor = ONE_SHIFT_64.try_into().expect('not zero');
        let (val, v1) = DivRem::div_rem(val, divisor);
        let (val, v2) = DivRem::div_rem(val, divisor);
        let (val, v3) = DivRem::div_rem(val, divisor);

        array![
            v1.try_into().expect(UNEXPECTED_OVERFLOW),
            v2.try_into().expect(UNEXPECTED_OVERFLOW),
            v3.try_into().expect(UNEXPECTED_OVERFLOW),
            val.try_into().expect(UNEXPECTED_OVERFLOW),
        ]
    }

    fn push_reversed(ref array: Array<u64>, val: u256) {
        let divisor = ONE_SHIFT_64.try_into().expect('not zero');
        let (val, v1) = DivRem::div_rem(val, divisor);
        let (val, v2) = DivRem::div_rem(val, divisor);
        let (val, v3) = DivRem::div_rem(val, divisor);

        array.append(u64_byte_reverse(val.try_into().expect(UNEXPECTED_OVERFLOW)));
        array.append(u64_byte_reverse(v3.try_into().expect(UNEXPECTED_OVERFLOW)));
        array.append(u64_byte_reverse(v2.try_into().expect(UNEXPECTED_OVERFLOW)));
        array.append(u64_byte_reverse(v1.try_into().expect(UNEXPECTED_OVERFLOW)));
    }

    fn u64_byte_reverse(value: u128) -> u64 {
        let reversed = u128_byte_reverse(value) / ONE_SHIFT_64.try_into().expect('not zero');
        reversed.try_into().expect(UNEXPECTED_OVERFLOW)
    }
}
