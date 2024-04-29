use super::hash::{Hasher, HasherImpl};
use super::reader::{Reader, ReaderImpl};
use super::byte_array::ByteArray;
use super::util::ONE_SHIFT_96;
use core::cmp::{min, max};

const MERKLE_LEAF_PREFIX: u8 = 0;
const MERKLE_NODE_PREFIX: u8 = 1;
const MERKLE_EMPTY_LEAF_PREFIX: u8 = 2;

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum MerkleVerificationError {
    Reader: super::reader::Error,
    DigestMismatch,
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

fn leaf_hash(mut reader: Reader) -> Result<u256, super::reader::Error> {
    let mut hasher = HasherImpl::new();
    hasher.push_u8(MERKLE_LEAF_PREFIX);
    hasher.push_reader(ref reader)?;
    let hash = hasher.finalize() / ONE_SHIFT_96;
    Result::Ok(hash)
}

fn node_hash(a: u256, b: u256) -> u256 {
    let mut hasher = HasherImpl::new();
    hasher.push_u8(MERKLE_NODE_PREFIX);
    hasher.push_u160(min(a, b));
    hasher.push_u160(max(a, b));
    hasher.finalize() / ONE_SHIFT_96
}

pub fn read_and_verify_proof(
    root_digest: u256, message: @ByteArray, ref reader: Reader
) -> Result<(), MerkleVerificationError> {
    let mut message_reader = ReaderImpl::new(message.clone());
    let mut current_hash = leaf_hash(message_reader.clone()).map_err()?;

    let proof_size = reader.read_u8().map_err()?;
    let mut i = 0;

    let mut result = Result::Ok(());
    while i < proof_size {
        match reader.read_u160().map_err() {
            Result::Ok(sibling_digest) => {
                current_hash = node_hash(current_hash, sibling_digest);
            },
            Result::Err(err) => {
                result = Result::Err(err);
                break;
            },
        }
        i += 1;
    };
    result?;

    if root_digest != current_hash {
        return Result::Err(MerkleVerificationError::DigestMismatch);
    }
    Result::Ok(())
}
