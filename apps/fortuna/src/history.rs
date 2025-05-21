use {
    crate::api::ChainId,
    anyhow::Result,
    chrono::{DateTime, NaiveDateTime},
    ethers::{
        core::utils::hex::ToHex,
        prelude::TxHash,
        types::{Address, U256},
        utils::keccak256,
    },
    serde::Serialize,
    serde_with::serde_as,
    sqlx::{migrate, Pool, Sqlite, SqlitePool},
    std::sync::Arc,
    tokio::{spawn, sync::mpsc},
    utoipa::ToSchema,
};

#[serde_as]
#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum RequestEntryState {
    Pending,
    Completed {
        /// The block number of the reveal transaction.
        reveal_block_number: u64,
        /// The transaction hash of the reveal transaction.
        #[schema(example = "0xfe5f880ac10c0aae43f910b5a17f98a93cdd2eb2dce3a5ae34e5827a3a071a32", value_type = String)]
        reveal_tx_hash: TxHash,
        /// The provider contribution to the random number.
        #[schema(example = "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe")]
        #[serde_as(as = "serde_with::hex::Hex")]
        provider_random_number: [u8; 32],
        /// The gas used for the reveal transaction in the smallest unit of the chain.
        /// For example, if the native currency is ETH, this will be in wei.
        #[schema(example = "567890", value_type = String)]
        #[serde(with = "crate::serde::u256")]
        gas_used: U256,
        /// The combined random number generated from the user and provider contributions.
        #[schema(example = "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe")]
        #[serde_as(as = "serde_with::hex::Hex")]
        combined_random_number: [u8; 32],
    },
    Failed {
        reason: String,
        /// The provider contribution to the random number.
        #[schema(example = "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe")]
        #[serde_as(as = "Option<serde_with::hex::Hex>")]
        provider_random_number: Option<[u8; 32]>,
    },
}

#[serde_as]
#[derive(Clone, Debug, Serialize, ToSchema, PartialEq)]
pub struct RequestStatus {
    /// The chain ID of the request.
    #[schema(example = "ethereum", value_type = String)]
    pub chain_id: ChainId,
    #[schema(example = "0x6cc14824ea2918f5de5c2f75a9da968ad4bd6344", value_type = String)]
    pub provider: Address,
    pub sequence: u64,
    #[schema(example = "2023-10-01T00:00:00Z", value_type = String)]
    pub created_at: DateTime<chrono::Utc>,
    #[schema(example = "2023-10-01T00:00:05Z", value_type = String)]
    pub last_updated_at: DateTime<chrono::Utc>,
    pub request_block_number: u64,
    /// The transaction hash of the request transaction.
    #[schema(example = "0x5a3a984f41bb5443f5efa6070ed59ccb25edd8dbe6ce7f9294cf5caa64ed00ae", value_type = String)]
    pub request_tx_hash: TxHash,
    /// Gas limit for the callback in the smallest unit of the chain.
    /// For example, if the native currency is ETH, this will be in wei.
    #[schema(example = "500000", value_type = String)]
    #[serde(with = "crate::serde::u256")]
    pub gas_limit: U256,
    /// The user contribution to the random number.
    #[schema(example = "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe")]
    #[serde_as(as = "serde_with::hex::Hex")]
    pub user_random_number: [u8; 32],
    /// This is the address that initiated the request.
    #[schema(example = "0x78357316239040e19fc823372cc179ca75e64b81", value_type = String)]
    pub sender: Address,
    pub state: RequestEntryState,
}

