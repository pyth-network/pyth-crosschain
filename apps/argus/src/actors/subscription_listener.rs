use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    ethers::providers::Middleware,
    ractor::{Actor, ActorProcessingErr, ActorRef, RpcReplyPort},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
    tokio::time,
    tracing,
};

pub struct SubscriptionListener {
    chain_id: String,
    contract: Arc<dyn PulseContractInterface + Send + Sync>,
    active_subscriptions: HashMap<SubscriptionId, Subscription>,
    poll_interval: Duration,
}

#[async_trait]
pub trait PulseContractInterface {
    async fn get_active_subscriptions(&self) -> Result<HashMap<SubscriptionId, Subscription>>;

    async fn subscribe_to_events(&self) -> Result<()>;
}

impl Actor for SubscriptionListener {
    type Msg = SubscriptionListenerMessage;
    type State = Self;
    type Arguments = (
        String,
        Arc<dyn PulseContractInterface + Send + Sync>,
        Duration,
    );

    async fn pre_start(
        &self,
        myself: ActorRef<Self::Msg>,
        (chain_id, contract, poll_interval): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let mut listener = SubscriptionListener {
            chain_id,
            contract,
            active_subscriptions: HashMap::new(),
            poll_interval,
        };

        match listener.refresh_subscriptions().await {
            Ok(_) => {
                tracing::info!(
                    chain_id = listener.chain_id,
                    "Loaded {} active subscriptions",
                    listener.active_subscriptions.len()
                );
            }
            Err(e) => {
                tracing::error!(
                    chain_id = listener.chain_id,
                    error = %e,
                    "Failed to load active subscriptions"
                );
            }
        }

        if let Err(e) = listener.contract.subscribe_to_events().await {
            tracing::error!(
                chain_id = listener.chain_id,
                error = %e,
                "Failed to subscribe to contract events"
            );
        }

        let poll_interval = listener.poll_interval;
        tokio::spawn(async move {
            let mut interval = time::interval(poll_interval);
            loop {
                interval.tick().await;
                let _ = myself.cast(SubscriptionListenerMessage::RefreshSubscriptions);
            }
        });

        Ok(listener)
    }

    async fn handle(
        &self,
        myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            SubscriptionListenerMessage::GetActiveSubscriptions => {}
            SubscriptionListenerMessage::RefreshSubscriptions => {
                if let Err(e) = state.refresh_subscriptions().await {
                    tracing::error!(
                        chain_id = state.chain_id,
                        error = %e,
                        "Failed to refresh subscriptions"
                    );
                }
            }
        }
        Ok(())
    }
}

impl SubscriptionListener {
    async fn refresh_subscriptions(&mut self) -> Result<()> {
        let subscriptions = self.contract.get_active_subscriptions().await?;

        let old_ids: HashSet<_> = self.active_subscriptions.keys().cloned().collect();
        let new_ids: HashSet<_> = subscriptions.keys().cloned().collect();

        let added = new_ids.difference(&old_ids).count();
        let removed = old_ids.difference(&new_ids).count();

        if added > 0 || removed > 0 {
            tracing::info!(
                chain_id = self.chain_id,
                added = added,
                removed = removed,
                "Subscription changes detected"
            );
        }

        self.active_subscriptions = subscriptions;
        Ok(())
    }
}
