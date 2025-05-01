use {
    crate::actors::types::*,
    anyhow::Result,
    async_trait::async_trait,
    backoff::{backoff::Backoff, ExponentialBackoff},
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::sync::Arc,
    tokio::time,
    tracing,
};

pub struct PricePusherState {
    chain_id: String,
    contract: Arc<dyn UpdateChainPrices + Send + Sync>,
    hermes_client: Arc<dyn GetPythPrices + Send + Sync>,
    backoff_policy: ExponentialBackoff,
}

pub struct PricePusher;
impl Actor for PricePusher {
    type Msg = PricePusherMessage;
    type State = PricePusherState;
    type Arguments = (
        String,
        Arc<dyn UpdateChainPrices + Send + Sync>,
        Arc<dyn GetPythPrices + Send + Sync>,
        ExponentialBackoff,
    );

    async fn pre_start(
        &self,
        _myself: ActorRef<Self::Msg>,
        (chain_id, contract, hermes_client, backoff_policy): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let state = PricePusherState {
            chain_id,
            contract,
            hermes_client,
            backoff_policy,
        };

        Ok(state)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            PricePusherMessage::PushPriceUpdates(push_request) => {
                let price_ids = push_request.price_ids.clone();
                match state.hermes_client.get_price_update_data(&price_ids).await {
                    Ok(update_data) => {
                        let mut backoff = state.backoff_policy.clone();
                        let mut attempt = 0;

                        loop {
                            attempt += 1;

                            match state
                                .contract
                                .update_price_feeds(
                                    push_request.subscription_id,
                                    &price_ids,
                                    &update_data,
                                )
                                .await
                            {
                                Ok(tx_hash) => {
                                    tracing::info!(
                                        chain_id = state.chain_id,
                                        subscription_id = push_request.subscription_id,
                                        tx_hash = tx_hash,
                                        attempt = attempt,
                                        "Successfully pushed price updates"
                                    );
                                    break;
                                }
                                Err(e) => {
                                    if let Some(duration) = backoff.next_backoff() {
                                        tracing::warn!(
                                            chain_id = state.chain_id,
                                            subscription_id = push_request.subscription_id,
                                            error = %e,
                                            attempt = attempt,
                                            retry_after_ms = duration.as_millis(),
                                            "Failed to push price updates, retrying"
                                        );
                                        time::sleep(duration).await;
                                    } else {
                                        tracing::error!(
                                            chain_id = state.chain_id,
                                            subscription_id = push_request.subscription_id,
                                            error = %e,
                                            attempt = attempt,
                                            "Failed to push price updates, giving up"
                                        );
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            chain_id = state.chain_id,
                            subscription_id = push_request.subscription_id,
                            error = %e,
                            "Failed to get price update data from Hermes"
                        );
                    }
                }
            }
        }
        Ok(())
    }
}

#[async_trait]
pub trait GetPythPrices {
    async fn get_price_update_data(&self, feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>>;
}
#[async_trait]
pub trait UpdateChainPrices {
    async fn update_price_feeds(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &[PriceId],
        update_data: &[Vec<u8>],
    ) -> Result<String>;
}
