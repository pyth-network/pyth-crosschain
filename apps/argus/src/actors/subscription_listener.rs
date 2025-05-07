use {
    super::SubscriptionListenerMessage,
    crate::adapters::types::{ReadChainSubscriptions, Subscription, SubscriptionId},
    anyhow::Result,
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
    tokio::time,
    tracing,
};

pub struct SubscriptionListenerState {
    pub chain_name: String,
    pub contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
    pub active_subscriptions: HashMap<SubscriptionId, Subscription>,
    pub poll_interval: Duration,
}

impl SubscriptionListenerState {
    async fn refresh_subscriptions(&mut self) -> Result<()> {
        let subscriptions = self.contract.get_active_subscriptions().await?;

        let old_ids: HashSet<_> = self.active_subscriptions.keys().cloned().collect();
        let new_ids: HashSet<_> = subscriptions.keys().cloned().collect();

        let added = new_ids.difference(&old_ids).count();
        let removed = old_ids.difference(&new_ids).count();

        if added > 0 || removed > 0 {
            tracing::info!(
                chain_name = self.chain_name,
                added = added,
                removed = removed,
                "Subscription changes detected"
            );
        }

        self.active_subscriptions = subscriptions;
        Ok(())
    }
}

pub struct SubscriptionListener;

impl Actor for SubscriptionListener {
    type Msg = SubscriptionListenerMessage;
    type State = SubscriptionListenerState;
    type Arguments = (
        String,
        Arc<dyn ReadChainSubscriptions + Send + Sync>,
        Duration,
    );

    async fn pre_start(
        &self,
        myself: ActorRef<Self::Msg>,
        (chain_name, contract, poll_interval): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let mut listener = SubscriptionListenerState {
            chain_name,
            contract,
            active_subscriptions: HashMap::new(),
            poll_interval,
        };

        match listener.refresh_subscriptions().await {
            Ok(_) => {
                tracing::info!(
                    chain_name = listener.chain_name,
                    "Loaded {} active subscriptions",
                    listener.active_subscriptions.len()
                );
            }
            Err(e) => {
                tracing::error!(
                    chain_name = listener.chain_name,
                    error = %e,
                    "Failed to load active subscriptions"
                );
            }
        }

        if let Err(e) = listener.contract.subscribe_to_subscription_events().await {
            tracing::error!(
                chain_name = listener.chain_name,
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
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            SubscriptionListenerMessage::GetActiveSubscriptions => {
                todo!()
            }
            SubscriptionListenerMessage::RefreshSubscriptions => {
                if let Err(e) = state.refresh_subscriptions().await {
                    tracing::error!(
                        chain_name = state.chain_name,
                        error = %e,
                        "Failed to refresh subscriptions"
                    );
                }
            }
        }
        Ok(())
    }
}