impl RequestStatus {
    pub fn generate_combined_random_number(
        user_random_number: &[u8; 32],
        provider_random_number: &[u8; 32],
    ) -> [u8; 32] {
        let mut concat: [u8; 96] = [0; 96]; // last 32 bytes are for the block hash which is not used here
        concat[0..32].copy_from_slice(user_random_number);
        concat[32..64].copy_from_slice(provider_random_number);
        keccak256(&concat)
    }
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
    user_random_number: String,
    sender: String,
    gas_limit: String,
    reveal_block_number: Option<i64>,
    reveal_tx_hash: Option<String>,
    provider_random_number: Option<String>,
    gas_used: Option<String>,
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
        let user_random_number = hex::FromHex::from_hex(row.user_random_number)?;
        let request_tx_hash = row.request_tx_hash.parse()?;
        let sender = row.sender.parse()?;
        let gas_limit = U256::from_dec_str(&row.gas_limit)
            .map_err(|_| anyhow::anyhow!("Failed to parse gas limit"))?;

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
                let provider_random_number = row.provider_random_number.ok_or(anyhow::anyhow!(
                    "Provider random number is missing for completed request"
                ))?;
                let provider_random_number: [u8; 32] =
                    hex::FromHex::from_hex(provider_random_number)?;
                let gas_used = row
                    .gas_used
                    .ok_or(anyhow::anyhow!("Gas used is missing for completed request"))?;
                let gas_used = U256::from_dec_str(&gas_used)
                    .map_err(|_| anyhow::anyhow!("Failed to parse gas used"))?;
                RequestEntryState::Completed {
                    reveal_block_number,
                    reveal_tx_hash,
                    provider_random_number,
                    gas_used,
                    combined_random_number: Self::generate_combined_random_number(
                        &user_random_number,
                        &provider_random_number,
                    ),
                }
            }
            "Failed" => RequestEntryState::Failed {
                reason: row.info.unwrap_or_default(),
                provider_random_number: match row.provider_random_number {
                    Some(provider_random_number) => {
                        Some(hex::FromHex::from_hex(provider_random_number)?)
                    }
                    None => None,
                },
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
            user_random_number,
            sender,
            gas_limit,
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
        let gas_limit = new_status.gas_limit.to_string();
        let result = match new_status.state {
            RequestEntryState::Pending => {
                let block_number = new_status.request_block_number as i64;
                let sender: String = new_status.sender.encode_hex();
                let user_random_number: String = new_status.user_random_number.encode_hex();
                sqlx::query!("INSERT INTO request(chain_id, provider, sequence, created_at, last_updated_at, state, request_block_number, request_tx_hash, user_random_number, sender, gas_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    chain_id,
                    provider,
                    sequence,
                    new_status.created_at,
                    new_status.last_updated_at,
                    "Pending",
                    block_number,
                    request_tx_hash,
                    user_random_number,
                    sender,
                    gas_limit
            )
                    .execute(pool)
                    .await
            }
            RequestEntryState::Completed {
                reveal_block_number,
                reveal_tx_hash,
                provider_random_number,
                gas_used,
                combined_random_number: _,
            } => {
                let reveal_block_number = reveal_block_number as i64;
                let reveal_tx_hash: String = reveal_tx_hash.encode_hex();
                let provider_random_number: String = provider_random_number.encode_hex();
                let gas_used: String = gas_used.to_string();
                let result = sqlx::query!("UPDATE request SET state = ?, last_updated_at = ?, reveal_block_number = ?, reveal_tx_hash = ?, provider_random_number =?, gas_used = ? WHERE chain_id = ? AND sequence = ? AND provider = ? AND request_tx_hash = ?",
                    "Completed",
                    new_status.last_updated_at,
                    reveal_block_number,
                    reveal_tx_hash,
                    provider_random_number,
                    gas_used,
                    chain_id,
                    sequence,
                    provider,
                    request_tx_hash)
                    .execute(pool)
                    .await;
                if let Ok(query_result) = &result {
                    if query_result.rows_affected() == 0 {
                        tracing::error!("Failed to update request status to complete: No rows affected. Chain ID: {}, Sequence: {}, Request TX Hash: {}", chain_id, sequence, request_tx_hash);
                    }
                }
                result
            }
            RequestEntryState::Failed {
                reason,
                provider_random_number,
            } => {
                let provider_random_number: Option<String> = match provider_random_number {
                    Some(provider_random_number) => Some(provider_random_number.encode_hex()),
                    None => None,
                };
                sqlx::query!("UPDATE request SET state = ?, last_updated_at = ?, info = ?, provider_random_number = ? WHERE chain_id = ? AND sequence = ? AND provider = ? AND request_tx_hash = ? AND state = 'Pending'",
                    "Failed",
                    new_status.last_updated_at,
                    reason,
                    provider_random_number,
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
        offset: u64,
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
        let offset = offset as i64;
        let rows = match chain_id {
            Some(chain_id) => {
                let chain_id = chain_id.to_string();
                sqlx::query_as!(RequestRow, "SELECT * FROM request WHERE chain_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    chain_id,
                    min_timestamp,
                    max_timestamp,
                    limit,
                offset).fetch_all(&self.pool).await
            }
            None => {
                sqlx::query_as!(RequestRow, "SELECT * FROM request WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    min_timestamp,
                    max_timestamp,
                    limit,
                offset).fetch_all(&self.pool).await
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
    use {super::*, chrono::Duration, tokio::time::sleep};

    fn get_random_request_status() -> RequestStatus {
        RequestStatus {
            chain_id: "ethereum".to_string(),
            provider: Address::random(),
            sequence: 1,
            created_at: chrono::Utc::now(),
            last_updated_at: chrono::Utc::now(),
            request_block_number: 1,
            request_tx_hash: TxHash::random(),
            user_random_number: [20; 32],
            sender: Address::random(),
            state: RequestEntryState::Pending,
            gas_limit: U256::from(500_000),
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
            provider_random_number: [40; 32],
            gas_used: U256::from(567890),
            combined_random_number: RequestStatus::generate_combined_random_number(
                &status.user_random_number,
                &[40; 32],
            ),
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
    async fn test_no_transition_from_completed_to_failed() {
        let history = History::new_in_memory().await.unwrap();
        let reveal_tx_hash = TxHash::random();
        let mut status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;
        status.state = RequestEntryState::Completed {
            reveal_block_number: 1,
            reveal_tx_hash,
            provider_random_number: [40; 32],
            gas_used: U256::from(567890),
            combined_random_number: RequestStatus::generate_combined_random_number(
                &status.user_random_number,
                &[40; 32],
            ),
        };
        History::update_request_status(&history.pool, status.clone()).await;
        let mut failed_status = status.clone();
        failed_status.state = RequestEntryState::Failed {
            reason: "Failed".to_string(),
            provider_random_number: None,
        };
        History::update_request_status(&history.pool, failed_status).await;

        let logs = history
            .get_requests_by_tx_hash(reveal_tx_hash)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);
    }

    #[tokio::test]
    async fn test_failed_state() {
        let history = History::new_in_memory().await.unwrap();
        let mut status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;
        status.state = RequestEntryState::Failed {
            reason: "Failed".to_string(),
            provider_random_number: Some([40; 32]),
        };
        History::update_request_status(&history.pool, status.clone()).await;
        let logs = history
            .get_requests_by_tx_hash(status.request_tx_hash)
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);
    }

    #[tokio::test]
    async fn test_generate_combined_random_number() {
        let user_random_number = hex::FromHex::from_hex(
            "0000000000000000000000006c8ac03d388d5572f77aca84573628ee87a7a4da",
        )
        .unwrap();
        let provider_random_number = hex::FromHex::from_hex(
            "deeb67cb894c33f7b20ae484228a9096b51e8db11461fcb0975c681cf0875d37",
        )
        .unwrap();
        let combined_random_number = RequestStatus::generate_combined_random_number(
            &user_random_number,
            &provider_random_number,
        );
        let expected_combined_random_number: [u8; 32] = hex::FromHex::from_hex(
            "1c26ffa1f8430dc91cb755a98bf37ce82ac0e2cfd961e10111935917694609d5",
        )
        .unwrap();
        assert_eq!(combined_random_number, expected_combined_random_number,);
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
                    0,
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
                    0,
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
                    0,
                    None,
                    Some(status.created_at - Duration::seconds(1)),
                )
                .await
                .unwrap();
            assert_eq!(logs, vec![]);

            // no min or max
            let logs = history
                .get_requests_by_time(chain_id.clone(), 10, 0, None, None)
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
