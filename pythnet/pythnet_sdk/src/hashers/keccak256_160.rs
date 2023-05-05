use {
    crate::hashers::Hasher,
    serde::Serialize,
    sha3::{
        Digest,
        Keccak256,
    },
};

#[derive(Clone, Default, Debug, Eq, PartialEq, Serialize)]
pub struct Keccak160 {}

impl Hasher for Keccak160 {
    type Hash = [u8; 20];

    fn hashv(data: &[impl AsRef<[u8]>]) -> [u8; 20] {
        let mut hasher = Keccak256::new();
        data.iter().for_each(|d| hasher.update(d));
        let bytes: [u8; 32] = hasher.finalize().into();
        let mut hash = [0u8; 20];
        hash.copy_from_slice(&bytes[0..20]);
        hash
    }
}
