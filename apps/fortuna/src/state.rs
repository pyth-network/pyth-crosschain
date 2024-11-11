use {
    crate::api::ChainId,
    anyhow::{ensure, Result},
    ethers::types::Address,
    sha3::{Digest, Keccak256},
};

/// A hash chain of a specific length. The hash chain has the property that
/// hash(chain.reveal_ith(i)) == chain.reveal_ith(i - 1)
///
/// The implementation subsamples the elements of the chain such that it uses less memory
/// to keep the chain around.
#[derive(Clone)]
pub struct PebbleHashChain {
    hash: Vec<[u8; 32]>,
    sample_interval: usize,
    length: usize,
}

impl PebbleHashChain {
    // Given a secret, we hash it with Keccak256 len times to get the final hash, this is an S/KEY
    // like protocol in which revealing the hashes in reverse proves knowledge.
    pub fn new(secret: [u8; 32], length: usize, sample_interval: usize) -> Self {
        assert!(sample_interval > 0, "Sample interval must be positive");
        let mut hash = Vec::<[u8; 32]>::with_capacity(length);
        let mut current: [u8; 32] = Keccak256::digest(secret).into();

        hash.push(current);
        for i in 1..length {
            current = Keccak256::digest(current).into();
            if i % sample_interval == 0 {
                hash.push(current);
            }
        }

        hash.reverse();

        Self {
            hash,
            sample_interval,
            length,
        }
    }

    pub fn from_config(
        secret: &str,
        chain_id: &ChainId,
        provider_address: &Address,
        contract_address: &Address,
        random: &[u8; 32],
        chain_length: u64,
        sample_interval: u64,
    ) -> Result<Self> {
        let mut input: Vec<u8> = vec![];
        input.extend_from_slice(&hex::decode(secret.trim())?);
        input.extend_from_slice(chain_id.as_bytes());
        input.extend_from_slice(provider_address.as_bytes());
        input.extend_from_slice(contract_address.as_bytes());
        input.extend_from_slice(random);

        let secret: [u8; 32] = Keccak256::digest(input).into();
        Ok(Self::new(
            secret,
            chain_length.try_into()?,
            sample_interval.try_into()?,
        ))
    }

    pub fn reveal_ith(&self, i: usize) -> Result<[u8; 32]> {
        ensure!(i < self.len(), "index not in range");

        // Note that subsample_interval may not perfectly divide length, in which case the uneven segment is
        // actually at the *front* of the list. Thus, it's easier to compute indexes from the end of the list.
        let index_from_end_of_subsampled_list = ((self.len() - 1) - i) / self.sample_interval;
        let mut i_index = self.len() - 1 - index_from_end_of_subsampled_list * self.sample_interval;
        let mut val = self.hash[self.hash.len() - 1 - index_from_end_of_subsampled_list];

        while i_index > i {
            val = Keccak256::digest(val).into();
            i_index -= 1;
        }

        Ok(val)
    }

    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> usize {
        self.length
    }
}

/// `HashChainState` tracks the mapping between on-chain sequence numbers to hash chains.
/// This struct is required to handle the case where the provider rotates their commitment,
/// which requires tracking multiple hash chains here.
pub struct HashChainState {
    // The sequence number where the hash chain starts. Must be stored in sorted order.
    pub offsets: Vec<usize>,
    pub hash_chains: Vec<PebbleHashChain>,
}

impl HashChainState {
    pub fn from_chain_at_offset(offset: usize, chain: PebbleHashChain) -> HashChainState {
        HashChainState {
            offsets: vec![offset],
            hash_chains: vec![chain],
        }
    }

    pub fn reveal(&self, sequence_number: u64) -> Result<[u8; 32]> {
        let sequence_number: usize = sequence_number.try_into()?;
        let chain_index = self
            .offsets
            .partition_point(|x| x <= &sequence_number)
            .checked_sub(1)
            .ok_or(anyhow::anyhow!(
                "Hash chain for the requested sequence number is not available."
            ))?;
        self.hash_chains[chain_index].reveal_ith(sequence_number - self.offsets[chain_index])
    }
}

#[cfg(test)]
mod test {
    use {
        crate::state::PebbleHashChain,
        sha3::{Digest, Keccak256},
    };

    fn run_hash_chain_test(secret: [u8; 32], length: usize, sample_interval: usize) {
        // Calculate the hash chain the naive way as a comparison point to the subsampled implementation.
        let mut basic_chain = Vec::<[u8; 32]>::with_capacity(length);
        let mut current: [u8; 32] = Keccak256::digest(secret).into();
        basic_chain.push(current);
        for _ in 1..length {
            current = Keccak256::digest(current).into();
            basic_chain.push(current);
        }

        basic_chain.reverse();

        let chain = PebbleHashChain::new(secret, length, sample_interval);

        let mut last_val = chain.reveal_ith(0).unwrap();

        #[allow(clippy::needless_range_loop)]
        for i in 1..length {
            let cur_val = chain.reveal_ith(i).unwrap();
            println!("{}", i);
            assert_eq!(basic_chain[i], cur_val);

            let expected_last_val: [u8; 32] = Keccak256::digest(cur_val).into();
            assert_eq!(expected_last_val, last_val);
            last_val = cur_val;
        }
    }

    #[test]
    fn test_hash_chain() {
        run_hash_chain_test([0u8; 32], 10, 1);
        run_hash_chain_test([0u8; 32], 10, 2);
        run_hash_chain_test([0u8; 32], 10, 3);
        run_hash_chain_test([1u8; 32], 10, 1);
        run_hash_chain_test([1u8; 32], 10, 2);
        run_hash_chain_test([1u8; 32], 10, 3);
        run_hash_chain_test([0u8; 32], 100, 1);
        run_hash_chain_test([0u8; 32], 100, 2);
        run_hash_chain_test([0u8; 32], 100, 3);
        run_hash_chain_test([0u8; 32], 100, 7);
        run_hash_chain_test([0u8; 32], 100, 50);
        run_hash_chain_test([0u8; 32], 100, 55);
    }
}
