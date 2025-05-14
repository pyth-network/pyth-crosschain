use crate::apis::configuration::Configuration;
use crate::models::{EncodingType, ParsedPriceUpdate, PriceUpdate};
use futures_util::stream::{Stream, StreamExt};
use std::error::Error;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

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
    
    let (tx, rx) = mpsc::channel(100);
    
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        
        let res = match client.get(url)
            .header("Accept", "text/event-stream")
            .send()
            .await {
                Ok(res) => res,
                Err(e) => {
                    let _ = tx.send(Err(Box::new(e) as Box<dyn Error + Send + Sync>)).await;
                    return;
                }
            };
        
        if !res.status().is_success() {
            let _ = tx.send(Err(format!("Failed to connect to SSE endpoint: {}", res.status()).into())).await;
            return;
        }
        
        let mut buffer = String::new();
        let mut stream = res.bytes_stream();
        
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    if let Ok(text) = String::from_utf8(chunk.to_vec()) {
                        buffer.push_str(&text);
                        
                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();
                            
                            if let Some(data_line) = event.lines().find(|line| line.starts_with("data:")) {
                                let data = data_line.trim_start_matches("data:").trim();
                                
                                match serde_json::from_str::<PriceUpdate>(data) {
                                    Ok(price_update) => {
                                        if let Some(Some(parsed_updates)) = price_update.parsed {
                                            for update in parsed_updates {
                                                if tx.send(Ok(update)).await.is_err() {
                                                    return;
                                                }
                                            }
                                        }
                                    },
                                    Err(e) => {
                                        let _ = tx.send(Err(Box::new(e) as Box<dyn Error + Send + Sync>)).await;
                                    }
                                }
                            }
                        }
                    }
                },
                Err(e) => {
                    let _ = tx.send(Err(Box::new(e) as Box<dyn Error + Send + Sync>)).await;
                    break;
                }
            }
        }
    });
    
    let stream = ReceiverStream::new(rx);
    
    Ok(stream)
}
