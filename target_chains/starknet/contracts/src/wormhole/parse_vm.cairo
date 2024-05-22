use pyth::reader::{Reader, ReaderImpl};
use pyth::hash::{Hasher, HasherImpl};
use super::{VerifiedVM, GuardianSignature, ParseAndVerifyVmError};
use core::starknet::secp256_trait::Signature;
use pyth::byte_array::ByteArray;
use core::panic_with_felt252;

fn parse_signature(ref reader: Reader) -> GuardianSignature {
    let guardian_index = reader.read_u8();
    let r = reader.read_u256();
    let s = reader.read_u256();
    let recovery_id = reader.read_u8();
    let y_parity = (recovery_id % 2) > 0;
    GuardianSignature { guardian_index, signature: Signature { r, s, y_parity } }
}

pub fn parse_vm(encoded_vm: ByteArray) -> VerifiedVM {
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
