use anyhow::ensure;
use anyhow::Result;
use sha3::Digest;
use sha3::Keccak256;

/// A HashChain.
pub struct PebbleHashChain<const N: usize> {
    hash: [[u8; 32]; N],
    next: usize,
}

impl<const N: usize> PebbleHashChain<N> {
    // Given a secret, we hash it with Keccak256 len times to get the final hash, this is an S/KEY
    // like protocol in which revealing the hashes in reverse proves knowledge.
    pub fn new(secret: [u8; 32]) -> Self {
        let mut hash = [[0; 32]; N];
        hash[N - 1] = Keccak256::digest(secret).into();
        for i in 1..N {
            hash[N - i - 1] = Keccak256::digest(hash[N - i]).into();
        }
        Self { hash, next: 0 }
    }

    /// Reveal the next hash in the chain using the previous proof.
    pub fn reveal(&mut self) -> Result<[u8; 32]> {
        ensure!(self.next < N, "no more hashes in the chain");
        let next = self.hash[self.next];
        self.next += 1;
        Ok(next)
    }

    pub fn reveal_ith(&self, i: usize) -> Result<[u8; 32]> {
        ensure!(i < N, "index not in range");
        Ok(self.hash[i])
    }
}
