use {
    super::chain::{
        ChainBlockNumber,
        ChainReader,
        ChainWriter,
        RequestWithCallbackData,
        RevealError,
    },
    crate::{
        chain::{
            chain::RevealSuccess,
            ethereum::{
                LegacyTxTransformer,
                PythRandom,
                RequestedWithCallbackFilter,
                SignablePythContract,
            },
        },
        config::EthereumConfig,
    },
    anyhow::{
        anyhow,
        Error,
        Result,
    },
    axum::async_trait,
    ethers::{
        middleware::{
            transformer::TransformerMiddleware,
            NonceManagerMiddleware,
            SignerMiddleware,
        },
        prelude::ContractError,
        providers::{
            Http,
            Middleware,
            Provider,
        },
        signers::{
            LocalWallet,
            Signer,
        },
        types::{
            Address,
            BlockNumber as EthersBlockNumber,
            U256,
        },
    },
    std::sync::Arc,
};

impl EthereumConfig {
    /// Instantiate a new chain writer to help interact with the chain.
    pub async fn get_writer(
        &self,
        provider_addr: Address,
        private_key: &str,
    ) -> Result<Box<dyn ChainWriter>> {
        let provider = Provider::<Http>::try_from(&self.geth_rpc_addr)?;
        let chain_id = provider.get_chainid().await?;

        let transformer = LegacyTxTransformer {
            use_legacy_tx: self.legacy_tx,
        };

        let wallet__ = private_key
            .parse::<LocalWallet>()?
            .with_chain_id(chain_id.as_u64());

        let address = wallet__.address();

        let contract = PythRandom::new(
            self.contract_addr,
            Arc::new(TransformerMiddleware::new(
                NonceManagerMiddleware::new(SignerMiddleware::new(provider, wallet__), address),
                transformer,
            )),
        );

        Ok(Box::new(EvmWriterContract {
            gas_limit: self.gas_limit,
            provider_addr,
            confirmed_block_status: self.confirmed_block_status.into(),
            reveal_delay_blocks: self.reveal_delay_blocks,
            contract,
        }))
    }
}


pub struct EvmWriterContract {
    provider_addr:          Address,
    confirmed_block_status: EthersBlockNumber,
    gas_limit:              U256,
    reveal_delay_blocks:    ChainBlockNumber,
    contract:               SignablePythContract,
}

#[async_trait]
impl ChainReader for EvmWriterContract {
    /// Returns data of all the requests with callback made on chain between
    /// the given block numbers.
    async fn get_requests_with_callback_data(
        &self,
        from_block: ChainBlockNumber,
        to_block: ChainBlockNumber,
    ) -> Result<Vec<RequestWithCallbackData>> {
        let mut event = self.contract.requested_with_callback_filter();
        event.filter = event.filter.from_block(from_block).to_block(to_block);

        let res: Vec<RequestedWithCallbackFilter> = event.query().await?;

        // Filter for provider_address
        let filtered_res = res
            .into_iter()
            .filter(|r| r.provider == self.provider_addr)
            .map(|r| RequestWithCallbackData {
                sequence_number:    r.sequence_number,
                user_random_number: r.user_random_number,
            })
            .collect();

        Ok(filtered_res)
    }

    /// Returns the latest block which is included into the chain and
    /// is safe from reorgs.
    async fn get_latest_safe_block(&self) -> Result<ChainBlockNumber> {
        let block_number: EthersBlockNumber = self.confirmed_block_status.into();
        let block = self
            .contract
            .client()
            .get_block(block_number)
            .await?
            .ok_or_else(|| Error::msg("pending block confirmation"))?;

        match block.number {
            Some(n) => Ok(n.as_u64().checked_sub(self.reveal_delay_blocks).unwrap()),
            None => Err(Error::msg("pending confirmation")),
        }
    }
}

#[async_trait]
impl ChainWriter for EvmWriterContract {
    /// Fulfill the given request on chain with the given provider revelation.
    async fn reveal_with_callback(
        &self,
        request_with_callback_data: RequestWithCallbackData,
        provider_revelation: [u8; 32],
    ) -> Result<RevealSuccess, RevealError> {
        let gas_estimate = self
            .contract
            .reveal_with_callback(
                self.provider_addr,
                request_with_callback_data.sequence_number,
                request_with_callback_data.user_random_number,
                provider_revelation,
            )
            .estimate_gas()
            .await
            .map_err(|e| match e {
                ContractError::ProviderError { e } => RevealError::RpcError(e.into()),
                ContractError::Revert(reason) => RevealError::ContractError(anyhow!(reason)),
                _ => RevealError::Unknown(anyhow!(e)),
            })?;

        let gas_estimate = EvmWriterContract::pad_gas(gas_estimate);
        if gas_estimate > self.gas_limit {
            return Err(RevealError::GasLimitExceeded);
        }

        let pending_tx = self
            .contract
            .reveal_with_callback(
                self.provider_addr,
                request_with_callback_data.sequence_number,
                request_with_callback_data.user_random_number,
                provider_revelation,
            )
            .send()
            .await
            .map_err(|e| match e {
                ContractError::ProviderError { e } => RevealError::RpcError(e.into()),
                ContractError::Revert(reason) => RevealError::ContractError(anyhow!(reason)),
                _ => RevealError::Unknown(anyhow!(e)),
            })?;

        let res = pending_tx
            .await
            .map_err(|e| RevealError::RpcError(e.into()))?;

        let res = res.ok_or_else(|| {
            RevealError::RpcError(anyhow!("unable to verify transaction success"))
        })?;

        let gas_used = Self::wei_to_eth(res.gas_used.unwrap_or(U256::from(0)));
        Ok(RevealSuccess {
            tx_hash: res.transaction_hash.to_string(),
            gas_used,
        })
    }
}

impl EvmWriterContract {
    fn pad_gas(gas_estimate: U256) -> U256 {
        let (gas_estimate, _) = gas_estimate
            .saturating_mul(U256::from(4))
            .div_mod(U256::from(3));

        gas_estimate
    }

    fn wei_to_eth(value: U256) -> f64 {
        value.as_u128() as f64 / 1e18
    }
}
