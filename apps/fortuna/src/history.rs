use crate::api::ChainId;
use anyhow::Result;
use chrono::{DateTime, NaiveDateTime};
use ethers::core::utils::hex::ToHex;
use ethers::prelude::TxHash;
use ethers::types::Address;
use serde::Serialize;
use sqlx::{migrate, Pool, Sqlite, SqlitePool};
use std::sync::Arc;
use tokio::spawn;
use tokio::sync::mpsc;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
pub enum RequestEntryState {
    Pending,
    Completed {
        reveal_block_number: u64,
        reveal_tx_hash: TxHash,
    },
    Failed {
        reason: String,
    },
}

#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
pub struct RequestStatus {
    pub chain_id: ChainId,
    pub provider: Address,
    pub sequence: u64,
    pub created_at: DateTime<chrono::Utc>,
    pub last_updated_at: DateTime<chrono::Utc>,
    pub request_block_number: u64,
    pub request_tx_hash: TxHash,
    pub sender: Address,
    pub state: RequestEntryState,
}

#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
struct RequestRow {
    chain_id: String,
    provider: String,
    sequence: i64,
    created_at: NaiveDateTime,
    last_updated_at: NaiveDateTime,
    state: String,
    request_block_number: i64,
    request_tx_hash: String,
    sender: String,
    reveal_block_number: Option<i64>,
    reveal_tx_hash: Option<String>,
    info: Option<String>,
}

impl TryFrom<RequestRow> for RequestStatus {
    type Error = anyhow::Error;

    fn try_from(row: RequestRow) -> Result<Self, Self::Error> {
        let chain_id = row.chain_id;
        let provider = row.provider.parse()?;
        let sequence = row.sequence as u64;
        let created_at = row.created_at.and_utc();
        let last_updated_at = row.last_updated_at.and_utc();
        let request_block_number = row.request_block_number as u64;
        let request_tx_hash = row.request_tx_hash.parse()?;
        let sender = row.sender.parse()?;

        let state = match row.state.as_str() {
            "Pending" => RequestEntryState::Pending,
            "Completed" => {
                let reveal_block_number = row.reveal_block_number.ok_or(anyhow::anyhow!(
                    "Reveal block number is missing for completed request"
                ))? as u64;
                let reveal_tx_hash = row
                    .reveal_tx_hash
                    .ok_or(anyhow::anyhow!(
                        "Reveal transaction hash is missing for completed request"
                    ))?
                    .parse()?;
                RequestEntryState::Completed {
                    reveal_block_number,
                    reveal_tx_hash,
                }
            }
            "Failed" => RequestEntryState::Failed {
                reason: row.info.unwrap_or_default(),
            },
            _ => return Err(anyhow::anyhow!("Unknown request state: {}", row.state)),
        };
        Ok(Self {
            chain_id,
            provider,
            sequence,
            created_at,
            last_updated_at,
            state,
            request_block_number,
            request_tx_hash,
            sender,
        })
    }
}

impl From<RequestRow> for Option<RequestStatus> {
    fn from(row: RequestRow) -> Self {
        match RequestStatus::try_from(row) {
            Ok(status) => Some(status),
            Err(e) => {
                tracing::error!("Failed to convert RequestRow to RequestStatus: {}", e);
                None
            }
        }
    }
}

pub struct History {
    pool: Pool<Sqlite>,
    write_queue: mpsc::Sender<RequestStatus>,
    _writer_thread: Arc<tokio::task::JoinHandle<()>>,
}

impl History {
    const MAX_WRITE_QUEUE: usize = 1_000;
    pub async fn new() -> Result<Self> {
        Self::new_with_url("sqlite:fortuna.db?mode=rwc").await
    }

    pub async fn new_in_memory() -> Result<Self> {
        Self::new_with_url("sqlite::memory:").await
    }

    pub async fn new_with_url(url: &str) -> Result<Self> {
        let pool = SqlitePool::connect(url).await?;
        let migrator = migrate!("./migrations");
        migrator.run(&pool).await?;
        Self::new_with_pool(pool).await
    }
    pub async fn new_with_pool(pool: Pool<Sqlite>) -> Result<Self> {
        let (sender, mut receiver) = mpsc::channel(Self::MAX_WRITE_QUEUE);
        let pool_write_connection = pool.clone();
        let writer_thread = spawn(async move {
            while let Some(log) = receiver.recv().await {
                Self::update_request_status(&pool_write_connection, log).await;
            }
        });
        Ok(Self {
            pool,
            write_queue: sender,
            _writer_thread: Arc::new(writer_thread),
        })
    }

