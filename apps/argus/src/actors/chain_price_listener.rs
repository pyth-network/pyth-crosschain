use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    ractor::{Actor, ActorProcessingErr, ActorRef, RpcReplyPort},
    std::{collections::{HashMap, HashSet}, sync::Arc, time::Duration},
    tokio::{sync::RwLock, time},
    tracing,
};

pub struct ChainPriceListener {
    chain_id: String,
    contract: Arc<dyn PulseContractInterface + Send + Sync>,
    feed_ids: HashSet<PriceId>,
    latest_prices: Arc<RwLock<HashMap<PriceId, Price>>>,
    poll_interval: Duration,
}

#[async_trait]
pub trait PulseContractInterface {
    async fn get_price_unsafe(&self, subscription_id: SubscriptionId, feed_id: &PriceId) -> Result<Option<Price>>;
    
    async fn subscribe_to_price_events(&self) -> Result<()>;
}

impl Actor for ChainPriceListener {
    type Msg = ChainPriceListenerMessage;
    type State = Self;
    type Arguments = (String, Arc<dyn PulseContractInterface + Send + Sync>, Duration);

    async fn pre_start(
        &self,
        myself: ActorRef<Self::Msg>,
        (chain_id, contract, poll_interval): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let listener = ChainPriceListener {
            chain_id,
            contract,
            feed_ids: HashSet::new(),
            latest_prices: Arc::new(RwLock::new(HashMap::new())),
            poll_interval,
        };

        if let Err(e) = listener.contract.subscribe_to_price_events().await {
            tracing::error!(
                chain_id = listener.chain_id,
                error = %e,
                "Failed to subscribe to price events"
            );
        }

        let poll_interval = listener.poll_interval;
        let myself_clone = myself.clone();
        tokio::spawn(async move {
            let mut interval = time::interval(poll_interval);
            loop {
                interval.tick().await;
                tracing::debug!(chain_id = chain_id, "Polling for on-chain price updates");
            }
        });

        Ok(listener)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        _state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ChainPriceListenerMessage::GetLatestPrice(_) => {
            }
            ChainPriceListenerMessage::UpdateFeedIdSet(_) => {
            }
        }
        Ok(())
    }

    async fn handle_rpc(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
        reply_port: RpcReplyPort<ChainPriceListenerResponse>,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ChainPriceListenerMessage::GetLatestPrice(feed_id) => {
                let price = None;
                
                let _ = reply_port.send(ChainPriceListenerResponse::LatestPrice(price));
            }
            ChainPriceListenerMessage::UpdateFeedIdSet(feed_ids) => {
                let old_count = state.feed_ids.len();
                let new_count = feed_ids.len();
                
                state.feed_ids = feed_ids;
                
                tracing::info!(
                    chain_id = state.chain_id,
                    old_count = old_count,
                    new_count = new_count,
                    "Updated feed ID set"
                );
                
                let _ = reply_port.send(ChainPriceListenerResponse::FeedIdSetUpdated);
            }
        }
        Ok(())
    }
}
