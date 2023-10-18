use {
    crate::{
        api::ChainId,
        config::ConfigOptions,
    },
    anyhow::anyhow,
    ethers::{
        abi::RawLog,
        contract::{
            abigen,
            EthLogDecode,
        },
        core::types::Address,
        middleware::SignerMiddleware,
        providers::{
            Http,
            Middleware,
            Provider,
        },
        signers::{
            LocalWallet,
            Signer,
        },
    },
    sha3::{
        Digest,
        Keccak256,
    },
    std::{
        error::Error,
        sync::Arc,
    },
};

// TODO: Programatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(PythRandom, "src/abi.json");

pub type SignablePythContract = PythRandom<SignerMiddleware<Provider<Http>, LocalWallet>>;
pub type PythContract = PythRandom<Provider<Http>>;

impl SignablePythContract {
    pub async fn from_opts(
        opts: &ConfigOptions,
        chain_id: &ChainId,
        private_key: &str,
    ) -> Result<SignablePythContract, Box<dyn Error>> {
        let chain_config = opts.load()?.get_chain_config(chain_id)?;
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
        let chain_id = provider.get_chainid().await?;

        let wallet__ = private_key
            .clone()
            .ok_or(anyhow!("No private key specified"))?
            .parse::<LocalWallet>()?
            .with_chain_id(chain_id.as_u64());

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(SignerMiddleware::new(provider, wallet__)),
        ))
    }

    /// Submit a request for a random number to the contract.
    ///
    /// This method is a version of the autogenned `request` method that parses the emitted logs
    /// to return the sequence number of the created Request.
    pub async fn request_wrapper(
        &self,
        provider: &Address,
        user_randomness: &[u8; 32],
        use_blockhash: bool,
    ) -> Result<u64, Box<dyn Error>> {
        let fee = self.get_fee(*provider).call().await?;

        let hashed_randomness: [u8; 32] = Keccak256::digest(user_randomness).into();

        if let Some(r) = self
            .request(*provider, hashed_randomness, use_blockhash)
            .value(fee)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PythRandomEvents::RequestedFilter(r) = PythRandomEvents::decode_log(&l)? {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number").into())
            }
        } else {
            Err(anyhow!("Request failed").into())
        }
    }

    /// Reveal the generated random number to the contract.
    ///
    /// This method is a version of the autogenned `reveal` method that parses the emitted logs
    /// to return the generated random number.
    pub async fn reveal_wrapper(
        &self,
        provider: &Address,
        sequence_number: u64,
        user_randomness: &[u8; 32],
        provider_randomness: &[u8; 32],
    ) -> Result<[u8; 32], Box<dyn Error>> {
        if let Some(r) = self
            .reveal(
                *provider,
                sequence_number,
                *user_randomness,
                *provider_randomness,
            )
            .send()
            .await?
            .await?
        {
            if let PythRandomEvents::RevealedFilter(r) =
                PythRandomEvents::decode_log(&r.logs[0].clone().into())?
            {
                Ok(r.random_number)
            } else {
                Err(anyhow!("No log with randomnumber").into())
            }
        } else {
            Err(anyhow!("Request failed").into())
        }
    }
}

impl PythContract {
    pub async fn from_opts(
        opts: &ConfigOptions,
        chain_id: &ChainId,
    ) -> Result<PythContract, Box<dyn Error>> {
        let chain_config = opts.load()?.get_chain_config(chain_id)?;
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
        let chain_id = provider.get_chainid().await?;

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}
