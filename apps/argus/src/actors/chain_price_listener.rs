use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
    tokio::{sync::RwLock, time},
    tracing,
};

#[allow(dead_code)]
pub struct ChainPriceListenerState {
    chain_id: String,
    contract: Arc<dyn GetChainPrices + Send + Sync>,
    feed_ids: HashSet<PriceId>,
    latest_prices: Arc<RwLock<HashMap<PriceId, Price>>>,
    poll_interval: Duration,
}

pub struct ChainPriceListener;
impl Actor for ChainPriceListener {
    type Msg = ChainPriceListenerMessage;
    type State = ChainPriceListenerState;
    type Arguments = (String, Arc<dyn GetChainPrices + Send + Sync>, Duration);

    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        (chain_id, contract, poll_interval): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let state = ChainPriceListenerState {
            chain_id: chain_id.clone(),
            contract,
            feed_ids: HashSet::new(),
            latest_prices: Arc::new(RwLock::new(HashMap::new())),
            poll_interval,
        };

        if let Err(e) = state.contract.subscribe_to_price_events().await {
            tracing::error!(
                chain_id = state.chain_id,
                error = %e,
                "Failed to subscribe to price events"
            );
        }

        let poll_interval = state.poll_interval;
        tokio::spawn(async move {
            let mut interval = time::interval(poll_interval);
            loop {
                interval.tick().await;
                tracing::debug!(
                    chain_id = chain_id.clone(),
                    "Polling for on-chain price updates"
                );
            }
        });

        Ok(state)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        _state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ChainPriceListenerMessage::GetLatestPrice(feed_id, reply_port) => {
                let price = _state.get_latest_price(&feed_id).await;
                reply_port.send(price)?;
            }
            ChainPriceListenerMessage::UpdateFeedIdSet(_) => {
                todo!()
            }
        }
        Ok(())
    }
}

impl ChainPriceListenerState {
    pub async fn get_latest_price(&self, feed_id: &PriceId) -> Option<Price> {
        let latest_prices = self.latest_prices.read().await;
        latest_prices.get(feed_id).cloned()
    }
}

#[async_trait]
pub trait GetChainPrices {
    async fn get_price_unsafe(
        &self,
        subscription_id: SubscriptionId,
        feed_id: &PriceId,
    ) -> Result<Option<Price>>;

    async fn subscribe_to_price_events(&self) -> Result<()>;
}
