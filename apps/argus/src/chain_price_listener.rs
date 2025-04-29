use {
    crate::{
        chain::ethereum::PythContract,
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
#[ethevent(name = "PriceUpdated")]
pub struct PriceUpdatedEvent {
    #[ethevent(indexed)]
    pub subscription_id: U256,
    #[ethevent(indexed)]
    pub price_id: [u8; 32],
    pub publish_time: u64,
}

#[derive(Debug, Clone)]
pub struct ChainPrice {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

#[async_trait]
pub trait ChainPriceListener: Send + Sync {
    async fn initialize(&self) -> Result<()>;

    async fn update_feed_id_set(&self, feed_ids: HashSet<[u8; 32]>) -> Result<()>;

    async fn get_latest_price(&self, feed_id: [u8; 32]) -> Result<Option<ChainPrice>>;

    async fn get_latest_prices(&self, feed_ids: &[[u8; 32]]) -> Result<Vec<Option<ChainPrice>>>;
}

pub struct EthereumChainPriceListener {
    contract: Arc<PythContract>,
    config: EthereumConfig,
    feed_ids: Arc<RwLock<HashSet<[u8; 32]>>>,
    latest_prices: Arc<RwLock<std::collections::HashMap<[u8; 32], ChainPrice>>>,
}

impl EthereumChainPriceListener {
    pub fn new(contract: Arc<PythContract>, config: EthereumConfig) -> Self {
        Self {
            contract,
            config,
            feed_ids: Arc::new(RwLock::new(HashSet::new())),
            latest_prices: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    async fn subscribe_to_price_updates(&self) -> Result<()> {
        Ok(())
    }

    async fn poll_on_chain_prices(&self) -> Result<()> {
        Ok(())
    }

    async fn handle_price_update_event(&self, event: PriceUpdatedEvent) -> Result<()> {
        Ok(())
    }
}

#[async_trait]
impl ChainPriceListener for EthereumChainPriceListener {
    async fn initialize(&self) -> Result<()> {
        self.subscribe_to_price_updates().await?;
        
        self.poll_on_chain_prices().await?;
        
        Ok(())
    }

    async fn update_feed_id_set(&self, feed_ids: HashSet<[u8; 32]>) -> Result<()> {
        let mut current_feed_ids = self.feed_ids.write().await;
        
        if *current_feed_ids != feed_ids {
            *current_feed_ids = feed_ids;
            self.poll_on_chain_prices().await?;
        }
        
        Ok(())
    }

    async fn get_latest_price(&self, feed_id: [u8; 32]) -> Result<Option<ChainPrice>> {
        let prices = self.latest_prices.read().await;
        Ok(prices.get(&feed_id).cloned())
    }

    async fn get_latest_prices(&self, feed_ids: &[[u8; 32]]) -> Result<Vec<Option<ChainPrice>>> {
        let prices = self.latest_prices.read().await;
        let result = feed_ids
            .iter()
            .map(|id| prices.get(id).cloned())
            .collect();
        Ok(result)
    }
}
