use {
    crate::{
        contract::PulseContract,
        hermes::HermesClient,
        types::{PriceData, PriceUpdateRequest, UpdateBatch},
        error::{ArgusError, ContractError},
    },
    alloy::{
        primitives::{Address, Bytes, U256},
        providers::Provider,
        signers::Signer,
    },
    anyhow::Result,
    std::{collections::HashMap, sync::Arc},
    tokio::{sync::mpsc, time},
};

#[derive(Clone)]
pub struct KeeperMetrics {
    pub transactions_submitted: Counter,
    pub transaction_failures: Counter,
    pub gas_used: Histogram,
    pub batch_size: Histogram,
}

pub struct Keeper {
    provider: Arc<Provider>,
    signer: Arc<Signer>,
    request_rx: mpsc::Receiver<PriceUpdateRequest>,
    metrics: Arc<KeeperMetrics>,
    min_batch_size: usize,
    max_batch_size: usize,
    batch_timeout: Duration,
    hermes_client: HermesClient,
}

impl Keeper {
    pub async fn new(
        provider: Arc<Provider>,
        signer: Arc<Signer>,
        request_rx: mpsc::Receiver<PriceUpdateRequest>,
        metrics: Arc<KeeperMetrics>,
        min_batch_size: usize,
        max_batch_size: usize,
        batch_timeout: Duration,
    ) -> Result<Self> {
        Ok(Self {
            provider,
            signer,
            request_rx,
            metrics,
            min_batch_size,
            max_batch_size,
            batch_timeout,
            hermes_client: HermesClient::new(),
        })
    }

    pub async fn run(&mut self) -> Result<()> {
        let mut pending_requests = Vec::new();
        let mut batch_timer = time::interval(self.batch_timeout);

        loop {
            tokio::select! {
                Some(request) = self.request_rx.recv() => {
                    pending_requests.push(request);

                    if pending_requests.len() >= self.max_batch_size {
                        self.process_batch(&mut pending_requests).await?;
                    }
                }
                _ = batch_timer.tick() => {
                    if pending_requests.len() >= self.min_batch_size {
                        self.process_batch(&mut pending_requests).await?;
                    }
                }
            }
        }
    }

    async fn process_batch(&self, requests: &mut Vec<PriceUpdateRequest>) -> Result<(), ArgusError> {
        if requests.is_empty() {
            return Ok(());
        }

        let batch = self.prepare_batch(requests).await?;
        self.metrics.batch_size.observe(batch.requests.len() as f64);

        match self.submit_batch(batch).await {
            Ok(_) => {
                self.metrics.transactions_submitted.inc();
                requests.clear();
                Ok(())
            }
            Err(e) => {
                self.metrics.transaction_failures.inc();
                tracing::error!("Failed to submit batch: {}", e);
                Err(e)
            }
        }
    }

    async fn submit_batch(&self, batch: UpdateBatch) -> Result<(), ArgusError> {
        let tx = self.build_batch_tx(&batch)
            .map_err(|e| ContractError::TransactionFailed(e.to_string()))?;

        let signed_tx = self.signer.sign_transaction(tx)
            .await
            .map_err(|e| ContractError::TransactionFailed(format!("Failed to sign: {}", e)))?;

        let pending_tx = self.provider.send_raw_transaction(signed_tx.into())
            .await
            .map_err(|e| ContractError::TransactionFailed(format!("Failed to send: {}", e)))?;

        let receipt = pending_tx.await
            .map_err(|e| ContractError::TransactionFailed(format!("Failed to get receipt: {}", e)))?;

        if let Some(gas_used) = receipt.gas_used {
            self.metrics.gas_used.observe(gas_used.as_f64());
        }

        // Check if transaction was successful
        if !receipt.status.unwrap_or_default().is_success() {
            return Err(ContractError::TransactionFailed("Transaction reverted".into()).into());
        }

        Ok(())
    }

    async fn prepare_batch(&self, requests: &[PriceUpdateRequest]) -> Result<UpdateBatch> {
        // Group requests by price ID to minimize Hermes API calls
        let mut price_id_map: HashMap<[u8; 32], Vec<usize>> = HashMap::new();
        for (i, req) in requests.iter().enumerate() {
            for price_id in &req.price_ids {
                price_id_map.entry(*price_id).or_default().push(i);
            }
        }

        // Get all unique price IDs
        let price_ids: Vec<[u8; 32]> = price_id_map.keys().copied().collect();

        // Fetch price data from Hermes in a single batch request
        let price_updates = self.hermes_client.get_price_updates(&price_ids).await?;

        let mut price_data = Vec::new();
        let mut update_data = Vec::new();

        for (data, vaa) in price_updates {
            price_data.push(data);
            update_data.push(vaa);
        }

        Ok(UpdateBatch {
            requests: requests.to_vec(),
            price_data,
            update_data: update_data.into_iter().map(Bytes::from).collect(),
        })
    }

