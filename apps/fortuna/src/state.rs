use {
    crate::{
        api::ChainId,
        keeper::keeper_metrics::{AccountLabel, KeeperMetrics},
    },
    anyhow::{ensure, Result},
    ethers::types::Address,
    sha3::{Digest, Keccak256},
    std::sync::Arc,
    tokio::task::spawn_blocking,
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

    fn generate_secret(
        secret: &str,
        chain_id: &ChainId,
        provider_address: &Address,
        contract_address: &Address,
        random: &[u8; 32],
    ) -> Result<[u8; 32]> {
        let mut input: Vec<u8> = vec![];
        input.extend_from_slice(&hex::decode(secret.trim())?);
        input.extend_from_slice(chain_id.as_bytes());
        input.extend_from_slice(provider_address.as_bytes());
        input.extend_from_slice(contract_address.as_bytes());
        input.extend_from_slice(random);
        let secret: [u8; 32] = Keccak256::digest(input).into();
        Ok(secret)
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
        let secret: [u8; 32] =
            Self::generate_secret(secret, chain_id, provider_address, contract_address, random)?;
        Ok(Self::new(
            secret,
            chain_length.try_into()?,
            sample_interval.try_into()?,
        ))
    }

    /// Asynchronous version of `from_config` that runs the computation in a blocking thread.
    pub async fn from_config_async(
        secret: &str,
        chain_id: &ChainId,
        provider_address: &Address,
        contract_address: &Address,
        random: &[u8; 32],
        chain_length: u64,
        sample_interval: u64,
    ) -> Result<Self> {
        let secret: [u8; 32] =
            Self::generate_secret(secret, chain_id, provider_address, contract_address, random)?;
        let chain_length: usize = chain_length.try_into()?;
        let sample_interval: usize = sample_interval.try_into()?;
        let hash_chain = spawn_blocking(move || Self::new(secret, chain_length, sample_interval))
            .await
            .expect("Failed to make hash chain");

        Ok(hash_chain)
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
    offsets: Vec<usize>,
    hash_chains: Vec<PebbleHashChain>,
}

impl HashChainState {
    pub fn new(offsets: Vec<usize>, hash_chains: Vec<PebbleHashChain>) -> Result<HashChainState> {
        if offsets.len() != hash_chains.len() {
            return Err(anyhow::anyhow!(
                "Offsets and hash chains must have the same length."
            ));
        }
        Ok(HashChainState {
            offsets,
            hash_chains,
        })
    }
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

pub struct MonitoredHashChainState {
    hash_chain_state: Arc<HashChainState>,
    metrics: Arc<KeeperMetrics>,
    account_label: AccountLabel,
}
impl MonitoredHashChainState {
    pub fn new(
        hash_chain_state: Arc<HashChainState>,
        metrics: Arc<KeeperMetrics>,
        chain_id: ChainId,
        provider_address: Address,
    ) -> Self {
        Self {
            hash_chain_state,
            metrics,
            account_label: AccountLabel {
                chain_id,
                address: provider_address.to_string(),
            },
        }
    }

    pub fn reveal(&self, sequence_number: u64) -> Result<[u8; 32]> {
        let res = self.hash_chain_state.reveal(sequence_number);
        if res.is_ok() {
            let metric = self
                .metrics
                .highest_revealed_sequence_number
                .get_or_create(&self.account_label);
            if metric.get() < sequence_number as i64 {
                metric.set(sequence_number as i64);
            }
        }
        res
    }
}

#[cfg(test)]
mod test {
    use {
        crate::{
            keeper::keeper_metrics::{AccountLabel, KeeperMetrics},
            state::{HashChainState, MonitoredHashChainState, PebbleHashChain},
        },
        anyhow::Result,
        ethers::types::Address,
        sha3::{Digest, Keccak256},
        std::{sync::Arc, vec},
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

    #[test]
    fn test_hash_chain_state_from_chain_at_offset() {
        let chain = PebbleHashChain::new([0u8; 32], 10, 1);
        let hash_chain_state = HashChainState::from_chain_at_offset(5, chain);

        assert_eq!(hash_chain_state.offsets.len(), 1);
        assert_eq!(hash_chain_state.hash_chains.len(), 1);
        assert_eq!(hash_chain_state.offsets[0], 5);
    }

    #[test]
    fn test_hash_chain_state_reveal_valid_sequence() -> Result<()> {
        let chain = PebbleHashChain::new([0u8; 32], 10, 1);
        let expected_hash = chain.reveal_ith(3)?;

        let hash_chain_state = HashChainState::from_chain_at_offset(5, chain);
        let result = hash_chain_state.reveal(8)?;

        assert_eq!(result, expected_hash);
        Ok(())
    }

    #[test]
    fn test_hash_chain_state_reveal_sequence_too_small() {
        let chain = PebbleHashChain::new([0u8; 32], 10, 1);
        let hash_chain_state = HashChainState::from_chain_at_offset(5, chain);

        let result = hash_chain_state.reveal(4);
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_chain_state_reveal_sequence_too_large() {
        let chain = PebbleHashChain::new([0u8; 32], 10, 1);
        let hash_chain_state = HashChainState::from_chain_at_offset(5, chain);

        let result = hash_chain_state.reveal(15);
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_chain_state_multiple_chains() -> Result<()> {
        let chain1 = PebbleHashChain::new([0u8; 32], 10, 1);
        let expected_hash1 = chain1.reveal_ith(3)?;

        let chain2 = PebbleHashChain::new([1u8; 32], 10, 1);
        let expected_hash2 = chain2.reveal_ith(3)?;

        let hash_chain_state = HashChainState {
            offsets: vec![5, 20],
            hash_chains: vec![chain1, chain2],
        };

        let result1 = hash_chain_state.reveal(8)?;
        assert_eq!(result1, expected_hash1);

        let result2 = hash_chain_state.reveal(23)?;
        assert_eq!(result2, expected_hash2);

        let result_boundary = hash_chain_state.reveal(20)?;
        let expected_boundary = hash_chain_state.hash_chains[1].reveal_ith(0)?;
        assert_eq!(result_boundary, expected_boundary);

        let result3 = hash_chain_state.reveal(15);
        assert!(result3.is_err());

        Ok(())
    }

    #[test]
    fn test_hash_chain_state_overlapping_chains() -> Result<()> {
        let chain1 = PebbleHashChain::new([0u8; 32], 10, 1);
        let chain2 = PebbleHashChain::new([1u8; 32], 10, 1);

        let hash_chain_state = HashChainState {
            offsets: vec![5, 10],
            hash_chains: vec![chain1, chain2],
        };

        let result1 = hash_chain_state.reveal(8)?;
        let expected1 = hash_chain_state.hash_chains[0].reveal_ith(3)?;
        assert_eq!(result1, expected1);

        // returns the first offset that is > sequence_number)
        let result2 = hash_chain_state.reveal(12)?;
        let expected2 = hash_chain_state.hash_chains[1].reveal_ith(2)?;
        assert_eq!(result2, expected2);

        Ok(())
    }
    #[test]
    fn test_inconsistent_lengths() -> Result<()> {
        let chain1 = PebbleHashChain::new([0u8; 32], 10, 1);
        let chain2 = PebbleHashChain::new([1u8; 32], 10, 1);

        let hash_chain_state = HashChainState::new(vec![5], vec![chain1.clone(), chain2.clone()]);
        assert!(hash_chain_state.is_err());
        let hash_chain_state = HashChainState::new(vec![5, 10], vec![chain1.clone()]);
        assert!(hash_chain_state.is_err());
        let hash_chain_state =
            HashChainState::new(vec![5, 10], vec![chain1.clone(), chain2.clone()]);
        assert!(hash_chain_state.is_ok());

        Ok(())
    }

    #[test]
    fn test_highest_revealed_sequence_number() {
        let chain = PebbleHashChain::new([0u8; 32], 100, 1);
        let hash_chain_state = HashChainState::new(vec![0], vec![chain]).unwrap();
        let metrics = Arc::new(KeeperMetrics::default());
        let provider = Address::random();
        let monitored = MonitoredHashChainState::new(
            Arc::new(hash_chain_state),
            metrics.clone(),
            "ethereum".to_string(),
            provider,
        );
        let label = AccountLabel {
            chain_id: "ethereum".to_string(),
            address: provider.to_string(),
        };

        assert!(monitored.reveal(5).is_ok());
        let current = metrics
            .highest_revealed_sequence_number
            .get_or_create(&label)
            .get();
        assert_eq!(current, 5);

        assert!(monitored.reveal(15).is_ok());
        let current = metrics
            .highest_revealed_sequence_number
            .get_or_create(&label)
            .get();
        assert_eq!(current, 15);

        assert!(monitored.reveal(10).is_ok());
        let current = metrics
            .highest_revealed_sequence_number
            .get_or_create(&label)
            .get();
        assert_eq!(current, 15);

        assert!(monitored.reveal(1000).is_err());
        let current = metrics
            .highest_revealed_sequence_number
            .get_or_create(&label)
            .get();
        assert_eq!(current, 15);
    }
}
