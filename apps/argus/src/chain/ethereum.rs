use {
    crate::{
        api::ChainId,
        chain::reader::{self, BlockNumber, BlockStatus, PulseReader, RequestedWithCallbackEvent},
        config::EthereumConfig,
    },
    anyhow::{anyhow, Error, Result},
    axum::async_trait,
    ethers::{
        abi::RawLog,
        contract::{abigen, EthLogDecode},
        core::types::Address,
        middleware::{gas_oracle::GasOracleMiddleware, SignerMiddleware},
        prelude::JsonRpcClient,
        providers::{Http, Middleware, Provider},
        signers::{LocalWallet, Signer},
        types::{BlockNumber as EthersBlockNumber, U256},
    },
    fortuna::eth_utils::{
        eth_gas_oracle::EthProviderOracle,
        legacy_tx_middleware::LegacyTxMiddleware,
        nonce_manager::NonceManagerMiddleware,
        traced_client::{RpcMetrics, TracedClient},
    },
    std::sync::Arc,
};

// TODO: Programmatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(
    Pulse,
    "../../target_chains/ethereum/contracts/out/IPulse.sol/IPulse.abi.json"
);

pub type MiddlewaresWrapper<T> = LegacyTxMiddleware<
    GasOracleMiddleware<
        NonceManagerMiddleware<SignerMiddleware<Provider<T>, LocalWallet>>,
        EthProviderOracle<Provider<T>>,
    >,
>;

pub type SignablePythContractInner<T> = Pulse<MiddlewaresWrapper<T>>;
pub type SignablePythContract = SignablePythContractInner<Http>;
pub type InstrumentedSignablePythContract = SignablePythContractInner<TracedClient>;

pub type PythContract = Pulse<Provider<Http>>;
pub type InstrumentedPythContract = Pulse<Provider<TracedClient>>;

