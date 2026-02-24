//! WebSocket client for Bulk Trade validators.

use crate::config::BulkConfig;
use crate::metrics;
use crate::signing::OracleTransaction;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, error, trace, warn};
use url::Url;
use websocket_delivery::{AppRuntime, DeliveryMetrics, IncomingMessage, WebsocketDeliveryClient};

const TX_CHANNEL_BUFFER_SIZE: usize = 1000;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RequestMethod {
    Post,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PayloadType {
    Action,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResponseStatus {
    Ok,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct BulkRequest {
    pub method: RequestMethod,
    pub request: BulkRequestPayload,
    pub id: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BulkRequestPayload {
    #[serde(rename = "type")]
    pub payload_type: PayloadType,
    pub payload: OracleTransaction,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkResponse {
    #[allow(dead_code, reason = "required for serde deserialization")]
    #[serde(rename = "type")]
    pub response_type: String,
    pub id: u64,
    pub data: BulkResponseData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkResponseData {
    #[allow(dead_code, reason = "required for serde deserialization")]
    #[serde(rename = "type")]
    pub data_type: String,
    pub payload: BulkResponsePayload,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BulkResponsePayload {
    pub status: ResponseStatus,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
pub enum PushResult {
    Accepted,
    Deduplicated,
    Error(String),
}

struct PendingRequest {
    sent_at: Instant,
}

/// Sends transactions to all validator endpoints via WebSocket.
/// Runs a background task for sending and response matching.
pub struct BulkClient {
    tx: mpsc::Sender<OracleTransaction>,
    task_handle: Option<tokio::task::JoinHandle<()>>,
}

impl BulkClient {
    pub async fn start(
        config: &BulkConfig,
        metrics: DeliveryMetrics,
        runtime: AppRuntime,
    ) -> Result<Self> {
        let mut client = WebsocketDeliveryClient::new(config.endpoints.clone())
            .with_metrics(metrics)
            .await;
        client.start_all(runtime).await;

        let incoming_rx = client
            .take_incoming_receiver()
            .ok_or_else(|| anyhow::anyhow!("incoming receiver already taken"))?;

        let (tx, rx) = mpsc::channel::<OracleTransaction>(TX_CHANNEL_BUFFER_SIZE);
        let endpoints = client.endpoints().await;
        let handle = tokio::spawn(run_delivery_task(client, rx, incoming_rx, endpoints));

        Ok(Self {
            tx,
            task_handle: Some(handle),
        })
    }

    /// Returns false if queue is full.
    pub fn push(&self, tx: OracleTransaction) -> bool {
        self.tx.try_send(tx).is_ok()
    }

    pub fn is_running(&self) -> bool {
        self.task_handle.as_ref().is_some_and(|h| !h.is_finished())
    }

    #[allow(dead_code, reason = "exposed for future monitoring use")]
    pub fn task_handle(&self) -> Option<&tokio::task::JoinHandle<()>> {
        self.task_handle.as_ref()
    }
}

impl Drop for BulkClient {
    fn drop(&mut self) {
        if let Some(handle) = self.task_handle.take() {
            handle.abort();
        }
    }
}

async fn run_delivery_task(
    client: WebsocketDeliveryClient,
    mut tx_rx: mpsc::Receiver<OracleTransaction>,
    mut incoming_rx: mpsc::Receiver<IncomingMessage>,
    endpoints: Vec<Url>,
) {
    let mut request_id: u64 = 1;
    let response_timeout = Duration::from_secs(5);
    let mut pending: HashMap<(String, u64), PendingRequest> = HashMap::new();
    let mut cleanup_interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            Some(tx) = tx_rx.recv() => {
                let id = request_id;
                request_id += 1;
                let now = Instant::now();

                let request = BulkRequest {
                    method: RequestMethod::Post,
                    request: BulkRequestPayload {
                        payload_type: PayloadType::Action,
                        payload: tx,
                    },
                    id,
                };

                let json = match serde_json::to_string(&request) {
                    Ok(j) => j,
                    Err(e) => {
                        error!(?e, "failed to serialize request");
                        continue;
                    }
                };

                for endpoint in &endpoints {
                    pending.insert(
                        (endpoint.to_string(), id),
                        PendingRequest { sent_at: now },
                    );
                }

                let sent = client.broadcast(&json).await;
                debug!(request_id = id, sent_count = sent, "sent transaction");
                metrics::update_bulk_connections(sent);
            }

            Some(msg) = incoming_rx.recv() => {
                handle_response(&msg, &mut pending);
            }

            _ = cleanup_interval.tick() => {
                cleanup_expired(&mut pending, response_timeout);
            }
        }
    }
}

fn handle_response(msg: &IncomingMessage, pending: &mut HashMap<(String, u64), PendingRequest>) {
    let response: BulkResponse = match serde_json::from_str(&msg.text) {
        Ok(r) => r,
        Err(e) => {
            trace!(text = %msg.text, ?e, "failed to parse response");
            return;
        }
    };

    let endpoint_str = msg.endpoint.to_string();
    let key = (endpoint_str.clone(), response.id);

    if let Some(req) = pending.remove(&key) {
        let latency = req.sent_at.elapsed();
        let result = parse_response(&response);

        match &result {
            PushResult::Accepted => {
                debug!(endpoint = %endpoint_str, request_id = response.id, "push accepted");
                metrics::record_push_success(latency.as_secs_f64());
            }
            PushResult::Deduplicated => {
                debug!(endpoint = %endpoint_str, request_id = response.id, "push deduplicated");
                metrics::record_push_dedup();
            }
            PushResult::Error(e) => {
                warn!(endpoint = %endpoint_str, request_id = response.id, error = %e, "push error");
                metrics::record_push_error();
            }
        }
    } else {
        trace!(
            endpoint = %endpoint_str,
            request_id = response.id,
            "response for unknown request"
        );
    }
}

fn parse_response(response: &BulkResponse) -> PushResult {
    match response.data.payload.status {
        ResponseStatus::Ok => PushResult::Accepted,
        ResponseStatus::Error => {
            let msg = response
                .data
                .payload
                .message
                .clone()
                .unwrap_or_else(|| "unknown error".to_string());
            if msg.contains("duplicate") || msg.contains("nonce") {
                PushResult::Deduplicated
            } else {
                PushResult::Error(msg)
            }
        }
    }
}

fn cleanup_expired(pending: &mut HashMap<(String, u64), PendingRequest>, timeout: Duration) {
    let now = Instant::now();

    pending.retain(|key, req| {
        if now.duration_since(req.sent_at) > timeout {
            warn!(endpoint = %key.0, request_id = key.1, "request timed out");
            metrics::record_push_error();
            false
        } else {
            true
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signing::{ActionType, OracleAction, OracleUpdate};

    #[test]
    fn test_bulk_request_serialization() {
        let tx = crate::signing::OracleTransaction {
            action: OracleAction {
                action_type: ActionType::PythOracle,
                oracles: vec![OracleUpdate {
                    t: 1000,
                    price_feed_id: 1,
                    px: 100,
                    expo: -8,
                }],
                nonce: 12345,
            },
            account: "test-account".to_string(),
            signer: "test-signer".to_string(),
            signature: "test-sig".to_string(),
        };

        let request = BulkRequest {
            method: RequestMethod::Post,
            request: BulkRequestPayload {
                payload_type: PayloadType::Action,
                payload: tx,
            },
            id: 42,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains(r#""method":"post""#));
        assert!(json.contains(r#""type":"action""#));
        assert!(json.contains(r#""id":42"#));
    }

    #[test]
    fn test_bulk_response_deserialization() {
        let json =
            r#"{"type":"response","id":123,"data":{"type":"result","payload":{"status":"ok"}}}"#;
        let response: BulkResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.id, 123);
        assert_eq!(response.data.payload.status, ResponseStatus::Ok);
    }

    #[test]
    fn test_parse_response_deduplicated() {
        let make_response = |msg: &str| BulkResponse {
            response_type: "response".to_string(),
            id: 1,
            data: BulkResponseData {
                data_type: "result".to_string(),
                payload: BulkResponsePayload {
                    status: ResponseStatus::Error,
                    message: Some(msg.to_string()),
                },
            },
        };

        assert!(matches!(
            parse_response(&make_response("duplicate nonce")),
            PushResult::Deduplicated
        ));
        assert!(matches!(
            parse_response(&make_response("nonce already used")),
            PushResult::Deduplicated
        ));
        assert!(matches!(
            parse_response(&make_response("other error")),
            PushResult::Error(_)
        ));
    }
}
