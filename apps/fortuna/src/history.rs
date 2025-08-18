use {
    crate::api::{ChainId, NetworkId, StateTag},
    anyhow::Result,
    chrono::DateTime,
    ethers::{
        core::utils::hex::ToHex,
        prelude::TxHash,
        types::{Address, Bytes, U256},
        utils::keccak256,
    },
    serde::Serialize,
    serde_with::serde_as,
    sqlx::{any::AnyPoolOptions, migrate, AnyPool, FromRow},
    std::{str::FromStr, sync::Arc},
    tokio::{spawn, sync::mpsc},
    utoipa::ToSchema,
};

const LOG_RETURN_LIMIT: u64 = 1000;
const ONE_DAY: u64 = 60 * 60 * 24;
const ONE_HOUR: u64 = 60 * 60;
const DEFAULT_DATABASE_URL: &str = "sqlite:fortuna.db?mode=rwc";

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
        /// Whether the callback to the caller failed.
        callback_failed: bool,
        /// Return value from the callback. If the callback failed, this field contains
        /// the error code and any additional returned data. Note that "" often indicates an out-of-gas error.
        /// If the callback returns more than 256 bytes, only the first 256 bytes of the callback return value are included.
        /// NOTE: This field is the raw bytes returned from the callback, not hex-decoded. The client should decode it as needed.
        #[schema(example = "0x4e487b710000000000000000000000000000000000000000000000000000000000000011", value_type = String)]
        callback_return_value: Bytes,
        /// How much gas the callback used.
        #[schema(example = "567890", value_type = String)]
        #[serde(with = "crate::serde::u32")]
        callback_gas_used: u32,
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
    /// The network ID of the request. This is the response of eth_chainId rpc call.
    #[schema(example = "1", value_type = u64)]
    pub network_id: NetworkId,
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
    pub gas_limit: u32,
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
        keccak256(concat)
    }
}

#[derive(Clone, Debug, Serialize, ToSchema, PartialEq, FromRow)]
struct RequestRow {
    chain_id: String,
    network_id: i64,
    provider: String,
    sequence: i64,
    created_at: i64,      // Unix timestamp
    last_updated_at: i64, // Unix timestamp
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
    callback_failed: Option<i64>,
    callback_return_value: Option<String>,
    callback_gas_used: Option<String>,
}

impl TryFrom<RequestRow> for RequestStatus {
    type Error = anyhow::Error;

    fn try_from(row: RequestRow) -> Result<Self, Self::Error> {
        let chain_id = row.chain_id;
        let network_id = row.network_id as u64;
        let provider = row.provider.parse()?;
        let sequence = row.sequence as u64;
        let created_at = DateTime::from_timestamp_millis(row.created_at)
            .ok_or(anyhow::anyhow!("Invalid created_at timestamp"))?;
        let last_updated_at = DateTime::from_timestamp_millis(row.last_updated_at)
            .ok_or(anyhow::anyhow!("Invalid last_updated_at timestamp"))?;
        let request_block_number = row.request_block_number as u64;
        let user_random_number = hex::FromHex::from_hex(row.user_random_number)?;
        let request_tx_hash = row.request_tx_hash.parse()?;
        let sender = row.sender.parse()?;
        let gas_limit = row
            .gas_limit
            .parse::<u32>()
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
                    //  Sqlx::Any doesn't support boolean types, so we need to convert from integer
                    //  https://github.com/launchbadge/sqlx/issues/2778
                    callback_failed: row.callback_failed.unwrap_or(0) == 1,
                    callback_return_value: row
                        .callback_return_value
                        .map(|s| s.parse::<Bytes>().unwrap_or_default())
                        .unwrap_or_default(),
                    callback_gas_used: row
                        .callback_gas_used
                        .unwrap_or_default()
                        .parse::<u32>()
                        .map_err(|_| anyhow::anyhow!("Failed to parse callback_gas_used"))?,
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
            network_id,
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
    pool: AnyPool,
    write_queue: mpsc::Sender<RequestStatus>,
    _writer_thread: Arc<tokio::task::JoinHandle<()>>,
}

impl History {
    const MAX_WRITE_QUEUE: usize = 1_000;
    pub async fn new() -> Result<Self> {
        let database_url =
            std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
        Self::new_with_url(&database_url).await
    }

