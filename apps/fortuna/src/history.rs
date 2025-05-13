use crate::api::ChainId;
use chrono::{DateTime, NaiveDateTime};
use ethers::prelude::TxHash;
use ethers::types::BlockNumber;
use serde::Serialize;
use sqlx::{Pool, Sqlite, SqlitePool};
use std::collections::{BTreeMap, HashMap};
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize)]
pub enum JournalLog {
    Observed { tx_hash: TxHash },
    FailedToReveal { reason: String },
    Revealed { tx_hash: TxHash },
    Landed { block_number: u64 },
}

impl JournalLog {
    pub fn get_tx_hash(&self) -> Option<TxHash> {
        match self {
            JournalLog::Observed { tx_hash } => Some(*tx_hash),
            JournalLog::FailedToReveal { .. } => None,
            JournalLog::Revealed { tx_hash } => Some(*tx_hash),
            JournalLog::Landed { .. } => None,
        }
    }

    pub fn get_info(&self) -> Option<String> {
        match self {
            JournalLog::Observed { tx_hash } => None,
            JournalLog::FailedToReveal { reason } => Some(reason.clone()),
            JournalLog::Revealed { tx_hash } => None,
            JournalLog::Landed { block_number } => None,
        }
    }
    pub fn get_type(&self) -> String {
        match self {
            JournalLog::Observed { .. } => "Observed".to_string(),
            JournalLog::FailedToReveal { .. } => "FailedToReveal".to_string(),
            JournalLog::Revealed { .. } => "Revealed".to_string(),
            JournalLog::Landed { .. } => "Landed".to_string(),
        }
    }

    pub fn get_block_number(&self) -> Option<u64> {
        match self {
            JournalLog::Observed { .. } => None,
            JournalLog::FailedToReveal { .. } => None,
            JournalLog::Revealed { .. } => None,
            JournalLog::Landed { block_number } => Some(*block_number),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct TimedJournalLog {
    pub timestamp: DateTime<chrono::Utc>,
    pub log: JournalLog,
}

impl TimedJournalLog {
    pub fn with_current_time(log: JournalLog) -> Self {
        TimedJournalLog {
            timestamp: chrono::Utc::now(),
            log,
        }
    }
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct RequestJournal {
    pub chain_id: ChainId,
    pub sequence: u64,
    pub journal: Vec<TimedJournalLog>,
}

type RequestKey = (ChainId, u64);

struct LogRow {
    chain_id: String,
    sequence: i64,
    timestamp: NaiveDateTime,
    r#type: String,
    block_number: Option<i64>,
    info: Option<String>,
    tx_hash: Option<String>,
}

pub struct History {
    pub by_hash: HashMap<TxHash, Vec<RequestKey>>,
    pub by_chain_and_time: BTreeMap<(ChainId, DateTime<chrono::Utc>), RequestKey>,
    pub by_time: BTreeMap<DateTime<chrono::Utc>, RequestKey>,
    pub by_request_key: HashMap<RequestKey, RequestJournal>,
    pool: Pool<Sqlite>,
}

impl History {
    const MAX_HISTORY: usize = 1_000_000;
    pub async fn new() -> Self {
        let pool = SqlitePool::connect("sqlite:fortuna.db").await.unwrap();
        Self {
            by_hash: HashMap::new(),
            by_chain_and_time: BTreeMap::new(),
            by_time: BTreeMap::new(),
            by_request_key: HashMap::new(),
            pool,
        }
    }

    pub async fn add_to_db(
        &self,
        (chain_id, sequence): RequestKey,
        request_journal_log: TimedJournalLog,
    ) {
        let sequence = sequence as i64;
        let log_type = request_journal_log.log.get_type();
        let block_number = request_journal_log
            .log
            .get_block_number()
            .map(|block_number| block_number as i64); // sqlite does not support u64
        let tx_hash = request_journal_log
            .log
            .get_tx_hash()
            .map(|tx_hash| tx_hash.to_string());
        let info = request_journal_log.log.get_info();
        sqlx::query!("INSERT INTO log (chain_id, sequence, timestamp, type, block_number, info, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
            chain_id,
            sequence,
            request_journal_log.timestamp,
            log_type,
            block_number,
            info,
            tx_hash)
            .execute(&self.pool)
            .await
            .unwrap();
    }

    pub async fn get_from_db(&self, (chain_id, sequence): RequestKey) -> Option<TimedJournalLog> {
        let sequence = sequence as i64;
        let row =  sqlx::query_as!(LogRow, "SELECT chain_id, sequence, timestamp, type, block_number, info, tx_hash FROM log WHERE chain_id = ? AND sequence = ?", chain_id, sequence)
            .fetch_optional(&self.pool)
            .await
            .unwrap();
        if let Some(row) = row {
            let ts = row.timestamp;
            Some(TimedJournalLog {
                timestamp: ts.and_utc(),
                log: JournalLog::Observed {
                    tx_hash: TxHash::zero(),
                },
            })
        } else {
            None
        }
    }

    pub fn add(&mut self, (chain_id, sequence): RequestKey, request_journal_log: TimedJournalLog) {
        self.add_to_db((chain_id, sequence), request_journal_log);
    }

    pub fn get_request_logs(&self, request_key: &RequestKey) -> Option<RequestJournal> {
        self.by_request_key.get(request_key).cloned()
    }

    pub fn get_request_logs_by_tx_hash(&self, tx_hash: TxHash) -> Vec<RequestJournal> {
        self.by_hash
            .get(&tx_hash)
            .map(|request_keys| {
                request_keys
                    .iter()
                    .map(|request_key| self.by_request_key.get(request_key).unwrap().clone())
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_latest_requests(
        &self,
        chain_id: Option<&ChainId>,
        limit: u64,
        min_timestamp: Option<DateTime<chrono::Utc>>,
        max_timestamp: Option<DateTime<chrono::Utc>>,
    ) -> Vec<RequestJournal> {
        match chain_id {
            Some(chain_id) => {
                let range = self.by_chain_and_time.range(
                    (
                        chain_id.clone(),
                        min_timestamp.unwrap_or(DateTime::<chrono::Utc>::MIN_UTC),
                    )
                        ..(
                            chain_id.clone(),
                            max_timestamp.unwrap_or(DateTime::<chrono::Utc>::MAX_UTC),
                        ),
                );
                range
                    .rev()
                    .take(limit as usize)
                    .map(|(_, request_key)| self.by_request_key.get(request_key).unwrap().clone())
                    .collect()
            }
            None => self
                .by_time
                .range(
                    min_timestamp.unwrap_or(DateTime::<chrono::Utc>::MIN_UTC)
                        ..max_timestamp.unwrap_or(DateTime::<chrono::Utc>::MAX_UTC),
                )
                .rev()
                .take(limit as usize)
                .map(|(_time, request_key)| self.by_request_key.get(request_key).unwrap().clone())
                .collect::<Vec<_>>(),
        }
    }
}

mod tests {
    use super::*;

    #[sqlx::test]
    async fn test_history(pool: Pool<Sqlite>) {
        let history = History {
            by_hash: HashMap::new(),
            by_chain_and_time: BTreeMap::new(),
            by_time: BTreeMap::new(),
            by_request_key: HashMap::new(),
            pool,
        };
        history
            .add_to_db(
                ("ethereum".to_string(), 1),
                TimedJournalLog::with_current_time(JournalLog::Observed {
                    tx_hash: TxHash::zero(),
                }),
            )
            .await;
    }
}
