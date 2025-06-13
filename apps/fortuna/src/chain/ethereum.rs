use {
    crate::{
        api::ChainId,
        chain::reader::{
            self, BlockNumber, BlockStatus, EntropyReader, EntropyRequestInfo,
            RequestedWithCallbackEvent,
        },
        config::EthereumConfig,
        eth_utils::{
            eth_gas_oracle::EthProviderOracle,
            legacy_tx_middleware::LegacyTxMiddleware,
            nonce_manager::NonceManagerMiddleware,
            traced_client::{RpcMetrics, TracedClient},
        },
    },
    anyhow::{anyhow, Error, Result},
    axum::async_trait,
    ethers::{
        abi::RawLog,
        contract::{abigen, EthLogDecode, LogMeta},
        core::types::Address,
        middleware::{gas_oracle::GasOracleMiddleware, SignerMiddleware},
        prelude::JsonRpcClient,
        providers::{Http, Middleware, Provider},
        signers::{LocalWallet, Signer},
        types::{BlockNumber as EthersBlockNumber, U256},
    },
    sha3::{Digest, Keccak256},
    std::sync::Arc,
};

// TODO: Programmatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(
    PythRandom,
    "../../target_chains/ethereum/entropy_sdk/solidity/abis/IEntropy.json";
    PythRandomErrors,
    "../../target_chains/ethereum/entropy_sdk/solidity/abis/EntropyErrors.json"
);

pub type MiddlewaresWrapper<T> = LegacyTxMiddleware<
    GasOracleMiddleware<
        NonceManagerMiddleware<SignerMiddleware<Provider<T>, LocalWallet>>,
        EthProviderOracle<Provider<T>>,
    >,
>;

pub type SignablePythContractInner<T> = PythRandom<MiddlewaresWrapper<T>>;
pub type SignablePythContract = SignablePythContractInner<Http>;
pub type InstrumentedSignablePythContract = SignablePythContractInner<TracedClient>;

pub type PythContract = PythRandom<Provider<Http>>;
pub type InstrumentedPythContract = PythRandom<Provider<TracedClient>>;

impl<T: JsonRpcClient + 'static + Clone> SignablePythContractInner<T> {
    /// Get the wallet that signs transactions sent to this contract.
    pub fn wallet(&self) -> LocalWallet {
        self.client().inner().inner().inner().signer().clone()
    }

    /// Get the underlying provider that communicates with the blockchain.
    pub fn provider(&self) -> Provider<T> {
        self.client().inner().inner().inner().provider().clone()
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
    ) -> Result<u64> {
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
            if let PythRandomEvents::Requested1Filter(r) = PythRandomEvents::decode_log(&l)? {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    /// Submit a request for a random number to the contract.
    ///
    /// This method is a version of the autogenned `request` method that parses the emitted logs
    /// to return the sequence number of the created Request.
    pub async fn request_with_callback_wrapper(
        &self,
        provider: &Address,
        user_randomness: &[u8; 32],
    ) -> Result<u64> {
        let fee = self.get_fee(*provider).call().await?;

        if let Some(r) = self
            .request_with_callback(*provider, *user_randomness)
            .value(fee)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PythRandomEvents::RequestedWithCallbackFilter(r) =
                PythRandomEvents::decode_log(&l)?
            {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number"))
            }
        } else {
            Err(anyhow!("Request failed"))
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
    ) -> Result<[u8; 32]> {
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
            if let PythRandomEvents::Revealed1Filter(r) =
                PythRandomEvents::decode_log(&r.logs[0].clone().into())?
            {
                Ok(r.random_number)
            } else {
                Err(anyhow!("No log with randomnumber"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    pub fn from_config_and_provider_and_network_id(
        chain_config: &EthereumConfig,
        private_key: &str,
        provider: Provider<T>,
        network_id: u64,
    ) -> Result<SignablePythContractInner<T>> {
        let gas_oracle =
            EthProviderOracle::new(provider.clone(), chain_config.priority_fee_multiplier_pct);
        let wallet__ = private_key
            .parse::<LocalWallet>()?
            .with_chain_id(network_id);

        let address = wallet__.address();

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(LegacyTxMiddleware::new(
                chain_config.legacy_tx,
                GasOracleMiddleware::new(
                    NonceManagerMiddleware::new(SignerMiddleware::new(provider, wallet__), address),
                    gas_oracle,
                ),
            )),
        ))
    }

    pub async fn from_config_and_provider(
        chain_config: &EthereumConfig,
        private_key: &str,
        provider: Provider<T>,
    ) -> Result<SignablePythContractInner<T>> {
        let network_id = provider.get_chainid().await?.as_u64();
        Self::from_config_and_provider_and_network_id(
            chain_config,
            private_key,
            provider,
            network_id,
        )
    }
}

impl SignablePythContract {
    pub async fn from_config(chain_config: &EthereumConfig, private_key: &str) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
        Self::from_config_and_provider(chain_config, private_key, provider).await
    }
}

impl InstrumentedSignablePythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        private_key: &str,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
        network_id: u64,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;
        Self::from_config_and_provider_and_network_id(
            chain_config,
            private_key,
            provider,
            network_id,
        )
    }
}

