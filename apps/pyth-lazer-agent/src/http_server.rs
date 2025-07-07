use crate::jrpc_handle::jrpc_handler_inner;
use crate::publisher_handle::publisher_inner_handler;
use crate::websocket_utils::{handle_websocket_error, send_text};
use crate::{
    config::Config, lazer_publisher::LazerPublisher, publisher_handle::PublisherConnectionContext,
};
use anyhow::{Context, Result, bail};
use futures_util::io::{BufReader, BufWriter};
use hyper::body::Incoming;
use hyper::{Response, StatusCode, body::Bytes, server::conn::http1, service::service_fn};
use hyper_util::rt::TokioIo;
use pyth_lazer_protocol::publisher::{ServerResponse, UpdateDeserializationErrorResponse};
use soketto::{
    BoxedError,
    handshake::http::{Server, is_upgrade_request},
};
use std::fmt::Debug;
use std::pin::Pin;
use std::{io, net::SocketAddr};
use tokio::net::{TcpListener, TcpStream};
use tokio::{pin, select};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tracing::{debug, error, info, instrument, warn};

type FullBody = http_body_util::Full<Bytes>;
pub type InnerHandlerResult = Pin<Box<dyn Future<Output = Result<Option<String>>> + Send>>;

#[derive(Debug, Copy, Clone)]
pub enum PublisherRequest {
    PublisherV1,
    PublisherV2,
}

pub enum Request {
    PublisherRequest(PublisherRequest),
    JrpcV1,
}

pub struct RelayerRequest(pub http::Request<Incoming>);

const PUBLISHER_WS_URI_V1: &str = "/v1/publisher";
const PUBLISHER_WS_URI_V2: &str = "/v2/publisher";
const JRPC_WS_URI_V1: &str = "/v1/jprc";

const READINESS_PROBE_PATH: &str = "/ready";
const LIVENESS_PROBE_PATH: &str = "/live";

pub async fn run(config: Config, lazer_publisher: LazerPublisher) -> Result<()> {
    let listener = TcpListener::bind(&config.listen_address).await?;
    info!("listening on {:?}", &config.listen_address);

    loop {
        let stream_addr = listener.accept().await;
        let lazer_publisher_clone = lazer_publisher.clone();
        let config = config.clone();
        tokio::spawn(async {
            if let Err(err) = try_handle_connection(config, stream_addr, lazer_publisher_clone).await {
                warn!("error while handling connection: {err:?}");
            }
        });
    }
}

async fn try_handle_connection(
    config: Config,
    stream_addr: io::Result<(TcpStream, SocketAddr)>,
    lazer_publisher: LazerPublisher,
) -> Result<()> {
    let (stream, remote_addr) = stream_addr?;
    debug!("accepted connection from {}", remote_addr);
    stream.set_nodelay(true)?;
    http1::Builder::new()
        .serve_connection(
            TokioIo::new(stream),
            service_fn(move |r| {
                let request = RelayerRequest(r);
                request_handler(config.clone(), request, remote_addr, lazer_publisher.clone())
            }),
        )
        .with_upgrades()
        .await?;
    Ok(())
}

