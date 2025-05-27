use {
    crate::config::EthereumConfig,
    crate::state::ChainName,
    anyhow::{Error, Result},
    ethers::{
        contract::abigen,
        middleware::{gas_oracle::GasOracleMiddleware, SignerMiddleware},
        prelude::JsonRpcClient,
        providers::{Http, Middleware, Provider},
        signers::{LocalWallet, Signer},
        types::BlockNumber as EthersBlockNumber,
    },
    fortuna::eth_utils::{
        eth_gas_oracle::EthProviderOracle,
        legacy_tx_middleware::LegacyTxMiddleware,
        nonce_manager::NonceManagerMiddleware,
        traced_client::{RpcMetrics, TracedClient},
    },
    std::sync::Arc,
};

// FIXME: When public scheduler interface is extracted out to an SDK,
// get the ABI from the SDK package.
abigen!(
    PythPulse,
    "../../target_chains/ethereum/contracts/out/IScheduler.sol/IScheduler.abi.json"
);

pub type MiddlewaresWrapper<T> = LegacyTxMiddleware<
    GasOracleMiddleware<
        NonceManagerMiddleware<SignerMiddleware<Provider<T>, LocalWallet>>,
        EthProviderOracle<Provider<T>>,
    >,
>;

pub type SignablePythContractInner<T> = PythPulse<MiddlewaresWrapper<T>>;
pub type SignablePythContract = SignablePythContractInner<Http>;
pub type InstrumentedSignablePythContract = SignablePythContractInner<TracedClient>;

pub type PythContract = PythPulse<Provider<Http>>;
pub type InstrumentedPythContract = PythPulse<Provider<TracedClient>>;

impl<T: JsonRpcClient + 'static + Clone> SignablePythContractInner<T> {
    /// Get the wallet that signs transactions sent to this contract.
    pub fn wallet(&self) -> LocalWallet {
        self.client().inner().inner().inner().signer().clone()
    }

    /// Get the underlying provider that communicates with the blockchain.
    pub fn provider(&self) -> Provider<T> {
        self.client().inner().inner().inner().provider().clone()
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

        Ok(PythPulse::new(
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
        chain_id: ChainName,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;
        Self::from_config_and_provider(chain_config, private_key, provider).await
    }
}

impl PythContract {
    pub fn from_config(chain_config: &EthereumConfig) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;

        Ok(PythPulse::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl InstrumentedPythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        chain_id: ChainName,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;

        Ok(PythPulse::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl<M: Middleware + 'static> PythPulse<M> {
    pub async fn get_block_number(
        &self,
        confirmed_block_status: BlockStatus,
    ) -> Result<BlockNumber> {
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
}

// TODO: extract to a SDK

pub type BlockNumber = u64;

#[derive(
    Copy, Clone, Debug, Default, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize,
)]
pub enum BlockStatus {
    /// Latest block
    #[default]
    Latest,
    /// Finalized block accepted as canonical
    Finalized,
    /// Safe head block
    Safe,
}

impl From<BlockStatus> for EthersBlockNumber {
    fn from(val: BlockStatus) -> Self {
        match val {
            BlockStatus::Latest => EthersBlockNumber::Latest,
            BlockStatus::Finalized => EthersBlockNumber::Finalized,
            BlockStatus::Safe => EthersBlockNumber::Safe,
        }
    }
}
