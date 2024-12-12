use {
    axum::async_trait,
    ethers::{
        prelude::{
            gas_oracle::{GasOracleError, Result},
            GasOracle,
        },
        providers::Middleware,
        types::U256,
    },
};

/// Configuration for GasOracle
#[derive(Clone, Debug)]
pub struct GasOracleConfig {
    pub eip1559_fee_multiplier_pct: u64,
}

/// Gas oracle from a [`Middleware`] implementation such as an
/// Ethereum RPC provider.
#[derive(Clone, Debug)]
#[must_use]
pub struct EthProviderOracle<M: Middleware> {
    provider: M,
    config: GasOracleConfig,
}

impl<M: Middleware> EthProviderOracle<M> {
    /// Creates a new EthProviderOracle with the given provider and optional fee multiplier.
    /// If no multiplier is provided, defaults to 100% (no change to fees).
    pub fn new(provider: M, eip1559_fee_multiplier_pct: Option<u64>) -> Self {
        Self {
            provider,
            config: GasOracleConfig {
                eip1559_fee_multiplier_pct: eip1559_fee_multiplier_pct.unwrap_or(100),
            },
        }
    }
}

#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]
#[cfg_attr(not(target_arch = "wasm32"), async_trait)]
impl<M: Middleware> GasOracle for EthProviderOracle<M>
where
    M::Error: 'static,
{
    async fn fetch(&self) -> Result<U256> {
        self.provider
            .get_gas_price()
            .await
            .map_err(|err| GasOracleError::ProviderError(Box::new(err)))
    }

    async fn estimate_eip1559_fees(&self) -> Result<(U256, U256)> {
        let (max_fee_per_gas, max_priority_fee_per_gas) = self
            .provider
            .estimate_eip1559_fees(None)
            .await
            .map_err(|err| GasOracleError::ProviderError(Box::new(err)))?;

        // Apply the fee multiplier
        let multiplier = U256::from(self.config.eip1559_fee_multiplier_pct);
        let adjusted_max_fee = (max_fee_per_gas * multiplier) / U256::from(100);
        Ok((adjusted_max_fee, max_priority_fee_per_gas))
    }
}