impl PythContract {
    pub fn from_config(chain_config: &EthereumConfig) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl InstrumentedPythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl<T: JsonRpcClient + 'static> PythRandom<Provider<T>> {
    pub async fn get_network_id(&self) -> Result<U256> {
        let chain_id = self.client().get_chainid().await?;
        Ok(chain_id)
    }
}

#[async_trait]
impl<T: JsonRpcClient + 'static> EntropyReader for PythRandom<Provider<T>> {
    async fn get_request(
        &self,
        provider_address: Address,
        sequence_number: u64,
    ) -> Result<Option<reader::Request>> {
        let r = self
            .get_request(provider_address, sequence_number)
            // TODO: This doesn't work for lighlink right now. Figure out how to do this in lightlink
            // .block(ethers::core::types::BlockNumber::Finalized)
            .call()
            .await?;

        // sequence_number == 0 means the request does not exist.
        if r.sequence_number != 0 {
            Ok(Some(reader::Request {
                provider: r.provider,
                sequence_number: r.sequence_number,
                block_number: r.block_number,
                use_blockhash: r.use_blockhash,
            }))
        } else {
            Ok(None)
        }
    }

    async fn get_block_number(&self, confirmed_block_status: BlockStatus) -> Result<BlockNumber> {
        let block_number: EthersBlockNumber = confirmed_block_status.into();
        let block = self
            .client()
            .get_block(block_number)
            .await?
            .ok_or_else(|| Error::msg("pending block confirmation"))?;

        Ok(block
            .number
            .ok_or_else(|| Error::msg("pending confirmation"))?
            .as_u64())
    }

    async fn get_request_with_callback_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
        provider: Address,
    ) -> Result<Vec<RequestedWithCallbackEvent>> {
        let mut event = self.requested_with_callback_filter();
        event.filter = event
            .filter
            .address(self.address())
            .from_block(from_block)
            .to_block(to_block)
            .topic1(provider);

        let res: Vec<(RequestedWithCallbackFilter, LogMeta)> = event.query_with_meta().await?;
        Ok(res
            .into_iter()
            .map(|(r, meta)| RequestedWithCallbackEvent {
                sequence_number: r.sequence_number,
                user_random_number: r.user_random_number,
                provider_address: r.request.provider,
                requestor: r.requestor,
                request: EntropyRequestInfo {
                    provider: r.request.provider,
                    sequence_number: r.request.sequence_number,
                    num_hashes: r.request.num_hashes,
                    commitment: r.request.commitment,
                    block_number: r.request.block_number,
                    requester: r.request.requester,
                    use_blockhash: r.request.use_blockhash,
                    is_request_with_callback: r.request.is_request_with_callback,
                },
                log_meta: meta,
            })
            .filter(|r| r.provider_address == provider)
            .collect())
    }

    async fn estimate_reveal_with_callback_gas(
        &self,
        sender: Address,
        provider: Address,
        sequence_number: u64,
        user_random_number: [u8; 32],
        provider_revelation: [u8; 32],
    ) -> Result<U256> {
        let result = self
            .reveal_with_callback(
                provider,
                sequence_number,
                user_random_number,
                provider_revelation,
            )
            .from(sender)
            .estimate_gas()
            .await;

        result.map_err(|e| e.into())
    }
}
