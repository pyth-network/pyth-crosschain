use crate::api::ChainId;
use chrono::{DateTime, NaiveDateTime};
use ethers::abi::AbiEncode;
use ethers::prelude::TxHash;
use serde::Serialize;
use sqlx::{migrate, Pool, Sqlite, SqlitePool};
use tokio::spawn;
use tokio::sync::mpsc;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, PartialEq)]
pub enum RequestLogType {
    Observed { tx_hash: TxHash },
    FailedToReveal { reason: String },
    Revealed { tx_hash: TxHash },
    Landed { block_number: u64 },
}

impl RequestLogType {
    pub fn get_tx_hash(&self) -> Option<TxHash> {
        match self {
            RequestLogType::Observed { tx_hash } => Some(*tx_hash),
            RequestLogType::FailedToReveal { .. } => None,
            RequestLogType::Revealed { tx_hash } => Some(*tx_hash),
            RequestLogType::Landed { .. } => None,
        }
    }

    pub fn get_info(&self) -> Option<String> {
        match self {
            RequestLogType::Observed { tx_hash } => None,
            RequestLogType::FailedToReveal { reason } => Some(reason.clone()),
            RequestLogType::Revealed { tx_hash } => None,
            RequestLogType::Landed { block_number } => None,
        }
    }
    pub fn get_type(&self) -> String {
        match self {
            RequestLogType::Observed { .. } => "Observed".to_string(),
            RequestLogType::FailedToReveal { .. } => "FailedToReveal".to_string(),
            RequestLogType::Revealed { .. } => "Revealed".to_string(),
            RequestLogType::Landed { .. } => "Landed".to_string(),
        }
    }

    pub fn get_block_number(&self) -> Option<u64> {
        match self {
            RequestLogType::Observed { .. } => None,
            RequestLogType::FailedToReveal { .. } => None,
            RequestLogType::Revealed { .. } => None,
            RequestLogType::Landed { block_number } => Some(*block_number),
        }
    }
}

#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
pub struct RequestLog {
    pub chain_id: ChainId,
    pub sequence: u64,
    pub timestamp: DateTime<chrono::Utc>,
    pub log: RequestLogType,
}

type RequestKey = (ChainId, u64);

struct LogRow {
    id: i64,
    chain_id: String,
    sequence: i64,
    timestamp: NaiveDateTime,
    r#type: String,
    block_number: Option<i64>,
    info: Option<String>,
    tx_hash: Option<String>,
}

impl From<LogRow> for RequestLog {
    fn from(row: LogRow) -> Self {
        let chain_id = row.chain_id;
        let sequence = row.sequence as u64;
        let timestamp = row.timestamp.and_utc();
        let log_type = match row.r#type.as_str() {
            "Observed" => RequestLogType::Observed {
                tx_hash: row.tx_hash.unwrap_or_default().parse().unwrap(),
            },
            "FailedToReveal" => RequestLogType::FailedToReveal {
                reason: row.info.unwrap_or_default(),
            },
            "Revealed" => RequestLogType::Revealed {
                tx_hash: row.tx_hash.unwrap_or_default().parse().unwrap(),
            },
            "Landed" => RequestLogType::Landed {
                block_number: row.block_number.unwrap_or_default() as u64,
            },
            _ => panic!("Unknown log type"),
        };
        Self {
            chain_id,
            sequence,
            timestamp,
            log: log_type,
        }
    }
}

pub struct History {
    pool: Pool<Sqlite>,
    write_queue: mpsc::Sender<RequestLog>,
    writer_thread: tokio::task::JoinHandle<()>,
}

impl History {
    const MAX_HISTORY: usize = 1_000_000;
    const MAX_WRITE_QUEUE: usize = 1_000;
    pub async fn new() -> Self {
        Self::new_with_url("sqlite:fortuna.db").await
    }

    pub async fn new_in_memory() -> Self {
        Self::new_with_url("sqlite::memory:").await
    }

    pub async fn new_with_url(url: &str) -> Self {
        let pool = SqlitePool::connect(url).await.unwrap();
        let migrator = migrate!("./migrations");
        migrator.run(&pool).await.unwrap();
        Self::new_with_pool(pool).await
    }
    pub async fn new_with_pool(pool: Pool<Sqlite>) -> Self {
        let (sender, mut receiver) = mpsc::channel(Self::MAX_WRITE_QUEUE);
        let pool_write_connection = pool.clone();
        let writer_thread = spawn(
            async move {
                while let Some(log) = receiver.recv().await {
                    Self::add_to_db(&pool_write_connection, log).await;
                }
            },
        );
        Self {
            pool,
            write_queue: sender,
            writer_thread,
        }
    }

