use pythnet_sdk::accumulators::merkle::MerkleTree;
use pythnet_sdk::hashers::keccak256_160::Keccak160;
use sha3::Digest;
use sha3::Keccak256;

#[derive(Debug)]
pub struct Tree {
    pub start:  usize,
    pub size:   usize,
    pub proofs: MerkleTree<Keccak160>,
    pub range:  RandomHashChain,
}

impl Tree {
    pub fn new(secret: &str, start: usize, size: usize) -> Self {
        let range = RandomHashChain::new(secret, start, size);
        let randomness = range.as_ref();
        let proofs = MerkleTree::new(&randomness).unwrap();
        Self {
            start,
            size,
            proofs,
            range,
        }
    }
}

#[derive(Debug)]
pub struct RandomHashChain {
    pub range: Vec<[u8; 40]>,
}

impl RandomHashChain {
    pub fn new(secret: &str, mut start: usize, len: usize) -> Self {
        // Construct a buffer of random numbers.
        let mut range: Vec<[u8; 40]> = vec![[0; 40]; len];

        // Initial seed, which is the contatenation of the bytes of the secret, the start, and
        // the size, which we hash with Keccak256.
        let mut seed = secret.as_bytes().to_vec();
        seed.extend_from_slice(&start.to_be_bytes());
        seed.extend_from_slice(&len.to_be_bytes());
        let mut hasher = Keccak256::new();
        hasher.update(&seed);
        let mut hash: [u8; 32] = hasher.finalize().into();

        // For each entry in the range, we populate the first 8 bytes with the `start`, and
        // the final 32 bytes with the Keccak256 hash of the previous entry.
        range.iter_mut().for_each(|x| {
            hash = Keccak256::digest(hash).into();
            x[0..8].copy_from_slice(&start.to_be_bytes());
            x[8..].copy_from_slice(&hash);
            start += 1;
        });

        Self { range }
    }

    pub fn as_ref(&self) -> Vec<&[u8]> {
        self.range
            .iter()
            .map(|x| x.as_ref())
            .collect::<Vec<&[u8]>>()
    }
}
