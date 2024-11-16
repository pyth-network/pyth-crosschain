#[cfg(not(feature = "solana-program"))]
use sha3::{Digest, Keccak256};
#[cfg(feature = "solana-program")]
use solana_program::keccak::hashv;
use {crate::hashers::Hasher, serde::Serialize};

#[derive(Clone, Default, Debug, Eq, Hash, PartialEq, Serialize)]
pub struct Keccak160 {}

impl Hasher for Keccak160 {
    type Hash = [u8; 20];

    #[cfg(feature = "solana-program")]
    fn hashv(data: &[impl AsRef<[u8]>]) -> Self::Hash {
        let bytes = hashv(&data.iter().map(|x| x.as_ref()).collect::<Vec<&[u8]>>());
        let mut hash = [0u8; 20];
        hash.copy_from_slice(&bytes.as_ref()[0..20]);
        hash
    }

    #[cfg(not(feature = "solana-program"))]
    fn hashv(data: &[impl AsRef<[u8]>]) -> [u8; 20] {
        let mut hasher = Keccak256::new();
        data.iter().for_each(|d| hasher.update(d));
        let bytes: [u8; 32] = hasher.finalize().into();
        let mut hash = [0u8; 20];
        hash.copy_from_slice(&bytes[0..20]);
        hash
    }
}
