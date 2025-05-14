
use crate::apis::configuration::Configuration;
use crate::models::{EncodingType, PriceUpdate};
use std::error::Error;

pub async fn latest_price_updates(
    configuration: &Configuration,
    ids: Option<Vec<&str>>,
    encoding: Option<EncodingType>,
    parsed: Option<bool>,
) -> Result<PriceUpdate, Box<dyn Error>> {
    let uri_str = format!("{}/v2/updates/price/latest", configuration.base_path);
    let mut req_builder = configuration.client.request(reqwest::Method::GET, &uri_str);

    if let Some(ids_vec) = ids {
        for id in ids_vec {
            req_builder = req_builder.query(&[("ids[]", id)]);
        }
    }

    if let Some(enc) = encoding {
        req_builder = req_builder.query(&[("encoding", enc.to_string())]);
    }

    if let Some(p) = parsed {
        req_builder = req_builder.query(&[("parsed", p.to_string())]);
    }

    if let Some(ref user_agent) = configuration.user_agent {
        req_builder = req_builder.header(reqwest::header::USER_AGENT, user_agent.clone());
    }

    let req = req_builder.build()?;
    let resp = configuration.client.execute(req).await?;

    if resp.status().is_success() {
        let content = resp.text().await?;
        let result = serde_json::from_str(&content)?;
        Ok(result)
    } else {
        Err(format!("Request failed with status: {}", resp.status()).into())
    }
}
