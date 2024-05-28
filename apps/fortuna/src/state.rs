use {
    crate::api::ChainId,
    anyhow::{
        ensure,
        Result,
    },
    ethers::types::Address,
    sha3::{
        Digest,
        Keccak256,
    },
};

/// A HashChain.
#[derive(Clone)]
pub struct PebbleHashChain {
    hash:            Vec<[u8; 32]>,
    sample_interval: usize,
    length:          usize,
}

impl PebbleHashChain {
    // Given a secret, we hash it with Keccak256 len times to get the final hash, this is an S/KEY
    // like protocol in which revealing the hashes in reverse proves knowledge.
    pub fn new(secret: [u8; 32], length: usize) -> Self {
        Self::new_with_interval(secret, length, 1)
    }

    pub fn new_with_interval(secret: [u8; 32], length: usize, sample_interval: usize) -> Self {
        let mut hash = Vec::<[u8; 32]>::with_capacity(length);
        let mut current: [u8; 32] = Keccak256::digest(secret).into();

        let sampled_chain_length = (length / sample_interval) * sample_interval + 1;

        hash.push(current.clone());
        for i in 1..sampled_chain_length {
            current = Keccak256::digest(&current).into();
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
        // sample_interval: usize,
    ) -> Result<Self> {
        let mut input: Vec<u8> = vec![];
        input.extend_from_slice(&hex::decode(secret.trim())?);
        input.extend_from_slice(&chain_id.as_bytes());
        input.extend_from_slice(&provider_address.as_bytes());
        input.extend_from_slice(&contract_address.as_bytes());
        input.extend_from_slice(random);

        // TODO
        let sample_interval: usize = 1;

        let secret: [u8; 32] = Keccak256::digest(input).into();
        Ok(Self::new_with_interval(
            secret,
            chain_length.try_into()?,
            sample_interval,
        ))
    }

    pub fn reveal_ith(&self, i: usize) -> Result<[u8; 32]> {
        ensure!(i < self.len(), "index not in range");
        let closest_index = (i / self.sample_interval) + 1;
        let mut i_index = closest_index * self.sample_interval;
        let mut val = self.hash[closest_index].clone();

        while i_index > i {
            val = Keccak256::digest(val).into();
            i_index -= 1;
        }

        Ok(val)
    }

    pub fn len(&self) -> usize {
        self.length
    }
}

/// `HashChainState` tracks the mapping between on-chain sequence numbers to hash chains.
/// This struct is required to handle the case where the provider rotates their commitment,
/// which requires tracking multiple hash chains here.
pub struct HashChainState {
    // The sequence number where the hash chain starts. Must be stored in sorted order.
    pub offsets:     Vec<usize>,
    pub hash_chains: Vec<PebbleHashChain>,
}

impl HashChainState {
    pub fn from_chain_at_offset(offset: usize, chain: PebbleHashChain) -> HashChainState {
        HashChainState {
            offsets:     vec![offset],
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

mod test {

    use {
        crate::state::PebbleHashChain,
        sha3::{
            Digest,
            Keccak256,
        },
    };


    #[test]
    fn test_hash_chain() {
        let secret = [0u8; 32];
        let chain = PebbleHashChain::new_with_interval(secret, 100, 2);
        let unsampled_chain = PebbleHashChain::new_with_interval(secret, 100, 1);

        for i in 0..10 {
            println!("{} {:?}", i, unsampled_chain.reveal_ith(i).unwrap());
        }

        for i in 0..10 {
            println!("{} {:?}", i, chain.hash[i]);
        }

        let mut last_val = chain.reveal_ith(0).unwrap();
        for i in 1..chain.len() {
            println!("CHECKING {:?}", i);
            println!("{:?}", chain.reveal_ith(i).unwrap());

            let cur_val = chain.reveal_ith(i).unwrap();
            let expected_last_val: [u8; 32] = Keccak256::digest(cur_val).into();

            assert_eq!(expected_last_val, last_val);
            last_val = cur_val;
        }
    }
}
