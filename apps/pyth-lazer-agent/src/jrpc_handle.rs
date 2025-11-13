use crate::config::Config;
use crate::lazer_publisher::LazerPublisher;
use crate::websocket_utils::{handle_websocket_error, send_json, send_text};
use anyhow::Error;
use futures::{AsyncRead, AsyncWrite};
use futures_util::io::{BufReader, BufWriter};
use hyper_util::rt::TokioIo;
use pyth_lazer_protocol::jrpc::{
    FeedUpdateParams, GetMetadataParams, JrpcCall, JrpcError, JrpcErrorResponse, JrpcId,
    JrpcResponse, JrpcSuccessResponse, JsonRpcVersion, PythLazerAgentJrpcV1, SymbolMetadata,
};
use soketto::Sender;
use soketto::handshake::http::Server;
use std::str::FromStr;
use tokio::{pin, select};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tracing::{debug, error, instrument};
use url::Url;

const DEFAULT_HISTORY_SERVICE_URL: &str =
    "https://history.pyth-lazer.dourolabs.app/history/v1/symbols";

pub struct JrpcConnectionContext {}

#[instrument(
    skip(server, request, lazer_publisher, context),
    fields(component = "jrpc_ws")
)]
pub async fn handle_jrpc(
    config: Config,
    server: Server,
    request: hyper::Request<hyper::body::Incoming>,
    context: JrpcConnectionContext,
    lazer_publisher: LazerPublisher,
) {
    if let Err(err) = try_handle_jrpc(config, server, request, context, lazer_publisher).await {
        handle_websocket_error(err);
    }
}

#[instrument(
    skip(server, request, lazer_publisher, _context),
    fields(component = "jrpc_ws")
)]
async fn try_handle_jrpc(
    config: Config,
    server: Server,
    request: hyper::Request<hyper::body::Incoming>,
    _context: JrpcConnectionContext,
    lazer_publisher: LazerPublisher,
) -> anyhow::Result<()> {
    let stream = hyper::upgrade::on(request).await?;
    let io = TokioIo::new(stream);
    let stream = BufReader::new(BufWriter::new(io.compat()));
    let (mut ws_sender, mut ws_receiver) = server.into_builder(stream).finish();

    let mut receive_buf = Vec::new();

    loop {
        receive_buf.clear();
        {
            // soketto is not cancel-safe, so we need to store the future and poll it
            // in the inner loop.
            let receive = async { ws_receiver.receive(&mut receive_buf).await };
            pin!(receive);
            #[allow(clippy::never_loop, reason = "false positive")] // false positive
            loop {
                select! {
                    _result = &mut receive => {
                        break
                    }
                }
            }
        }

        match handle_jrpc_inner(&config, &mut ws_sender, &mut receive_buf, &lazer_publisher).await {
            Ok(_) => {}
            Err(err) => {
                debug!("Error handling JRPC request: {}", err);
                send_text(
                    &mut ws_sender,
                    serde_json::to_string::<JrpcResponse<()>>(&JrpcResponse::Error(
                        JrpcErrorResponse {
                            jsonrpc: JsonRpcVersion::V2,
                            error: JrpcError::InternalError(err.to_string()).into(),
                            id: JrpcId::Null,
                        },
                    ))?
                    .as_str(),
                )
                .await?;
            }
        }
    }
}

async fn handle_jrpc_inner<T: AsyncRead + AsyncWrite + Unpin>(
    config: &Config,
    sender: &mut Sender<T>,
    receive_buf: &mut Vec<u8>,
    lazer_publisher: &LazerPublisher,
) -> anyhow::Result<()> {
    match serde_json::from_slice::<PythLazerAgentJrpcV1>(receive_buf.as_slice()) {
        Ok(jrpc_request) => match jrpc_request.params {
            JrpcCall::PushUpdate(request_params) => {
                match lazer_publisher
                    .push_feed_update(request_params.clone().into())
                    .await
                {
                    Ok(()) => send_update_success_response(sender, jrpc_request.id).await,
                    Err(err) => {
                        send_update_failure_response(sender, request_params, jrpc_request.id, err)
                            .await
                    }
                }
            }
            JrpcCall::PushUpdates(request_params_batch) => {
                for request_params in request_params_batch {
                    match lazer_publisher
                        .push_feed_update(request_params.clone().into())
                        .await
                    {
                        Ok(()) => (),
                        Err(err) => {
                            return send_update_failure_response(
                                sender,
                                request_params,
                                jrpc_request.id,
                                err,
                            )
                            .await;
                        }
                    }
                }
                send_update_success_response(sender, jrpc_request.id).await
            }
            JrpcCall::GetMetadata(request_params) => match jrpc_request.id {
                JrpcId::Null => {
                    send_json(
                        sender,
                        &JrpcErrorResponse {
                            jsonrpc: JsonRpcVersion::V2,
                            error: JrpcError::ParseError(
                                "The request to method 'get_metadata' requires an 'id'".to_string(),
                            )
                            .into(),
                            id: JrpcId::Null,
                        },
                    )
                    .await
                }
                _ => handle_get_metadata(sender, config, request_params, jrpc_request.id).await,
            },
        },
        Err(err) => {
            debug!("Error parsing JRPC request: {}", err);
            send_json(
                sender,
                &JrpcErrorResponse {
                    jsonrpc: JsonRpcVersion::V2,
                    error: JrpcError::ParseError(err.to_string()).into(),
                    id: JrpcId::Null,
                },
            )
            .await
        }
    }
}

