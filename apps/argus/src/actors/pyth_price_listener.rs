use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    ractor::{Actor, ActorProcessingErr, ActorRef, RpcReplyPort},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
    },
    tokio::sync::RwLock,
    tracing,
};

pub struct PythPriceListener {
    chain_id: String,
    hermes_client: Arc<dyn HermesClient + Send + Sync>,
    feed_ids: HashSet<PriceId>,
    latest_prices: Arc<RwLock<HashMap<PriceId, Price>>>,
}

#[async_trait]
pub trait HermesClient {
    async fn connect(&self) -> Result<()>;

    async fn subscribe_to_price_updates(&self, feed_ids: &HashSet<PriceId>) -> Result<()>;

    async fn get_latest_price(&self, feed_id: &PriceId) -> Result<Option<Price>>;
}

impl Actor for PythPriceListener {
    type Msg = PythPriceListenerMessage;
    type State = Self;
    type Arguments = (String, Arc<dyn HermesClient + Send + Sync>);

    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        (chain_id, hermes_client): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let listener = PythPriceListener {
            chain_id,
            hermes_client,
            feed_ids: HashSet::new(),
            latest_prices: Arc::new(RwLock::new(HashMap::new())),
        };

        if let Err(e) = listener.hermes_client.connect().await {
            tracing::error!(
                chain_id = listener.chain_id,
                error = %e,
                "Failed to connect to Hermes"
            );
        }

        Ok(listener)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        _state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            PythPriceListenerMessage::GetLatestPrice(_) => {}
            PythPriceListenerMessage::UpdateFeedIdSet(_) => {}
        }
        Ok(())
    }
}