    async fn update_request_status(pool: &Pool<Sqlite>, new_status: RequestStatus) {
        let sequence = new_status.sequence as i64;
        let chain_id = new_status.chain_id;
        let request_tx_hash: String = new_status.request_tx_hash.encode_hex();
        let provider: String = new_status.provider.encode_hex();
        let result = match new_status.state {
            RequestEntryState::Pending => {
                let block_number = new_status.request_block_number as i64;
                let sender: String = new_status.sender.encode_hex();
                sqlx::query!("INSERT INTO request(chain_id, provider, sequence, created_at, last_updated_at, state, request_block_number, request_tx_hash, sender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    chain_id,
                    provider,
                    sequence,
                    new_status.created_at,
                    new_status.last_updated_at,
                    "Pending",
                    block_number,
                    request_tx_hash,
                    sender)
                    .execute(pool)
                    .await
            }
            RequestEntryState::Completed {
                reveal_block_number,
                reveal_tx_hash,
            } => {
                let reveal_block_number = reveal_block_number as i64;
                let reveal_tx_hash: String = reveal_tx_hash.encode_hex();
                sqlx::query!("UPDATE request SET state = ?, last_updated_at = ?, reveal_block_number = ?, reveal_tx_hash = ? WHERE chain_id = ? AND sequence = ? AND provider = ? AND request_tx_hash = ?",
                    "Completed",
                    new_status.last_updated_at,
                    reveal_block_number,
                    reveal_tx_hash,
                    chain_id,
                    sequence,
                    provider,
                    request_tx_hash)
                    .execute(pool)
                    .await
            }
            RequestEntryState::Failed { reason } => {
                sqlx::query!("UPDATE request SET state = ?, last_updated_at = ?, info = ? WHERE chain_id = ? AND sequence = ? AND provider = ? AND request_tx_hash = ? AND state = 'Pending'",
                    "Failed",
                    new_status.last_updated_at,
                    reason,
                    chain_id,
                    sequence,
                    provider,
                    request_tx_hash)
                    .execute(pool)
                    .await
            }
        };
        if let Err(e) = result {
            tracing::error!("Failed to update request status: {}", e);
        }
    }

    pub fn add(&self, log: &RequestStatus) {
        if let Err(e) = self.write_queue.try_send(log.clone()) {
            tracing::error!("Failed to send log to write queue: {}", e);
        }
    }