async fn get_metadata(config: Config) -> Result<Vec<SymbolMetadata>, Error> {
    let result = reqwest::get(
        config
            .history_service_url
            .unwrap_or(Url::from_str(DEFAULT_HISTORY_SERVICE_URL)?),
    )
    .await?;

    if result.status().is_success() {
        Ok(serde_json::from_str::<Vec<SymbolMetadata>>(
            &result.text().await?,
        )?)
    } else {
        Err(anyhow::anyhow!(
            "Error getting metadata (status_code={}, body={})",
            result.status(),
            result.text().await.unwrap_or("none".to_string())
        ))
    }
}

fn filter_symbols(
    symbols: Vec<SymbolMetadata>,
    get_metadata_params: GetMetadataParams,
) -> Vec<SymbolMetadata> {
    let names = &get_metadata_params.names.clone();
    let asset_types = &get_metadata_params.asset_types.clone();

    let res: Vec<SymbolMetadata> = symbols
        .into_iter()
        .filter(|symbol| {
            if let Some(names) = names {
                if !names.contains(&symbol.name) {
                    return false;
                }
            }

            if let Some(asset_types) = asset_types {
                if !asset_types.contains(&symbol.asset_type) {
                    return false;
                }
            }

            true
        })
        .collect();

    res
}

async fn send_update_success_response<T: AsyncRead + AsyncWrite + Unpin>(
    sender: &mut Sender<T>,
    request_id: JrpcId,
) -> anyhow::Result<()> {
    match request_id {
        JrpcId::Null => Ok(()),
        _ => {
            send_json(
                sender,
                &JrpcSuccessResponse::<String> {
                    jsonrpc: JsonRpcVersion::V2,
                    result: "success".to_string(),
                    id: request_id,
                },
            )
            .await
        }
    }
}

async fn send_update_failure_response<T: AsyncRead + AsyncWrite + Unpin>(
    sender: &mut Sender<T>,
    request_params: FeedUpdateParams,
    request_id: JrpcId,
    err: Error,
) -> anyhow::Result<()> {
    debug!("error while sending updates: {:?}", err);
    send_json(
        sender,
        &JrpcErrorResponse {
            jsonrpc: JsonRpcVersion::V2,
            error: JrpcError::SendUpdateError(request_params).into(),
            id: request_id,
        },
    )
    .await
}

async fn handle_get_metadata<T: AsyncRead + AsyncWrite + Unpin>(
    sender: &mut Sender<T>,
    config: &Config,
    request_params: GetMetadataParams,
    request_id: JrpcId,
) -> anyhow::Result<()> {
    match get_metadata(config.clone()).await {
        Ok(symbols) => {
            let symbols = filter_symbols(symbols.clone(), request_params);

            send_json(
                sender,
                &JrpcSuccessResponse::<Vec<SymbolMetadata>> {
                    jsonrpc: JsonRpcVersion::V2,
                    result: symbols,
                    id: request_id,
                },
            )
            .await
        }
        Err(err) => {
            error!("error while retrieving metadata: {:?}", err);
            send_json(
                sender,
                &JrpcErrorResponse {
                    jsonrpc: JsonRpcVersion::V2,
                    error: JrpcError::InternalError(err.to_string()).into(),
                    id: request_id,
                },
            )
            .await
        }
    }
}

#[cfg(test)]
pub mod tests {
    use pyth_lazer_protocol::{PriceFeedId, SymbolState, api::Channel, time::FixedRate};

    use super::*;
    use std::net::SocketAddr;

    fn gen_test_symbol(name: String, asset_type: String) -> SymbolMetadata {
        SymbolMetadata {
            pyth_lazer_id: PriceFeedId(1),
            name,
            symbol: "".to_string(),
            description: "".to_string(),
            asset_type,
            exponent: 0,
            cmc_id: None,
            funding_rate_interval: None,
            min_publishers: 0,
            min_channel: Channel::FixedRate(FixedRate::MIN),
            state: SymbolState::Stable,
            hermes_id: None,
            quote_currency: None,
            nasdaq_symbol: None,
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_try_get_metadata() {
        let config = Config {
            listen_address: SocketAddr::from(([127, 0, 0, 1], 0)),
            relayer_urls: vec![],
            authorization_token: None,
            publish_keypair_path: Default::default(),
            publish_interval_duration: Default::default(),
            history_service_url: None,
            enable_update_deduplication: false,
            update_deduplication_ttl: Default::default(),
            proxy_url: None,
        };

        println!("{:?}", get_metadata(config).await.unwrap());
    }

    #[test]
    fn test_filter_symbols() {
        let symbol1 = gen_test_symbol("BTC".to_string(), "crypto".to_string());
        let symbol2 = gen_test_symbol("XMR".to_string(), "crypto".to_string());
        let symbol3 = gen_test_symbol("BTCUSDT".to_string(), "funding-rate".to_string());
        let symbols = vec![symbol1.clone(), symbol2.clone(), symbol3.clone()];

        // just a name filter
        assert_eq!(
            filter_symbols(
                symbols.clone(),
                GetMetadataParams {
                    names: Some(vec!["XMR".to_string()]),
                    asset_types: None,
                },
            ),
            vec![symbol2.clone()]
        );

        // just an asset type filter
        assert_eq!(
            filter_symbols(
                symbols.clone(),
                GetMetadataParams {
                    names: None,
                    asset_types: Some(vec!["crypto".to_string()]),
                },
            ),
            vec![symbol1.clone(), symbol2.clone()]
        );

        // name and asset type
        assert_eq!(
            filter_symbols(
                symbols.clone(),
                GetMetadataParams {
                    names: Some(vec!["BTC".to_string()]),
                    asset_types: Some(vec!["crypto".to_string()]),
                },
            ),
            vec![symbol1.clone()]
        );
    }
}
