use core::cmp::{max, min};
use core::panic_with_felt252;
use super::hash::HasherImpl;
use super::reader::{Reader, ReaderImpl};
use super::byte_buffer::ByteBuffer;
use super::util::ONE_SHIFT_96;

const MERKLE_LEAF_PREFIX: u8 = 0;
const MERKLE_NODE_PREFIX: u8 = 1;
const MERKLE_EMPTY_LEAF_PREFIX: u8 = 2;

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum MerkleVerificationError {
    Reader: super::reader::Error,
    DigestMismatch,
}

impl MerkleVerificationErrorIntoFelt252 of Into<MerkleVerificationError, felt252> {
    fn into(self: MerkleVerificationError) -> felt252 {
        match self {
            MerkleVerificationError::Reader(err) => err.into(),
            MerkleVerificationError::DigestMismatch => 'digest mismatch',
        }
    }
}

#[generate_trait]
impl ResultReaderToMerkleVerification<T> of ResultReaderToMerkleVerificationTrait<T> {
    fn map_err(self: Result<T, pyth::reader::Error>) -> Result<T, MerkleVerificationError> {
        match self {
            Result::Ok(v) => Result::Ok(v),
            Result::Err(err) => Result::Err(MerkleVerificationError::Reader(err)),
        }
    }
}

fn leaf_hash(mut reader: Reader) -> u256 {
    let mut hasher = HasherImpl::new();
    hasher.push_u8(MERKLE_LEAF_PREFIX);
    hasher.push_reader(ref reader);
    hasher.finalize() / ONE_SHIFT_96
}

fn node_hash(a: u256, b: u256) -> u256 {
    let mut hasher = HasherImpl::new();
    hasher.push_u8(MERKLE_NODE_PREFIX);
    hasher.push_u160(min(a, b));
    hasher.push_u160(max(a, b));
    hasher.finalize() / ONE_SHIFT_96
}

pub fn read_and_verify_proof(root_digest: u256, message: @ByteBuffer, ref reader: Reader) {
    let mut message_reader = ReaderImpl::new(message.clone());
    let mut current_hash = leaf_hash(message_reader.clone());

    let proof_size = reader.read_u8();
    let mut i = 0;

    while i < proof_size {
        let sibling_digest = reader.read_u160();
        current_hash = node_hash(current_hash, sibling_digest);
        i += 1;
    }

    if root_digest != current_hash {
        panic_with_felt252(MerkleVerificationError::DigestMismatch.into());
    }
}