#[instrument(skip_all, fields(component = "http_server", remote_addr = remote_addr.to_string()))]
async fn request_handler(
    config: Config,
    request: RelayerRequest,
    remote_addr: SocketAddr,
    lazer_publisher: LazerPublisher,
) -> Result<Response<FullBody>, BoxedError> {
    let path = request.0.uri().path();

    let request_type = match path {
        PUBLISHER_WS_URI_V1 => Request::PublisherRequest(PublisherRequest::PublisherV1),
        PUBLISHER_WS_URI_V2 => Request::PublisherRequest(PublisherRequest::PublisherV2),
        JRPC_WS_URI_V1 => Request::JrpcV1,
        LIVENESS_PROBE_PATH => {
            let response = Response::builder().status(StatusCode::OK);
            return Ok(response.body(FullBody::default())?);
        }
        READINESS_PROBE_PATH => {
            let status = if lazer_publisher
                .is_ready
                .load(std::sync::atomic::Ordering::Relaxed)
            {
                StatusCode::OK
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            let response = Response::builder().status(status);
            return Ok(response.body(FullBody::default())?);
        }
        _ => {
            return Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(FullBody::from("not found"))
                .context("builder failed")?);
        }
    };

    if !is_upgrade_request(&request.0) {
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(FullBody::from("bad request"))
            .context("builder failed")?);
    }

    let mut server = Server::new();
    match server.receive_request(&request.0) {
        Ok(response) => {
            info!("accepted connection from publisher");
            match request_type {
                Request::PublisherRequest(publisher_request_type) => {
                    let publisher_connection_context = PublisherConnectionContext {
                        request_type: publisher_request_type,
                        _remote_addr: remote_addr,
                    };

                    tokio::spawn(handle_ws(
                        config,
                        server,
                        request.0,
                        lazer_publisher,
                        publisher_connection_context,
                        publisher_inner_handler,
                    ));
                    Ok(response.map(|()| FullBody::default()))
                }
                Request::JrpcV1 => {
                    tokio::spawn(handle_ws(
                        config,
                        server,
                        request.0,
                        lazer_publisher,
                        (),
                        jrpc_handler_inner,
                    ));

                    Ok(response.map(|()| FullBody::default()))
                }
            }
        }
        Err(e) => {
            warn!("Could not upgrade connection: {}", e);
            Ok(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(FullBody::from("internal server error"))
                .context("builder failed")?)
        }
    }
}

#[instrument(
    skip(server, request, lazer_publisher),
    fields(component = "publisher_ws")
)]
async fn handle_ws<T: Debug + Copy>(
    config: Config,
    server: Server,
    request: http::Request<Incoming>,
    lazer_publisher: LazerPublisher,
    context: T,
    inner_handler: fn(Config, Vec<u8>, LazerPublisher, T) -> InnerHandlerResult,
) {
    if let Err(err) = try_handle_ws(config, server, request, lazer_publisher, context, inner_handler).await
    {
        handle_websocket_error(err);
    }
}

#[instrument(
    skip(server, request, lazer_publisher),
    fields(component = "publisher_ws")
)]
async fn try_handle_ws<T: Debug + Copy>(
    config: Config,
    server: Server,
    request: http::Request<Incoming>,
    lazer_publisher: LazerPublisher,
    context: T,
    inner_handler: fn(Config, Vec<u8>, LazerPublisher, T) -> InnerHandlerResult,
) -> Result<()> {
    let stream = hyper::upgrade::on(request).await?;
    let io = TokioIo::new(stream);
    let stream = BufReader::new(BufWriter::new(io.compat()));
    let (mut ws_sender, mut ws_receiver) = server.into_builder(stream).finish();

    let mut receive_buf = Vec::new();

    let mut error_count = 0u32;
    const MAX_ERROR_LOG: u32 = 10u32;
    const MAX_ERROR_DISCONNECT: u32 = 100u32;

    loop {
        receive_buf.clear();
        {
            // soketto is not cancel-safe, so we need to store the future and poll it
            // in the inner loop.
            let receive = async { ws_receiver.receive(&mut receive_buf).await };
            pin!(receive);
            loop {
                select! {
                    _result = &mut receive => {
                        break
                    }
                }
            }
        }

        match inner_handler(config.clone(), receive_buf.clone(), lazer_publisher.clone(), context).await {
            Ok(response) => {
                if let Some(response) = response {
                    send_text(&mut ws_sender, &response).await?;
                }
            }
            Err(err) => {
                error_count += 1;
                if error_count <= MAX_ERROR_LOG {
                    warn!("Error decoding message error: {err}");
                }
                if error_count >= MAX_ERROR_DISCONNECT {
                    error!("Error threshold reached; disconnecting");
                    bail!("Error threshold reached");
                }
                let error_json = &serde_json::to_string::<ServerResponse>(
                    &UpdateDeserializationErrorResponse {
                        error: format!("failed to parse a binary message: {err}"),
                    }
                    .into(),
                )?;
                send_text(&mut ws_sender, error_json).await?;
                continue;
            }
        }
    }
}