    pub async fn get_requests_by_tx_hash(&self, tx_hash: TxHash) -> Result<Vec<RequestStatus>> {
        let tx_hash: String = tx_hash.encode_hex();
        let rows = sqlx::query_as!(
            RequestRow,
            "SELECT * FROM request WHERE request_tx_hash = ? OR reveal_tx_hash = ?",
            tx_hash,
            tx_hash
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch request by tx hash: {}", e);
            e
        })?;
        Ok(rows.into_iter().filter_map(|row| row.into()).collect())
    }

    pub async fn get_requests_by_sender(
        &self,
        sender: Address,
        chain_id: Option<ChainId>,
    ) -> Result<Vec<RequestStatus>> {
        let sender: String = sender.encode_hex();
        let rows = match chain_id {
            Some(chain_id) => {
                sqlx::query_as!(
                    RequestRow,
                    "SELECT * FROM request WHERE sender = ? AND chain_id = ?",
                    sender,
                    chain_id,
                )
                .fetch_all(&self.pool)
                .await
            }
            None => {
                sqlx::query_as!(RequestRow, "SELECT * FROM request WHERE sender = ?", sender,)
                    .fetch_all(&self.pool)
                    .await
            }
        }
        .map_err(|e| {
            tracing::error!("Failed to fetch request by sender: {}", e);
            e
        })?;
        Ok(rows.into_iter().filter_map(|row| row.into()).collect())
    }

    pub async fn get_requests_by_sequence(
        &self,
        sequence: u64,
        chain_id: Option<ChainId>,
    ) -> Result<Vec<RequestStatus>> {
        let sequence = sequence as i64;
        let rows = match chain_id {
            Some(chain_id) => {
                sqlx::query_as!(
                    RequestRow,
                    "SELECT * FROM request WHERE sequence = ? AND chain_id = ?",
                    sequence,
                    chain_id,
                )
                .fetch_all(&self.pool)
                .await
            }
            None => {
                sqlx::query_as!(
                    RequestRow,
                    "SELECT * FROM request WHERE sequence = ?",
                    sequence,
                )
                .fetch_all(&self.pool)
                .await
            }
        }
        .map_err(|e| {
            tracing::error!("Failed to fetch request by sequence: {}", e);
            e
        })?;
        Ok(rows.into_iter().filter_map(|row| row.into()).collect())
    }

    pub async fn get_requests_by_time(
        &self,
        chain_id: Option<ChainId>,
        limit: u64,
        min_timestamp: Option<DateTime<chrono::Utc>>,
        max_timestamp: Option<DateTime<chrono::Utc>>,
    ) -> Result<Vec<RequestStatus>> {
        // UTC_MIN and UTC_MAX are not valid timestamps in SQLite
        // So we need small and large enough timestamps to replace them
        let min_timestamp = min_timestamp.unwrap_or(
            "2012-12-12T12:12:12Z"
                .parse::<DateTime<chrono::Utc>>()
                .unwrap(),
        );
        let max_timestamp = max_timestamp.unwrap_or(
            "2050-12-12T12:12:12Z"
                .parse::<DateTime<chrono::Utc>>()
                .unwrap(),
        );
        let limit = limit as i64;
        let rows = match chain_id {
            Some(chain_id) => {
                let chain_id = chain_id.to_string();
                sqlx::query_as!(RequestRow, "SELECT * FROM request WHERE chain_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ?",
                    chain_id,
                    min_timestamp,
                    max_timestamp,
                    limit).fetch_all(&self.pool).await
            }
            None => {
                sqlx::query_as!(RequestRow, "SELECT * FROM request WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ?",
                    min_timestamp,
                    max_timestamp,
                    limit).fetch_all(&self.pool).await
            }
        }.map_err(|e| {
            tracing::error!("Failed to fetch request by time: {}", e);
            e
        })?;
        Ok(rows.into_iter().filter_map(|row| row.into()).collect())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use chrono::Duration;
    use tokio::time::sleep;

    fn get_random_request_status() -> RequestStatus {
        RequestStatus {
            chain_id: "ethereum".to_string(),
            provider: Address::random(),
            sequence: 1,
            created_at: chrono::Utc::now(),
            last_updated_at: chrono::Utc::now(),
            request_block_number: 1,
            request_tx_hash: TxHash::random(),
            sender: Address::random(),
            state: RequestEntryState::Pending,
        }
    }

    #[tokio::test]
    async fn test_history_return_correct_logs() {
        let history = History::new_in_memory().await.unwrap();
        let reveal_tx_hash = TxHash::random();
        let mut status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;
        status.state = RequestEntryState::Completed {
            reveal_block_number: 1,
            reveal_tx_hash,
        };
        History::update_request_status(&history.pool, status.clone()).await;

        let logs = history
            .get_requests_by_sequence(status.sequence, Some(status.chain_id.clone()))
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .get_requests_by_sequence(status.sequence, None)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .get_requests_by_tx_hash(status.request_tx_hash)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .get_requests_by_tx_hash(reveal_tx_hash)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .get_requests_by_sender(status.sender, Some(status.chain_id.clone()))
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .get_requests_by_sender(status.sender, None)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);
    }

    #[tokio::test]

    async fn test_history_filter_irrelevant_logs() {
        let history = History::new_in_memory().await.unwrap();
        let status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;

        let logs = history
            .get_requests_by_sequence(status.sequence, Some("not-ethereum".to_string()))
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .get_requests_by_sequence(status.sequence + 1, None)
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .get_requests_by_tx_hash(TxHash::zero())
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .get_requests_by_sender(Address::zero(), Some(status.chain_id.clone()))
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .get_requests_by_sender(Address::zero(), None)
            .await
            .unwrap();
        assert_eq!(logs, vec![]);
    }

    #[tokio::test]
    async fn test_history_time_filters() {
        let history = History::new_in_memory().await.unwrap();
        let status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;
        for chain_id in [None, Some("ethereum".to_string())] {
            // min = created_at = max
            let logs = history
                .get_requests_by_time(
                    chain_id.clone(),
                    10,
                    Some(status.created_at),
                    Some(status.created_at),
                )
                .await
                .unwrap();
            assert_eq!(logs, vec![status.clone()]);

            // min = created_at + 1
            let logs = history
                .get_requests_by_time(
                    chain_id.clone(),
                    10,
                    Some(status.created_at + Duration::seconds(1)),
                    None,
                )
                .await
                .unwrap();
            assert_eq!(logs, vec![]);

            // max = created_at - 1
            let logs = history
                .get_requests_by_time(
                    chain_id.clone(),
                    10,
                    None,
                    Some(status.created_at - Duration::seconds(1)),
                )
                .await
                .unwrap();
            assert_eq!(logs, vec![]);

            // no min or max
            let logs = history
                .get_requests_by_time(chain_id.clone(), 10, None, None)
                .await
                .unwrap();
            assert_eq!(logs, vec![status.clone()]);
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_writer_thread() {
        let history = History::new_in_memory().await.unwrap();
        let status = get_random_request_status();
        history.add(&status);
        // wait for the writer thread to write to the db
        sleep(std::time::Duration::from_secs(1)).await;
        let logs = history
            .get_requests_by_sequence(1, Some("ethereum".to_string()))
            .await
            .unwrap();
        assert_eq!(logs, vec![status]);
    }
}