    fn build_batch_tx(&self, batch: &UpdateBatch) -> Result<Transaction> {
        let contract = PulseContract::new(self.contract_addr, self.provider.clone());

        let tx = contract.execute_callback(
            batch.requests[0].provider,
            batch.requests[0].sequence_number,
            batch.requests[0].price_ids.clone(),
            batch.update_data.clone(),
            batch.requests[0].callback_gas_limit,
        );

        Ok(tx)
    }
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::types::PriceUpdateRequest,
        tokio::sync::mpsc,
    };

    fn setup_test_metrics() -> Arc<KeeperMetrics> {
        Arc::new(KeeperMetrics {
            transactions_submitted: Counter::default(),
            transaction_failures: Counter::default(),
            gas_used: Histogram::new([1.0, 5.0, 10.0, 50.0, 100.0, 500.0, 1000.0].into_iter()),
            batch_size: Histogram::new([1.0, 2.0, 5.0, 10.0, 20.0, 50.0].into_iter()),
        })
    }

    #[tokio::test]
    async fn test_process_empty_batch() {
        let (tx, rx) = mpsc::channel(100);
        let provider = Arc::new(Provider::mock());
        let signer = Arc::new(Signer::new_random());
        let metrics = setup_test_metrics();

        let keeper = Keeper::new(
            provider,
            signer,
            rx,
            metrics.clone(),
            1,
            10,
            Duration::from_secs(5),
        ).await.unwrap();

        let mut requests = Vec::new();
        assert!(keeper.process_batch(&mut requests).await.is_ok());
        assert!(requests.is_empty());
    }

    #[tokio::test]
    async fn test_batch_size_metrics() {
        let (tx, rx) = mpsc::channel(100);
        let provider = Arc::new(Provider::mock());
        let signer = Arc::new(Signer::new_random());
        let metrics = setup_test_metrics();

        let keeper = Keeper::new(
            provider,
            signer,
            rx,
            metrics.clone(),
            1,
            10,
            Duration::from_secs(5),
        ).await.unwrap();

        let mut requests = vec![
            PriceUpdateRequest {
                provider: Address::zero(),
                sequence_number: 1.into(),
                publish_time: 1234.into(),
                price_ids: vec![[0u8; 32]],
                callback_gas_limit: 100000.into(),
                requester: Address::zero(),
            },
            PriceUpdateRequest {
                provider: Address::zero(),
                sequence_number: 2.into(),
                publish_time: 1234.into(),
                price_ids: vec![[0u8; 32]],
                callback_gas_limit: 100000.into(),
                requester: Address::zero(),
            },
        ];

        // Process batch should succeed and update metrics
        keeper.process_batch(&mut requests).await.unwrap();

        // Check that batch size metric was updated
        let batch_size = metrics.batch_size.get_or_create(&()).get_count();
        assert_eq!(batch_size, 2);
    }

    #[tokio::test]
    async fn test_transaction_failure_metrics() {
        let (tx, rx) = mpsc::channel(100);
        let provider = Arc::new(Provider::mock().with_error());  // Mock provider that returns errors
        let signer = Arc::new(Signer::new_random());
        let metrics = setup_test_metrics();

        let keeper = Keeper::new(
            provider,
            signer,
            rx,
            metrics.clone(),
            1,
            10,
            Duration::from_secs(5),
        ).await.unwrap();

        let mut requests = vec![
            PriceUpdateRequest {
                provider: Address::zero(),
                sequence_number: 1.into(),
                publish_time: 1234.into(),
                price_ids: vec![[0u8; 32]],
                callback_gas_limit: 100000.into(),
                requester: Address::zero(),
            },
        ];

        // Process batch should fail and update failure metrics
        assert!(keeper.process_batch(&mut requests).await.is_err());

        // Check that failure metric was updated
        let failures = metrics.transaction_failures.get();
        assert_eq!(failures, 1);
    }
}