    /// Create a History instance with an ephemeral in-memory DB.
    /// Useful for testing.
    pub async fn new_in_memory() -> Result<Self> {
        sqlx::any::install_default_drivers();
        // Connect to an in-memory SQLite database
        // Don't let the pool drop the cxn, otherwise the database will be deleted
        let pool = AnyPoolOptions::new()
            .min_connections(1)
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect("sqlite::memory:")
            .await?;
        let migrator = migrate!(); // defaults to "./migrations"
        migrator.run(&pool).await?;
        Self::new_with_pool(pool).await
    }

    /// Create a History instance with production DB parameters
    pub async fn new_with_url(url: &str) -> Result<Self> {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .min_connections(0)
            .max_connections(10)
            // Allow the cloud DB to spin down after 1 hour of inactivity (cost savings)
            .idle_timeout(std::time::Duration::from_secs(ONE_HOUR))
            // Retire the connection after 1 day to avoid memory leaks in the DB
            .max_lifetime(std::time::Duration::from_secs(ONE_DAY))
            .connect(url)
            .await?;
        let migrator = migrate!("./migrations");
        migrator.run(&pool).await?;
        Self::new_with_pool(pool).await
    }
    pub async fn new_with_pool(pool: AnyPool) -> Result<Self> {
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

    async fn update_request_status(pool: &AnyPool, new_status: RequestStatus) {
        let sequence = new_status.sequence as i64;
        let chain_id = new_status.chain_id;
        let network_id = new_status.network_id as i64;
        let request_tx_hash: String = new_status.request_tx_hash.encode_hex();
        let provider: String = new_status.provider.encode_hex();
        let gas_limit = new_status.gas_limit.to_string();
        let result = match new_status.state {
            RequestEntryState::Pending => {
                let block_number = new_status.request_block_number as i64;
                let sender: String = new_status.sender.encode_hex();
                let user_random_number: String = new_status.user_random_number.encode_hex();
                sqlx::query("INSERT INTO request(chain_id, network_id, provider, sequence, created_at, last_updated_at, state, request_block_number, request_tx_hash, user_random_number, sender, gas_limit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)")
                    .bind(chain_id.clone())
                    .bind(network_id)
                    .bind(provider.clone())
                    .bind(sequence)
                    .bind(new_status.created_at.timestamp_millis())
                    .bind(new_status.last_updated_at.timestamp_millis())
                    .bind("Pending")
                    .bind(block_number)
                    .bind(request_tx_hash.clone())
                    .bind(user_random_number)
                    .bind(sender)
                    .bind(gas_limit.clone())
                    .execute(pool)
                    .await
            }
            RequestEntryState::Completed {
                reveal_block_number,
                reveal_tx_hash,
                provider_random_number,
                gas_used,
                combined_random_number: _,
                callback_failed,
                callback_return_value,
                callback_gas_used,
            } => {
                let reveal_block_number = reveal_block_number as i64;
                let reveal_tx_hash: String = reveal_tx_hash.encode_hex();
                let provider_random_number: String = provider_random_number.encode_hex();
                let gas_used: String = gas_used.to_string();
                //  Sqlx::Any doesn't support boolean types, so we need to convert to integer
                //  https://github.com/launchbadge/sqlx/issues/2778
                let callback_failed: i64 = if callback_failed { 1 } else { 0 };
                let callback_return_value: String = callback_return_value.encode_hex();
                let callback_gas_used: String = callback_gas_used.to_string();
                let result = sqlx::query("UPDATE request SET state = $1, last_updated_at = $2, reveal_block_number = $3, reveal_tx_hash = $4, provider_random_number = $5, gas_used = $6, callback_failed = $7, callback_return_value = $8, callback_gas_used = $9 WHERE network_id = $10 AND sequence = $11 AND provider = $12 AND request_tx_hash = $13")
                    .bind("Completed")
                    .bind(new_status.last_updated_at.timestamp_millis())
                    .bind(reveal_block_number)
                    .bind(reveal_tx_hash)
                    .bind(provider_random_number)
                    .bind(gas_used)
                    .bind(callback_failed)
                    .bind(callback_return_value)
                    .bind(callback_gas_used)
                    .bind(network_id)
                    .bind(sequence)
                    .bind(provider.clone())
                    .bind(request_tx_hash.clone())
                    .execute(pool)
                    .await;
                if let Ok(query_result) = &result {
                    if query_result.rows_affected() == 0 {
                        tracing::error!("Failed to update request status to complete: No rows affected. Chain ID: {}, Sequence: {}, Request TX Hash: {}", network_id, sequence, request_tx_hash);
                    }
                }
                result
            }
            RequestEntryState::Failed {
                reason,
                provider_random_number,
            } => {
                let provider_random_number: Option<String> = provider_random_number
                    .map(|provider_random_number| provider_random_number.encode_hex());
                sqlx::query("UPDATE request SET state = $1, last_updated_at = $2, info = $3, provider_random_number = $4 WHERE network_id = $5 AND sequence = $6 AND provider = $7 AND request_tx_hash = $8 AND state = 'Pending'")
                    .bind("Failed")
                    .bind(new_status.last_updated_at.timestamp_millis())
                    .bind(reason)
                    .bind(provider_random_number)
                    .bind(network_id)
                    .bind(sequence)
                    .bind(provider)
                    .bind(request_tx_hash)
                    .execute(pool)
                    .await
            }
        };
        if let Err(e) = result {
            match e.as_database_error() {
                Some(db_error) if db_error.is_unique_violation() => {
                    tracing::info!(
                        "Failed to insert request, request already exists: Chain ID: {}, Sequence: {}",
                        network_id,
                        sequence
                    );
                }
                _ => {
                    tracing::error!("Failed to update request status: {}", e);
                }
            }
        }
    }

    pub fn add(&self, log: &RequestStatus) {
        if let Err(e) = self.write_queue.try_send(log.clone()) {
            tracing::error!("Failed to send log to write queue: {}", e);
        }
    }

    pub fn query(&self) -> RequestQueryBuilder {
        RequestQueryBuilder::new(&self.pool)
    }
}

#[derive(Debug, Clone)]
pub struct RequestQueryBuilder<'a> {
    pool: &'a AnyPool,
    pub search: Option<SearchField>,
    pub network_id: Option<i64>,
    pub state: Option<StateTag>,
    pub limit: i64,
    pub offset: i64,
    pub min_timestamp: DateTime<chrono::Utc>,
    pub max_timestamp: DateTime<chrono::Utc>,
}

impl<'a> RequestQueryBuilder<'a> {
    fn new(pool: &'a AnyPool) -> Self {
        Self {
            pool,
            search: None,
            network_id: None,
            state: None,
            limit: LOG_RETURN_LIMIT as i64,
            offset: 0,
            // UTC_MIN and UTC_MAX are not valid timestamps in SQLite
            // So we need small and large enough timestamps to replace them
            min_timestamp: "2012-12-12T12:12:12Z"
                .parse::<DateTime<chrono::Utc>>()
                .unwrap(),
            max_timestamp: "2050-12-12T12:12:12Z"
                .parse::<DateTime<chrono::Utc>>()
                .unwrap(),
        }
    }

