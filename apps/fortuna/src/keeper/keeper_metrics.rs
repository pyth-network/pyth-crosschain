use {
    ethers::types::Address,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family, gauge::Gauge, histogram::Histogram},
        registry::Registry,
    },
    std::sync::{atomic::AtomicU64, Arc},
    tokio::sync::RwLock,
};

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct AccountLabel {
    pub chain_id: String,
    pub address: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainIdLabel {
    pub chain_id: String,
}

pub struct KeeperMetrics {
    pub current_sequence_number: Family<AccountLabel, Gauge>,
    pub current_commitment_sequence_number: Family<AccountLabel, Gauge>,
    pub end_sequence_number: Family<AccountLabel, Gauge>,
    pub balance: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub collected_fee: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub current_fee: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub target_provider_fee: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub total_gas_spent: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub total_gas_fee_spent: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub requests: Family<AccountLabel, Counter>,
    pub requests_processed: Family<AccountLabel, Counter>,
    pub requests_processed_success: Family<AccountLabel, Counter>,
    pub requests_processed_failure: Family<AccountLabel, Counter>,
    pub requests_reprocessed: Family<AccountLabel, Counter>,
    pub reveals: Family<AccountLabel, Counter>,
    pub request_duration_ms: Family<AccountLabel, Histogram>,
    pub retry_count: Family<AccountLabel, Histogram>,
    pub final_gas_multiplier: Family<AccountLabel, Histogram>,
    pub final_fee_multiplier: Family<AccountLabel, Histogram>,
    pub gas_price_estimate: Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub highest_revealed_sequence_number: Family<AccountLabel, Gauge>,
    pub accrued_pyth_fees: Family<ChainIdLabel, Gauge<f64, AtomicU64>>,
    pub block_timestamp_lag: Family<ChainIdLabel, Gauge>,
    pub latest_block_timestamp: Family<ChainIdLabel, Gauge>,
    pub process_event_timestamp: Family<ChainIdLabel, Gauge>,
    pub latest_block_number: Family<ChainIdLabel, Gauge>,
    pub process_event_block_number: Family<ChainIdLabel, Gauge>,
}

impl Default for KeeperMetrics {
    fn default() -> Self {
        Self {
            current_sequence_number: Family::default(),
            current_commitment_sequence_number: Family::default(),
            end_sequence_number: Family::default(),
            balance: Family::default(),
            collected_fee: Family::default(),
            current_fee: Family::default(),
            target_provider_fee: Family::default(),
            total_gas_spent: Family::default(),
            total_gas_fee_spent: Family::default(),
            requests: Family::default(),
            requests_processed: Family::default(),
            requests_processed_success: Family::default(),
            requests_processed_failure: Family::default(),
            requests_reprocessed: Family::default(),
            reveals: Family::default(),
            request_duration_ms: Family::new_with_constructor(|| {
                Histogram::new(vec![
                    1000.0, 2500.0, 5000.0, 7500.0, 10000.0, 20000.0, 30000.0, 40000.0, 50000.0,
                    60000.0, 120000.0, 180000.0, 240000.0, 300000.0, 600000.0,
                ])
            }),
            retry_count: Family::new_with_constructor(|| {
                Histogram::new(vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 10.0, 15.0, 20.0])
            }),
            final_gas_multiplier: Family::new_with_constructor(|| {
                Histogram::new(vec![100.0, 125.0, 150.0, 200.0, 300.0, 400.0, 500.0, 600.0])
            }),
            final_fee_multiplier: Family::new_with_constructor(|| {
                Histogram::new(vec![100.0, 110.0, 120.0, 140.0, 160.0, 180.0, 200.0])
            }),
            gas_price_estimate: Family::default(),
            highest_revealed_sequence_number: Family::default(),
            accrued_pyth_fees: Family::default(),
            block_timestamp_lag: Family::default(),
            latest_block_timestamp: Family::default(),
            process_event_timestamp: Family::default(),
            latest_block_number: Family::default(),
            process_event_block_number: Family::default(),
        }
    }
}

