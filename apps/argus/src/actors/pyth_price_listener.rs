use {
    crate::{
        actors::types::*,
        adapters::types::{Price, PriceId, ReadPythPrices},
    },
    anyhow::Result,
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::{collections::HashMap, sync::Arc},
    tokio::sync::RwLock,
};

pub struct PythPriceListenerState {
    pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
    feed_ids: Vec<PriceId>,
    latest_prices: Arc<RwLock<HashMap<PriceId, Price>>>,
}

impl PythPriceListenerState {
    pub async fn get_latest_price(&self, feed_id: &PriceId) -> Option<Price> {
        let latest_prices = self.latest_prices.read().await;
        latest_prices.get(feed_id).cloned()
    }

    pub async fn subscribe_to_price_updates(&self) -> Result<()> {
        self.pyth_price_client
            .subscribe_to_price_updates(&self.feed_ids)
            .await
    }
}

pub struct PythPriceListener;
impl Actor for PythPriceListener {
    type Msg = PythPriceListenerMessage;
    type State = PythPriceListenerState;
    type Arguments = Arc<dyn ReadPythPrices + Send + Sync>;

    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        hermes_client: Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let state = PythPriceListenerState {
            pyth_price_client: hermes_client,
            feed_ids: vec![],
            latest_prices: Arc::new(RwLock::new(HashMap::new())),
        };
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
