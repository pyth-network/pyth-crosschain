use {
    crate::{
        chain::ethereum::{PythContract, SignablePythContract},
        config::EthereumConfig,
    },
    anyhow::Result,
    async_trait::async_trait,
    ethers::{
        contract::EthEvent,
        types::{Address, U256},
    },
    std::{collections::HashSet, sync::Arc},
    tokio::sync::RwLock,
};

#[derive(Debug, Clone, EthEvent)]
#[ethevent(name = "SubscriptionUpdated")]
pub struct SubscriptionUpdatedEvent {
    #[ethevent(indexed)]
    pub subscription_id: U256,
    pub is_active: bool,
}

#[derive(Debug, Clone, EthEvent)]
#[ethevent(name = "SubscriptionFunded")]
pub struct SubscriptionFundedEvent {
    #[ethevent(indexed)]
    pub subscription_id: U256,
    pub amount: U256,
}

#[derive(Debug, Clone)]
pub struct Subscription {
    pub id: U256,
    pub price_ids: Vec<[u8; 32]>,
    pub is_active: bool,
    pub update_criteria: UpdateCriteria,
}

#[derive(Debug, Clone)]
pub struct UpdateCriteria {
    pub update_on_heartbeat: bool,
    pub heartbeat_seconds: u32,
    pub update_on_deviation: bool,
    pub deviation_threshold_bps: u32,
}

#[async_trait]
pub trait SubscriptionListener: Send + Sync {
    async fn initialize(&self) -> Result<()>;

    async fn get_active_subscriptions(&self) -> Result<Vec<Subscription>>;

    async fn get_all_active_feed_ids(&self) -> Result<HashSet<[u8; 32]>>;
}

pub struct EthereumSubscriptionListener {
    contract: Arc<PythContract>,
    signable_contract: Arc<SignablePythContract>,
    config: EthereumConfig,
    active_subscriptions: Arc<RwLock<Vec<Subscription>>>,
    active_feed_ids: Arc<RwLock<HashSet<[u8; 32]>>>,
}

impl EthereumSubscriptionListener {
    pub fn new(
        contract: Arc<PythContract>,
        signable_contract: Arc<SignablePythContract>,
        config: EthereumConfig,
    ) -> Self {
        Self {
            contract,
            signable_contract,
            config,
            active_subscriptions: Arc::new(RwLock::new(Vec::new())),
            active_feed_ids: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    async fn subscribe_to_events(&self) -> Result<()> {
        Ok(())
    }

    async fn poll_active_subscriptions(&self) -> Result<()> {
        Ok(())
    }

    async fn update_subscription_cache(&self, subscriptions: Vec<Subscription>) -> Result<()> {
        let mut active_feed_ids = HashSet::new();
        
        for subscription in &subscriptions {
            if subscription.is_active {
                for feed_id in &subscription.price_ids {
                    active_feed_ids.insert(*feed_id);
                }
            }
        }

        {
            let mut subscriptions_lock = self.active_subscriptions.write().await;
            *subscriptions_lock = subscriptions;
        }
        
        {
            let mut feed_ids_lock = self.active_feed_ids.write().await;
            *feed_ids_lock = active_feed_ids;
        }

        Ok(())
    }
}

#[async_trait]
impl SubscriptionListener for EthereumSubscriptionListener {
    async fn initialize(&self) -> Result<()> {
        self.subscribe_to_events().await?;
        
        self.poll_active_subscriptions().await?;
        
        Ok(())
    }

    async fn get_active_subscriptions(&self) -> Result<Vec<Subscription>> {
        let subscriptions = self.active_subscriptions.read().await.clone();
        Ok(subscriptions)
    }

    async fn get_all_active_feed_ids(&self) -> Result<HashSet<[u8; 32]>> {
        let feed_ids = self.active_feed_ids.read().await.clone();
        Ok(feed_ids)
    }
}
