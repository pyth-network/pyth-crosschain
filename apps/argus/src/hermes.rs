use {
    crate::{
        error::{
            ArgusError,
            HermesError,
        },
        types::PriceData,
    },
    reqwest::Client,
    serde::{
        Deserialize,
        Serialize,
    },
    std::time::{
        SystemTime,
        UNIX_EPOCH,
    },
};

const HERMES_API_URL: &str = "https://hermes.pyth.network";

#[derive(Debug, Serialize, Deserialize)]
struct HermesResponse {
    binary: BinaryUpdate,
    parsed: Option<Vec<ParsedPriceUpdate>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BinaryUpdate {
    data:     Vec<String>,
    encoding: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ParsedPriceUpdate {
    id:        String,
    price:     RpcPrice,
    ema_price: RpcPrice,
}

#[derive(Debug, Serialize, Deserialize)]
struct RpcPrice {
    price:        String,
    conf:         String,
    expo:         i32,
    publish_time: u64,
}

pub struct HermesClient {
    client: Client,
}

impl HermesClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn get_price_updates(
        &self,
        price_ids: &[[u8; 32]],
    ) -> Result<Vec<(PriceData, Vec<u8>)>, HermesError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| HermesError::ParseError(format!("Failed to get timestamp: {}", e)))?
            .as_secs();

        let mut url = format!(
            "{}/v2/updates/price/{}?parsed=true&encoding=hex",
            HERMES_API_URL, now
        );

        for price_id in price_ids {
            url.push_str(&format!("&ids[]={}", hex::encode(price_id)));
        }

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| HermesError::RequestFailed(e))?
            .error_for_status()
            .map_err(|e| HermesError::RequestFailed(e))?
            .json::<HermesResponse>()
            .await
            .map_err(|e| HermesError::RequestFailed(e))?;

        let update_data = if response.binary.encoding == "hex" {
            response
                .binary
                .data
                .into_iter()
                .map(|data| hex::decode(&data))
                .collect::<Result<Vec<_>, _>>()
                .map_err(HermesError::HexDecodeError)?
        } else {
            return Err(HermesError::InvalidEncoding(response.binary.encoding));
        };

        let price_updates = response.parsed.ok_or(HermesError::NoPriceUpdates)?;

        if price_updates.is_empty() {
            return Err(HermesError::NoPriceUpdates);
        }

        let mut results = Vec::with_capacity(price_updates.len());
        for (update, data) in price_updates.into_iter().zip(update_data) {
            let price_data = PriceData {
                price:        update
                    .price
                    .price
                    .parse()
                    .map_err(|e| HermesError::ParseError(format!("Invalid price: {}", e)))?,
                conf:         update
                    .price
                    .conf
                    .parse()
                    .map_err(|e| HermesError::ParseError(format!("Invalid conf: {}", e)))?,
                expo:         update.price.expo,
                publish_time: update.price.publish_time,
            };
            results.push((price_data, data));
        }

        Ok(results)
    }
}