    pub fn search(mut self, search: String) -> Result<Self, RequestQueryBuilderError> {
        if let Ok(tx_hash) = TxHash::from_str(&search) {
            Ok(SearchField::TxHash(tx_hash))
        } else if let Ok(sender) = Address::from_str(&search) {
            Ok(SearchField::Sender(sender))
        } else if let Ok(sequence_number) = u64::from_str(&search) {
            Ok(SearchField::SequenceNumber(sequence_number as i64))
        } else {
            Err(RequestQueryBuilderError::InvalidSearch)
        }
        .map(|search_field| {
            self.search = Some(search_field);
            self
        })
    }

    pub fn network_id(mut self, network_id: NetworkId) -> Self {
        self.network_id = Some(network_id as i64);
        self
    }

    pub fn state(mut self, state: StateTag) -> Self {
        self.state = Some(state);
        self
    }

    pub fn limit(mut self, limit: u64) -> Result<Self, RequestQueryBuilderError> {
        if limit > LOG_RETURN_LIMIT {
            Err(RequestQueryBuilderError::LimitTooLarge)
        } else if limit == 0 {
            Err(RequestQueryBuilderError::ZeroLimit)
        } else {
            self.limit = limit as i64;
            Ok(self)
        }
    }

    pub fn offset(mut self, offset: u64) -> Self {
        self.offset = offset as i64;
        self
    }

    pub fn min_timestamp(mut self, min_timestamp: DateTime<chrono::Utc>) -> Self {
        self.min_timestamp = min_timestamp;
        self
    }

    pub fn max_timestamp(mut self, max_timestamp: DateTime<chrono::Utc>) -> Self {
        self.max_timestamp = max_timestamp;
        self
    }

