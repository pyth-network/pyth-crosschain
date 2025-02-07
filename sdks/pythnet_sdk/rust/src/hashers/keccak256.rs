use {
    crate::hashers::Hasher,
    serde::Serialize,
    sha3::{Digest, Keccak256 as Keccak256Digest},
};

#[derive(Clone, Default, Debug, Eq, PartialEq, Serialize)]
pub struct Keccak256 {}

impl Hasher for Keccak256 {
    type Hash = [u8; 32];

    fn hashv(data: &[impl AsRef<[u8]>]) -> [u8; 32] {
        let mut hasher = Keccak256Digest::new();
        data.iter().for_each(|d| hasher.update(d));
        hasher.finalize().into()
    }
}

#[cfg(test)]
mod tests {
    use {super::*, crate::hashers::Hasher};

    #[test]
    fn test_keccak256() {
        let data = b"helloworld";
        let hash_a = Keccak256::hashv(&[data]);

        let data = [b"hello", b"world"];
        let hash_b = Keccak256::hashv(&data);

        assert_eq!(hash_a, hash_b);
    }
}