impl KeeperMetrics {
    pub async fn new(registry: Arc<RwLock<Registry>>) -> Self {
        let mut writable_registry = registry.write().await;
        let keeper_metrics = KeeperMetrics::default();

        writable_registry.register(
            "current_sequence_number",
            "The sequence number for a new request",
            keeper_metrics.current_sequence_number.clone(),
        );

        writable_registry.register(
            "current_commitment_sequence_number",
            "The sequence number for the current commitment",
            keeper_metrics.current_commitment_sequence_number.clone(),
        );

        writable_registry.register(
            "end_sequence_number",
            "The sequence number for the end request",
            keeper_metrics.end_sequence_number.clone(),
        );

        writable_registry.register(
            "requests",
            "Number of requests received through events",
            keeper_metrics.requests.clone(),
        );

        writable_registry.register(
            "requests_processed",
            "Number of requests processed",
            keeper_metrics.requests_processed.clone(),
        );

        writable_registry.register(
            "requests_processed_success",
            "Number of requests processed successfully",
            keeper_metrics.requests_processed_success.clone(),
        );

        writable_registry.register(
            "requests_processed_failure",
            "Number of requests processed with failure",
            keeper_metrics.requests_processed_failure.clone(),
        );

        writable_registry.register(
            "reveal",
            "Number of reveals",
            keeper_metrics.reveals.clone(),
        );

        writable_registry.register(
            "balance",
            "Balance of the keeper",
            keeper_metrics.balance.clone(),
        );

        writable_registry.register(
            "collected_fee",
            "Collected fee on the contract",
            keeper_metrics.collected_fee.clone(),
        );

        writable_registry.register(
            "current_fee",
            "Current fee charged by the provider",
            keeper_metrics.current_fee.clone(),
        );

        writable_registry.register(
            "target_provider_fee",
            "Target fee in ETH -- differs from current_fee in that this is the goal, and current_fee is the on-chain value.",
            keeper_metrics.target_provider_fee.clone(),
        );

        writable_registry.register(
            "total_gas_spent",
            "Total gas spent revealing requests",
            keeper_metrics.total_gas_spent.clone(),
        );

        writable_registry.register(
            "total_gas_fee_spent",
            "Total amount of ETH spent on gas for revealing requests",
            keeper_metrics.total_gas_fee_spent.clone(),
        );

        writable_registry.register(
            "requests_reprocessed",
            "Number of requests reprocessed",
            keeper_metrics.requests_reprocessed.clone(),
        );

        writable_registry.register(
            "request_duration_ms",
            "Time taken to process each successful callback request in milliseconds",
            keeper_metrics.request_duration_ms.clone(),
        );

        writable_registry.register(
            "retry_count",
            "Number of retries for successful transactions",
            keeper_metrics.retry_count.clone(),
        );

        writable_registry.register(
            "final_gas_multiplier",
            "Final gas multiplier percentage for successful transactions",
            keeper_metrics.final_gas_multiplier.clone(),
        );

        writable_registry.register(
            "final_fee_multiplier",
            "Final fee multiplier percentage for successful transactions",
            keeper_metrics.final_fee_multiplier.clone(),
        );

        writable_registry.register(
            "gas_price_estimate",
            "Gas price estimate for the blockchain (in gwei)",
            keeper_metrics.gas_price_estimate.clone(),
        );

        writable_registry.register(
            "highest_revealed_sequence_number",
            "The highest sequence number revealed by the keeper either via callbacks or manual reveal",
            keeper_metrics.highest_revealed_sequence_number.clone(),
        );

        writable_registry.register(
            "accrued_pyth_fees",
            "Accrued Pyth fees on the contract",
            keeper_metrics.accrued_pyth_fees.clone(),
        );

        writable_registry.register(
            "block_timestamp_lag",
            "The difference between server timestamp and latest block timestamp",
            keeper_metrics.block_timestamp_lag.clone(),
        );

        writable_registry.register(
            "latest_block_timestamp",
            "The current block timestamp",
            keeper_metrics.latest_block_timestamp.clone(),
        );

        writable_registry.register(
            "process_event_timestamp",
            "Timestamp of the last time the keeper updated the events",
            keeper_metrics.process_event_timestamp.clone(),
        );

        writable_registry.register(
            "latest_block_number",
            "The current block number",
            keeper_metrics.latest_block_number.clone(),
        );

        writable_registry.register(
            "process_event_block_number",
            "The highest block number for which events have been successfully retrieved and processed",
            keeper_metrics.process_event_block_number.clone(),
        );

        // *Important*: When adding a new metric:
        // 1. Register it above using `writable_registry.register(...)`
        // 2. Add a get_or_create call in the add_chain function below to initialize it for each chain/provider pair

        keeper_metrics
    }

    pub fn add_chain(&self, chain_id: String, provider_address: Address) {
        let chain_id_label = ChainIdLabel {
            chain_id: chain_id.clone(),
        };
        let _ = self.accrued_pyth_fees.get_or_create(&chain_id_label);
        let _ = self.block_timestamp_lag.get_or_create(&chain_id_label);
        let _ = self.latest_block_timestamp.get_or_create(&chain_id_label);
        let _ = self.process_event_timestamp.get_or_create(&chain_id_label);
        let _ = self.latest_block_number.get_or_create(&chain_id_label);
        let _ = self
            .process_event_block_number
            .get_or_create(&chain_id_label);

        let account_label = AccountLabel {
            chain_id,
            address: provider_address.to_string(),
        };

        let _ = self.current_sequence_number.get_or_create(&account_label);
        let _ = self
            .current_commitment_sequence_number
            .get_or_create(&account_label);
        let _ = self.end_sequence_number.get_or_create(&account_label);
        let _ = self.balance.get_or_create(&account_label);
        let _ = self.collected_fee.get_or_create(&account_label);
        let _ = self.current_fee.get_or_create(&account_label);
        let _ = self.target_provider_fee.get_or_create(&account_label);
        let _ = self.total_gas_spent.get_or_create(&account_label);
        let _ = self.total_gas_fee_spent.get_or_create(&account_label);
        let _ = self.requests.get_or_create(&account_label);
        let _ = self.requests_processed.get_or_create(&account_label);
        let _ = self
            .requests_processed_success
            .get_or_create(&account_label);
        let _ = self
            .requests_processed_failure
            .get_or_create(&account_label);
        let _ = self.requests_reprocessed.get_or_create(&account_label);
        let _ = self.reveals.get_or_create(&account_label);
        let _ = self.request_duration_ms.get_or_create(&account_label);
        let _ = self.retry_count.get_or_create(&account_label);
        let _ = self.final_gas_multiplier.get_or_create(&account_label);
        let _ = self.final_fee_multiplier.get_or_create(&account_label);
        let _ = self.gas_price_estimate.get_or_create(&account_label);
    }
}