    async fn add_to_db(pool: &Pool<Sqlite>, log: RequestLog) {
        let sequence = log.sequence as i64;
        let log_type = log.log.get_type();
        let block_number = log
            .log
            .get_block_number()
            .map(|block_number| block_number as i64); // sqlite does not support u64
        let tx_hash = log.log.get_tx_hash().map(|tx_hash| tx_hash.encode_hex());
        let info = log.log.get_info();
        sqlx::query!("INSERT INTO log (chain_id, sequence, timestamp, type, block_number, info, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
            log.chain_id,
            sequence,
            log.timestamp,
            log_type,
            block_number,
            info,
            tx_hash)
            .execute(pool)
            .await
            .unwrap();
    }

    pub async fn get_from_db(&self, (chain_id, sequence): RequestKey) -> Vec<RequestLog> {
        let sequence = sequence as i64;
        let row = sqlx::query_as!(
            LogRow,
            "SELECT * FROM log WHERE chain_id = ? AND sequence = ?",
            chain_id,
            sequence
        )
        .fetch_all(&self.pool)
        .await
        .unwrap();
        row.into_iter().map(|row| row.into()).collect()
    }

    pub fn add(&mut self, log: RequestLog) {
        if let Err(e) = self.write_queue.try_send(log) {
            tracing::warn!("Failed to send log to write queue: {}", e);
        }
    }

    pub async fn get_request_logs(&self, request_key: &RequestKey) -> Vec<RequestLog> {
        self.get_from_db(request_key.clone()).await
    }

    pub async fn get_request_logs_by_tx_hash(&self, tx_hash: TxHash) -> Vec<RequestLog> {
        let tx_hash = tx_hash.encode_hex();
        let rows = sqlx::query_as!(LogRow, "SELECT * FROM log WHERE tx_hash = ?", tx_hash)
            .fetch_all(&self.pool)
            .await
            .unwrap();
        rows.into_iter().map(|row| row.into()).collect()
    }

    pub async fn get_latest_requests(
        &self,
        chain_id: Option<&ChainId>,
        limit: u64,
        min_timestamp: Option<DateTime<chrono::Utc>>,
        max_timestamp: Option<DateTime<chrono::Utc>>,
    ) -> Vec<RequestLog> {
        let limit = limit as i64;
        let rows = match chain_id {
            Some(chain_id) => {
                let chain_id = chain_id.to_string();
                let min_timestamp = min_timestamp.unwrap_or(DateTime::<chrono::Utc>::MIN_UTC);
                let max_timestamp = max_timestamp.unwrap_or(DateTime::<chrono::Utc>::MAX_UTC);
                sqlx::query_as!(LogRow, "SELECT * FROM log WHERE chain_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?",
                    chain_id,
                    min_timestamp,
                    max_timestamp,
                    limit).fetch_all(&self.pool).await
            }
            None => {
                let min_timestamp = min_timestamp.unwrap_or(DateTime::<chrono::Utc>::MIN_UTC);
                let max_timestamp = max_timestamp.unwrap_or(DateTime::<chrono::Utc>::MAX_UTC);
                sqlx::query_as!(LogRow, "SELECT * FROM log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT ?",
                    min_timestamp,
                    max_timestamp,
                    limit).fetch_all(&self.pool).await
            }
        };
        rows.unwrap().into_iter().map(|row| row.into()).collect()
    }
}

mod tests {
    use tokio::time::sleep;
    use super::*;

    #[tokio::test]
    async fn test_history() {
        let history = History::new_in_memory().await;
        let log = RequestLog {
            chain_id: "ethereum".to_string(),
            sequence: 1,
            timestamp: chrono::Utc::now(),
            log: RequestLogType::Observed {
                tx_hash: TxHash::zero(),
            },
        };
        History::add_to_db(&history.pool, log.clone()).await;
        let logs = history.get_request_logs(&("ethereum".to_string(), 1)).await;
        assert_eq!(logs, vec![log.clone()]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_writer_thread() {
        let mut history = History::new_in_memory().await;
        let log = RequestLog {
            chain_id: "ethereum".to_string(),
            sequence: 1,
            timestamp: chrono::Utc::now(),
            log: RequestLogType::Observed {
                tx_hash: TxHash::zero(),
            },
        };
        history.add(log.clone());
        // wait for the writer thread to write to the db
        sleep(std::time::Duration::from_secs(1)).await;
        let logs = history.get_request_logs(&("ethereum".to_string(), 1)).await;
        assert_eq!(logs, vec![log.clone()]);
    }
}
