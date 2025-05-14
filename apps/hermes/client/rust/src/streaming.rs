use crate::apis::configuration::Configuration;
use crate::models::{EncodingType, ParsedPriceUpdate, PriceUpdate};
use eventsource_stream::EventStream;
use futures_util::stream::{Stream, StreamExt};
use std::error::Error;
use std::pin::Pin;
use futures_util::task::{Context, Poll};
use std::collections::VecDeque;
use futures_util::stream::FusedStream;
use std::sync::Arc;
use std::sync::Mutex;

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
    
    let client = reqwest::Client::new();
    
    let res = client.get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await?;
    
    if !res.status().is_success() {
        return Err(format!("Failed to connect to SSE endpoint: {}", res.status()).into());
    }
    
    let stream = res.bytes_stream();
    let event_stream = EventStream::new(stream);
    
    let buffer = Arc::new(Mutex::new(VecDeque::new()));
    let buffer_clone = buffer.clone();
    
    tokio::spawn(async move {
        let mut stream = event_stream;
        
        while let Some(event_result) = stream.next().await {
            match event_result {
                Ok(event) => {
                    if !event.event.is_empty() && event.event != "message" {
                        continue;
                    }
                    
                    match serde_json::from_str::<PriceUpdate>(&event.data) {
                        Ok(price_update) => {
                            if let Some(Some(parsed_updates)) = price_update.parsed {
                                let mut buffer = buffer.lock().unwrap();
                                for update in parsed_updates {
                                    buffer.push_back(Ok(update));
                                }
                            }
                        },
                        Err(e) => {
                            let mut buffer = buffer.lock().unwrap();
                            buffer.push_back(Err(format!("Failed to parse price update: {}", e).into()));
                        }
                    }
                },
                Err(e) => {
                    let mut buffer = buffer.lock().unwrap();
                    buffer.push_back(Err(format!("Error in SSE stream: {}", e).into()));
                }
            }
        }
    });
    
    Ok(PriceUpdateStream { buffer: buffer_clone })
}

struct PriceUpdateStream {
    buffer: Arc<Mutex<VecDeque<Result<ParsedPriceUpdate, Box<dyn Error + Send + Sync>>>>>,
}

impl Stream for PriceUpdateStream {
    type Item = Result<ParsedPriceUpdate, Box<dyn Error + Send + Sync>>;
    
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut buffer = self.buffer.lock().unwrap();
        
        if let Some(item) = buffer.pop_front() {
            Poll::Ready(Some(item))
        } else {
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

impl FusedStream for PriceUpdateStream {
    fn is_terminated(&self) -> bool {
        false
    }
}
