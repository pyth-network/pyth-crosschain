
use crate::apis::configuration::Configuration;
use crate::models::{EncodingType, ParsedPriceUpdate, PriceUpdate};
use futures_util::stream::{Stream, StreamExt};
use std::error::Error;

pub async fn create_price_update_stream(
    config: &Configuration,
    price_feed_ids: Vec<String>,
    encoding: Option<EncodingType>,
    allow_unordered: Option<bool>,
    benchmarks_only: Option<bool>,
    ignore_invalid_price_ids: Option<bool>,
) -> Result<impl Stream<Item = Result<ParsedPriceUpdate, Box<dyn Error + Send + Sync>>>, Box<dyn Error>> {
    let base_url = format!("{}/v2/updates/price/stream", config.base_path);
    let mut url = reqwest::Url::parse(&base_url)?;

    let mut query_pairs = url.query_pairs_mut();
    for id in &price_feed_ids {
        query_pairs.append_pair("ids[]", id);
    }

    if let Some(enc) = encoding {
        query_pairs.append_pair("encoding", &enc.to_string());
    } else {
        query_pairs.append_pair("encoding", "base64");
    }

    query_pairs.append_pair("parsed", "true");

    if let Some(allow) = allow_unordered {
        query_pairs.append_pair("allow_unordered", &allow.to_string());
    }

    if let Some(benchmarks) = benchmarks_only {
        query_pairs.append_pair("benchmarks_only", &benchmarks.to_string());
    }

    if let Some(ignore) = ignore_invalid_price_ids {
        query_pairs.append_pair("ignore_invalid_price_ids", &ignore.to_string());
    }

    drop(query_pairs);

    let client = reqwest::Client::builder()
        .build()?;

    let response = client.get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("Failed to connect to SSE endpoint: {}", response.status()).into());
    }

    let stream = response.bytes_stream();

    let sse_stream = eventsource_stream::EventStream::new(stream)
        .map(move |event_result| {
            match event_result {
                Ok(event) => {
                    if event.event != "message" {
                        return Err(format!("Unexpected event type: {}", event.event).into());
                    }

                    let data = &event.data;

                    println!("Received SSE data: {}", data);

                    match serde_json::from_str::<crate::models::SseEvent>(data) {
                        Ok(sse_event) => {
                            if let Some(parsed_updates) = sse_event.parsed {
                                let stream = parsed_updates.into_iter()
                                    .map(|update| Ok(update))
                                    .collect::<Vec<Result<ParsedPriceUpdate, Box<dyn Error + Send + Sync>>>>();
                                Ok(futures_util::stream::iter(stream))
                            } else {
                                Err("No parsed price updates in the response".into())
                            }
                        },
                        Err(e) => Err(format!("Failed to parse price update: {}", e).into()),
                    }
                },
                Err(e) => Err(format!("Error in SSE stream: {}", e).into()),
            }
        })
        .flat_map(|result| {
            match result {
                Ok(stream) => stream,
                Err(e) => {
                    let err = e;
                    futures_util::stream::iter(vec![Err(err)])
                }
            }
        });

    Ok(sse_stream)
}
