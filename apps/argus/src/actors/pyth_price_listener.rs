use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
    },
    tokio::sync::RwLock,
    tracing,
};

#[allow(dead_code)]
pub struct PythPriceListenerState {
    chain_id: String,
    hermes_client: Arc<dyn StreamPythPrices + Send + Sync>,
    feed_ids: HashSet<PriceId>,
    latest_prices: Arc<RwLock<HashMap<PriceId, Price>>>,
}

pub struct PythPriceListener;
impl Actor for PythPriceListener {
    type Msg = PythPriceListenerMessage;
    type State = PythPriceListenerState;
    type Arguments = (String, Arc<dyn StreamPythPrices + Send + Sync>);

    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        (chain_id, hermes_client): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let state = PythPriceListenerState {
            chain_id,
            hermes_client,
            feed_ids: HashSet::new(),
            latest_prices: Arc::new(RwLock::new(HashMap::new())),
        };

        if let Err(e) = state.hermes_client.connect().await {
            tracing::error!(
                chain_id = state.chain_id,
                error = %e,
                "Failed to connect to Hermes"
            );
        }

        Ok(state)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        _state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            PythPriceListenerMessage::GetLatestPrice(feed_id, reply_port) => {
                let price = _state.get_latest_price(&feed_id).await;
                reply_port.send(price)?;
            }
            PythPriceListenerMessage::UpdateFeedIdSet(_) => {
                todo!()
            }
        }
        Ok(())
    }
}

impl PythPriceListenerState {
    pub async fn get_latest_price(&self, feed_id: &PriceId) -> Option<Price> {
        let latest_prices = self.latest_prices.read().await;
        latest_prices.get(feed_id).cloned()
    }
}

#[async_trait]
pub trait StreamPythPrices {
    async fn connect(&self) -> Result<()>;

    async fn subscribe_to_price_updates(&self, feed_ids: &HashSet<PriceId>) -> Result<()>;
}
