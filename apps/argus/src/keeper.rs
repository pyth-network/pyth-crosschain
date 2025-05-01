use {
    crate::{
        actors::{
            chain_price_listener::{ChainPriceListener, GetChainPrices},
            controller::Controller,
            price_pusher::{GetPythPrices, PricePusher, UpdateChainPrices},
            pyth_price_listener::{PythPriceListener, StreamPythPrices},
            subscription_listener::{ReadChainSubscriptions, SubscriptionListener},
            types::*,
        },
        api::BlockchainState,
        chain::ethereum::InstrumentedSignablePythContract,
        config::EthereumConfig,
    },
    anyhow::Result,
    async_trait::async_trait,
    backoff::ExponentialBackoff,
    ethers::signers::Signer,
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper_metrics::KeeperMetrics,
    ractor::Actor,
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
    tracing,
};

pub(crate) mod keeper_metrics;

#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.id))]
pub async fn run_keeper_for_chain(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    _metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    tracing::info!("starting keeper");

    let contract = Arc::new(
        InstrumentedSignablePythContract::from_config(
            &chain_eth_config,
            &private_key,
            chain_state.id.clone(),
            rpc_metrics.clone(),
        )
        .await
        .expect("Chain config should be valid"),
    );
    let keeper_address = contract.wallet().address();

    tracing::info!(
        chain_id = chain_state.id,
        keeper_address = %keeper_address,
        "Keeper address"
    );

    let subscription_contract = Arc::new(PulseContractAdapter {
        contract: contract.clone(),
        chain_id: chain_state.id.clone(),
    });

    let chain_price_contract = Arc::new(PulseContractAdapter {
        contract: contract.clone(),
        chain_id: chain_state.id.clone(),
    });

    let price_pusher_contract = Arc::new(PulseContractAdapter {
        contract: contract.clone(),
        chain_id: chain_state.id.clone(),
    });

    let hermes_client = Arc::new(HermesClientAdapter {
        chain_id: chain_state.id.clone(),
    });

    let subscription_poll_interval = Duration::from_secs(60); // Poll for subscriptions every 60 seconds
    let chain_price_poll_interval = Duration::from_secs(10); // Poll for on-chain prices every 10 seconds
    let controller_update_interval = Duration::from_secs(5); // Run the update loop every 5 seconds

    let backoff_policy = ExponentialBackoff {
        initial_interval: Duration::from_secs(1),
        max_interval: Duration::from_secs(60),
        multiplier: 2.0,
        max_elapsed_time: Some(Duration::from_secs(300)), // Give up after 5 minutes
        ..ExponentialBackoff::default()
    };

    let (subscription_listener, _) = Actor::spawn(
        Some("SubscriptionListener".to_string()),
        SubscriptionListener,
        (
            chain_state.id.clone(),
            subscription_contract as Arc<dyn ReadChainSubscriptions + Send + Sync>,
            subscription_poll_interval,
        ),
    )
    .await
    .expect("Failed to spawn SubscriptionListener actor");

    let (pyth_price_listener, _) = Actor::spawn(
        None,
        PythPriceListener,
        (
            chain_state.id.clone(),
            hermes_client.clone() as Arc<dyn StreamPythPrices + Send + Sync>,
        ),
    )
    .await
    .expect("Failed to spawn PythPriceListener actor");

    let (chain_price_listener, _) = Actor::spawn(
        Some(String::from("ChainPriceListener")),
        ChainPriceListener,
        (
            chain_state.id.clone(),
            chain_price_contract as Arc<dyn GetChainPrices + Send + Sync>,
            chain_price_poll_interval,
        ),
    )
    .await
    .expect("Failed to spawn ChainPriceListener actor");

    let (price_pusher, _) = Actor::spawn(
        Some(String::from("PricePusher")),
        PricePusher,
        (
            chain_state.id.clone(),
            price_pusher_contract as Arc<dyn UpdateChainPrices + Send + Sync>,
            hermes_client as Arc<dyn GetPythPrices + Send + Sync>,
            backoff_policy,
        ),
    )
    .await
    .expect("Failed to spawn PricePusher actor");

    let (_controller, _) = Actor::spawn(
        Some(String::from("Controller")),
        Controller,
        (
            chain_state.id.clone(),
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            controller_update_interval,
        ),
    )
    .await
    .expect("Failed to spawn Controller actor");

    tracing::info!(chain_id = chain_state.id, "Keeper actors started");
}

#[allow(dead_code)]
struct PulseContractAdapter {
    contract: Arc<InstrumentedSignablePythContract>,
    chain_id: String,
}

#[async_trait]
impl ReadChainSubscriptions for PulseContractAdapter {
    async fn get_active_subscriptions(&self) -> Result<HashMap<SubscriptionId, Subscription>> {
        tracing::debug!(chain_id = self.chain_id, "Getting active subscriptions");
        Ok(HashMap::new())
    }

    async fn subscribe_to_events(&self) -> Result<()> {
        tracing::debug!(chain_id = self.chain_id, "Subscribing to contract events");
        Ok(())
    }
}

#[async_trait]
impl GetChainPrices for PulseContractAdapter {
    async fn get_price_unsafe(
        &self,
        subscription_id: SubscriptionId,
        feed_id: &PriceId,
    ) -> Result<Option<Price>> {
        tracing::debug!(
            chain_id = self.chain_id,
            subscription_id = subscription_id,
            feed_id = hex::encode(feed_id),
            "Getting on-chain price"
        );
        Ok(None)
    }

    async fn subscribe_to_price_events(&self) -> Result<()> {
        tracing::debug!(chain_id = self.chain_id, "Subscribing to price events");
        Ok(())
    }
}

#[async_trait]
impl UpdateChainPrices for PulseContractAdapter {
    async fn update_price_feeds(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &[PriceId],
        update_data: &[Vec<u8>],
    ) -> Result<String> {
        tracing::debug!(
            chain_id = self.chain_id,
            subscription_id = subscription_id,
            price_ids_count = price_ids.len(),
            update_data_count = update_data.len(),
            "Updating price feeds"
        );
        Ok("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".to_string())
    }
}

struct HermesClientAdapter {
    chain_id: String,
}

#[async_trait]
impl StreamPythPrices for HermesClientAdapter {
    async fn connect(&self) -> Result<()> {
        tracing::debug!(chain_id = self.chain_id, "Connecting to Hermes");
        Ok(())
    }

    async fn subscribe_to_price_updates(&self, feed_ids: &HashSet<PriceId>) -> Result<()> {
        tracing::debug!(
            chain_id = self.chain_id,
            feed_ids_count = feed_ids.len(),
            "Subscribing to price updates"
        );
        Ok(())
    }
}

#[async_trait]
impl GetPythPrices for HermesClientAdapter {
    async fn get_price_update_data(&self, feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>> {
        tracing::debug!(
            chain_id = self.chain_id,
            feed_ids_count = feed_ids.len(),
            "Getting price update data from Hermes"
        );
        Ok(vec![vec![0u8; 32]; feed_ids.len()])
    }
}