    pub async fn execute(&self) -> Result<Vec<RequestStatus>> {
        let mut sql = "SELECT * FROM request WHERE created_at BETWEEN $1 AND $2".to_string();
        let mut param_count = 2;

        // Build the SQL string with parameter placeholders
        match &self.search {
            Some(SearchField::TxHash(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND (request_tx_hash = ${param_count}"));
                param_count += 1;
                sql.push_str(&format!(" OR reveal_tx_hash = ${param_count})"));
            }
            Some(SearchField::Sender(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND sender = ${param_count}"));
            }
            Some(SearchField::SequenceNumber(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND sequence = ${param_count}"));
            }
            None => (),
        }

        if self.network_id.is_some() {
            param_count += 1;
            sql.push_str(&format!(" AND network_id = ${param_count}"));
        }

        if let Some(state) = &self.state {
            param_count += 1;
            sql.push_str(&format!(" AND state = ${param_count}"));

            if *state == StateTag::Completed {
                sql.push_str(" AND callback_failed = 0");
            } else if *state == StateTag::CallbackErrored {
                sql.push_str(" AND callback_failed = 1");
            }
        }

        sql.push_str(" ORDER BY created_at DESC");

        param_count += 1;
        sql.push_str(&format!(" LIMIT ${param_count}"));
        param_count += 1;
        sql.push_str(&format!(" OFFSET ${param_count}"));

        // Now bind all parameters in order
        let mut query = sqlx::query_as::<_, RequestRow>(&sql)
            .bind(self.min_timestamp.timestamp_millis())
            .bind(self.max_timestamp.timestamp_millis());

        match &self.search {
            Some(SearchField::TxHash(tx_hash)) => {
                let tx_hash: String = tx_hash.encode_hex();
                query = query.bind(tx_hash.clone()).bind(tx_hash);
            }
            Some(SearchField::Sender(sender)) => {
                let sender: String = sender.encode_hex();
                query = query.bind(sender);
            }
            Some(SearchField::SequenceNumber(sequence_number)) => {
                query = query.bind(sequence_number);
            }
            None => (),
        }

        if let Some(network_id) = &self.network_id {
            query = query.bind(network_id);
        }

        if let Some(state) = &self.state {
            query = query.bind(match state {
                StateTag::Pending => "Pending",
                StateTag::Failed => "Failed",
                StateTag::Completed | StateTag::CallbackErrored => "Completed",
            })
        }

        query = query.bind(self.limit).bind(self.offset);

        let result: sqlx::Result<Vec<RequestRow>> = query.fetch_all(self.pool).await;

        if let Err(e) = &result {
            tracing::error!("Failed to fetch request: {}", e);
        }

        Ok(result?.into_iter().filter_map(|row| row.into()).collect())
    }

    pub async fn count_results(&self) -> Result<i64> {
        let mut sql = "SELECT COUNT(*) FROM request WHERE created_at BETWEEN $1 AND $2".to_string();
        let mut param_count = 2;

        // Build the SQL string with parameter placeholders
        match &self.search {
            Some(SearchField::TxHash(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND (request_tx_hash = ${param_count}"));
                param_count += 1;
                sql.push_str(&format!(" OR reveal_tx_hash = ${param_count})"));
            }
            Some(SearchField::Sender(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND sender = ${param_count}"));
            }
            Some(SearchField::SequenceNumber(_)) => {
                param_count += 1;
                sql.push_str(&format!(" AND sequence = ${param_count}"));
            }
            None => (),
        }

        if self.network_id.is_some() {
            param_count += 1;
            sql.push_str(&format!(" AND network_id = ${param_count}"));
        }

        if let Some(state) = &self.state {
            param_count += 1;
            sql.push_str(&format!(" AND state = ${param_count}"));

            if *state == StateTag::Completed {
                sql.push_str(" AND callback_failed = 0");
            } else if *state == StateTag::CallbackErrored {
                sql.push_str(" AND callback_failed = 1");
            }
        }

        // Now bind all parameters in order
        let mut query = sqlx::query_scalar::<_, i64>(&sql)
            .bind(self.min_timestamp.timestamp_millis())
            .bind(self.max_timestamp.timestamp_millis());

        match &self.search {
            Some(SearchField::TxHash(tx_hash)) => {
                let tx_hash: String = tx_hash.encode_hex();
                query = query.bind(tx_hash.clone()).bind(tx_hash);
            }
            Some(SearchField::Sender(sender)) => {
                let sender: String = sender.encode_hex();
                query = query.bind(sender);
            }
            Some(SearchField::SequenceNumber(sequence_number)) => {
                query = query.bind(sequence_number);
            }
            None => (),
        }

        if let Some(network_id) = &self.network_id {
            query = query.bind(network_id);
        }

        if let Some(state) = &self.state {
            query = query.bind(match state {
                StateTag::Pending => "Pending",
                StateTag::Failed => "Failed",
                StateTag::Completed | StateTag::CallbackErrored => "Completed",
            })
        }

        query.fetch_one(self.pool).await.map_err(|err| err.into())
    }
}

#[derive(Debug)]
pub enum RequestQueryBuilderError {
    LimitTooLarge,
    ZeroLimit,
    InvalidSearch,
}

#[derive(Debug, Clone)]
pub enum SearchField {
    TxHash(TxHash),
    Sender(Address),
    SequenceNumber(i64),
}

#[cfg(test)]
mod test {
    use {
        super::*,
        chrono::{Duration, Timelike},
        tokio::time::sleep,
    };

    fn get_random_request_status() -> RequestStatus {
        RequestStatus {
            chain_id: "ethereum".to_string(),
            network_id: 121,
            provider: Address::random(),
            sequence: 1,
            created_at: chrono::Utc::now().with_nanosecond(0).unwrap(),
            last_updated_at: chrono::Utc::now().with_nanosecond(0).unwrap(),
            request_block_number: 1,
            request_tx_hash: TxHash::random(),
            user_random_number: [20; 32],
            sender: Address::random(),
            state: RequestEntryState::Pending,
            gas_limit: 500_000,
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
            callback_failed: false,
            callback_return_value: Default::default(),
            callback_gas_used: 100_000,
        };
        History::update_request_status(&history.pool, status.clone()).await;

        let logs = history
            .query()
            .search(status.sequence.to_string())
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sequence.to_string())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sequence.to_string())
            .unwrap()
            .state(StateTag::Completed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.request_tx_hash.encode_hex())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!(
                "0x{}",
                status.request_tx_hash.encode_hex::<String>()
            ))
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.request_tx_hash.encode_hex::<String>().to_uppercase())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!(
                "0x{}",
                status.request_tx_hash.encode_hex::<String>().to_uppercase()
            ))
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.request_tx_hash.encode_hex())
            .unwrap()
            .state(StateTag::Completed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(reveal_tx_hash.encode_hex())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!("0x{}", reveal_tx_hash.encode_hex::<String>()))
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(reveal_tx_hash.encode_hex::<String>().to_uppercase())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!(
                "0x{}",
                reveal_tx_hash.encode_hex::<String>().to_uppercase()
            ))
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(reveal_tx_hash.encode_hex())
            .unwrap()
            .state(StateTag::Completed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sender.encode_hex())
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!("0x{}", status.sender.encode_hex::<String>()))
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sender.encode_hex::<String>().to_uppercase())
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(format!(
                "0x{}",
                status.sender.encode_hex::<String>().to_uppercase()
            ))
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sender.encode_hex())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status.clone()]);

        let logs = history
            .query()
            .search(status.sender.encode_hex())
            .unwrap()
            .state(StateTag::Completed)
            .execute()
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
            callback_failed: false,
            callback_return_value: Default::default(),
            callback_gas_used: 0,
        };
        History::update_request_status(&history.pool, status.clone()).await;
        let mut failed_status = status.clone();
        failed_status.state = RequestEntryState::Failed {
            reason: "Failed".to_string(),
            provider_random_number: None,
        };
        History::update_request_status(&history.pool, failed_status).await;

        let logs = history
            .query()
            .search(reveal_tx_hash.encode_hex())
            .unwrap()
            .execute()
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
            .query()
            .search(status.request_tx_hash.encode_hex())
            .unwrap()
            .execute()
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
            .query()
            .search(status.sequence.to_string())
            .unwrap()
            .network_id(123)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .query()
            .search((status.sequence + 1).to_string())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .query()
            .search(TxHash::zero().encode_hex())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .query()
            .search(Address::zero().encode_hex())
            .unwrap()
            .network_id(status.network_id)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .query()
            .search(Address::zero().encode_hex())
            .unwrap()
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);

        let logs = history
            .query()
            .state(StateTag::Completed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![]);
    }

    #[tokio::test]
    async fn test_history_time_filters() {
        let history = History::new_in_memory().await.unwrap();
        let status = get_random_request_status();
        History::update_request_status(&history.pool, status.clone()).await;
        for network_id in [None, Some(121)] {
            // min = created_at = max
            let mut query = history.query().limit(10).unwrap();

            if let Some(network_id) = network_id {
                query = query.network_id(network_id);
            }

            let logs = query
                .clone()
                .min_timestamp(status.created_at)
                .max_timestamp(status.created_at)
                .execute()
                .await
                .unwrap();
            assert_eq!(logs, vec![status.clone()]);

            // min = created_at + 1
            let logs = query
                .clone()
                .min_timestamp(status.created_at + Duration::seconds(1))
                .execute()
                .await
                .unwrap();
            assert_eq!(logs, vec![]);

            // max = created_at - 1
            let logs = query
                .clone()
                .max_timestamp(status.created_at - Duration::seconds(1))
                .execute()
                .await
                .unwrap();
            assert_eq!(logs, vec![]);

            // no min or max
            let logs = query.execute().await.unwrap();
            assert_eq!(logs, vec![status.clone()]);
        }
    }

    #[tokio::test]
    async fn test_history_state_filter() {
        let history = History::new_in_memory().await.unwrap();
        let reveal_tx_hash = TxHash::random();

        let pending_status = get_random_request_status();
        History::update_request_status(&history.pool, pending_status.clone()).await;

        let mut failed_status = get_random_request_status();
        History::update_request_status(&history.pool, failed_status.clone()).await;
        failed_status.state = RequestEntryState::Failed {
            reason: "Failed".to_string(),
            provider_random_number: None,
        };
        History::update_request_status(&history.pool, failed_status.clone()).await;

        let mut completed_status = get_random_request_status();
        History::update_request_status(&history.pool, completed_status.clone()).await;
        completed_status.state = RequestEntryState::Completed {
            reveal_block_number: 1,
            reveal_tx_hash,
            provider_random_number: [40; 32],
            gas_used: U256::from(567890),
            combined_random_number: RequestStatus::generate_combined_random_number(
                &completed_status.user_random_number,
                &[40; 32],
            ),
            callback_failed: false,
            callback_return_value: Default::default(),
            callback_gas_used: 100_000,
        };
        History::update_request_status(&history.pool, completed_status.clone()).await;

        let reveal_tx_hash = TxHash::random();
        let mut callback_errored_status = get_random_request_status();
        History::update_request_status(&history.pool, callback_errored_status.clone()).await;
        callback_errored_status.state = RequestEntryState::Completed {
            reveal_block_number: 1,
            reveal_tx_hash,
            provider_random_number: [40; 32],
            gas_used: U256::from(567890),
            combined_random_number: RequestStatus::generate_combined_random_number(
                &callback_errored_status.user_random_number,
                &[40; 32],
            ),
            callback_failed: true,
            callback_return_value: Default::default(),
            callback_gas_used: 100_000,
        };
        History::update_request_status(&history.pool, callback_errored_status.clone()).await;

        let logs = history
            .query()
            .state(StateTag::Pending)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![pending_status.clone()]);

        let logs = history
            .query()
            .state(StateTag::Failed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![failed_status.clone()]);

        let logs = history
            .query()
            .state(StateTag::Completed)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![completed_status.clone()]);

        let logs = history
            .query()
            .state(StateTag::CallbackErrored)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![callback_errored_status.clone()]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_writer_thread() {
        let history = History::new_in_memory().await.unwrap();
        let status = get_random_request_status();
        history.add(&status);
        // wait for the writer thread to write to the db
        sleep(std::time::Duration::from_secs(1)).await;
        let logs = history
            .query()
            .search(1.to_string())
            .unwrap()
            .network_id(121)
            .execute()
            .await
            .unwrap();
        assert_eq!(logs, vec![status]);
    }

    #[tokio::test]
    async fn test_count_results() {
        let history = History::new_in_memory().await.unwrap();
        History::update_request_status(&history.pool, get_random_request_status()).await;
        History::update_request_status(&history.pool, get_random_request_status()).await;
        let mut failed_status = get_random_request_status();
        History::update_request_status(&history.pool, failed_status.clone()).await;
        failed_status.state = RequestEntryState::Failed {
            reason: "Failed".to_string(),
            provider_random_number: None,
        };
        History::update_request_status(&history.pool, failed_status.clone()).await;

        let results = history.query().count_results().await.unwrap();
        assert_eq!(results, 3);

        let results = history
            .query()
            .limit(1)
            .unwrap()
            .count_results()
            .await
            .unwrap();
        assert_eq!(results, 3);

        let results = history
            .query()
            .state(StateTag::Pending)
            .count_results()
            .await
            .unwrap();
        assert_eq!(results, 2);
    }
}