impl<T: JsonRpcClient + 'static + Clone> SignablePythContractInner<T> {
    /// Get the wallet that signs transactions sent to this contract.
    pub fn wallet(&self) -> LocalWallet {
        self.client().inner().inner().inner().signer().clone()
    }

    /// Get the underlying provider that communicates with the blockchain.
    pub fn provider(&self) -> Provider<T> {
        self.client().inner().inner().inner().provider().clone()
    }

    /// Submit a request for price updates to the contract.
    ///
    /// This method is a version of the autogenned `requestPriceUpdatesWithCallback` method that parses the emitted logs
    /// to return the sequence number of the created Request.
    pub async fn request_price_updates_wrapper(
        &self,
        publish_time: U256,
        price_ids: Vec<[u8; 32]>,
        callback_gas_limit: U256,
    ) -> Result<u64> {
        let fee = self.get_fee(callback_gas_limit).call().await?;

        if let Some(r) = self
            .request_price_updates_with_callback(publish_time, price_ids, callback_gas_limit)
            .value(fee)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PulseEvents::PriceUpdateRequestedFilter(r) = PulseEvents::decode_log(&l)? {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    /// Execute the callback for a price update request.
    ///
    /// This method is a version of the autogenned `executeCallback` method that parses the emitted logs
    /// to return the updated price IDs.
    pub async fn execute_callback_wrapper(
        &self,
        sequence_number: u64,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
    ) -> Result<Vec<[u8; 32]>> {
        if let Some(r) = self
            .execute_callback(
                sequence_number,
                update_data
                    .into_iter()
                    .map(ethers::types::Bytes::from)
                    .collect(),
                price_ids.clone(),
            )
            .send()
            .await?
            .await?
        {
            if let PulseEvents::PriceUpdateExecutedFilter(r) =
                PulseEvents::decode_log(&r.logs[0].clone().into())?
            {
                Ok(r.price_ids.to_vec())
            } else {
                Err(anyhow!("No log with price updates"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    pub async fn from_config_and_provider(
        chain_config: &EthereumConfig,
        private_key: &str,
        provider: Provider<T>,
    ) -> Result<SignablePythContractInner<T>> {
        let chain_id = provider.get_chainid().await?;
        let gas_oracle =
            EthProviderOracle::new(provider.clone(), chain_config.priority_fee_multiplier_pct);
        let wallet__ = private_key
            .parse::<LocalWallet>()?
            .with_chain_id(chain_id.as_u64());

        let address = wallet__.address();

        Ok(Pulse::new(
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
}

impl SignablePythContract {
    pub async fn from_config(chain_config: &EthereumConfig, private_key: &str) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
        Self::from_config_and_provider(chain_config, private_key, provider).await
    }
}

impl InstrumentedSignablePythContract {
    pub async fn from_config(
        chain_config: &EthereumConfig,
        private_key: &str,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;
        Self::from_config_and_provider(chain_config, private_key, provider).await
    }
}

impl PythContract {
    pub fn from_config(chain_config: &EthereumConfig) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;

        Ok(Pulse::new(chain_config.contract_addr, Arc::new(provider)))
    }
}

impl InstrumentedPythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;

        Ok(Pulse::new(chain_config.contract_addr, Arc::new(provider)))
    }
}

#[async_trait]
impl<T: JsonRpcClient + 'static> PulseReader for Pulse<Provider<T>> {
    async fn get_request(&self, sequence_number: u64) -> Result<Option<reader::Request>> {
        let r = self
            .get_request(sequence_number)
            // TODO: This doesn't work for lighlink right now. Figure out how to do this in lightlink
            // .block(ethers::core::types::BlockNumber::Finalized)
            .call()
            .await?;

        // sequence_number == 0 means the request does not exist.
        if r.sequence_number != 0 {
            Ok(Some(reader::Request {
                requester: r.requester,
                sequence_number: r.sequence_number,
                callback_gas_limit: r.callback_gas_limit,
                price_ids: r.price_ids.to_vec(),
                publish_time: r.publish_time,
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

    async fn get_price_update_requested_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
    ) -> Result<Vec<RequestedWithCallbackEvent>> {
        let mut event = self.price_update_requested_filter();
        event.filter = event.filter.from_block(from_block).to_block(to_block);

        let res: Vec<PriceUpdateRequestedFilter> = event.query().await?;

        Ok(res
            .iter()
            .map(|r| RequestedWithCallbackEvent {
                sequence_number: r.request.sequence_number,
                requester: r.request.requester,
                price_ids: r.price_ids.to_vec(),
                callback_gas_limit: r.request.callback_gas_limit,
            })
            .collect())
    }

    async fn estimate_execute_callback_gas(
        &self,
        sender: Address,
        sequence_number: u64,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
    ) -> Result<U256> {
        let result = self
            .execute_callback(
                sequence_number,
                update_data
                    .into_iter()
                    .map(ethers::types::Bytes::from)
                    .collect(),
                price_ids,
            )
            .from(sender)
            .estimate_gas()
            .await;

        result.map_err(|e| e.into())
    }
}

impl<T: JsonRpcClient + 'static> Pulse<Provider<T>> {
    /// Get the current sequence number from the contract.
    ///
    /// This method directly accesses the contract's storage to get the currentSequenceNumber.
    pub async fn get_current_sequence_number(&self) -> Result<u64> {
        // The currentSequenceNumber is stored in the State struct at slot 0, offset 32 bytes
        // (after admin, pythFeeInWei, accruedFeesInWei, and pyth)
        let storage_slot = ethers::types::H256::zero();
        let storage_value = self.client().get_storage_at(
            self.address(),
            storage_slot,
            None,
        ).await?;

        // H256 is always 32 bytes, so we don't need to check the length

        // The currentSequenceNumber is stored at offset 32 bytes in the storage slot
        // Extract the last 8 bytes (u64) from the 32-byte value
        let mut u64_bytes = [0u8; 8];
        u64_bytes.copy_from_slice(&storage_value.as_bytes()[24..32]);

        Ok(u64::from_be_bytes(u64_bytes))
    }
}
