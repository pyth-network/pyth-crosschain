use crate::jrpc_handle::{JrpcConnectionContext, handle_jrpc};
use crate::publisher_handle::handle_publisher;
use crate::{
    config::Config, lazer_publisher::LazerPublisher, publisher_handle::PublisherConnectionContext,
};
use anyhow::{Context, Result};
use hyper::body::Incoming;
use hyper::{Response, StatusCode, body::Bytes, server::conn::http1, service::service_fn};
use hyper_util::rt::TokioIo;
use soketto::{
    BoxedError,
    handshake::http::{Server, is_upgrade_request},
};
use std::fmt::Debug;
use std::{io, net::SocketAddr};
use tokio::net::{TcpListener, TcpStream};
use tracing::{debug, info, instrument, warn};

type FullBody = http_body_util::Full<Bytes>;

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
const JRPC_WS_URI_V1: &str = "/v1/jrpc";

const READINESS_PROBE_PATH: &str = "/ready";
const LIVENESS_PROBE_PATH: &str = "/live";

pub async fn run(config: Config, lazer_publisher: LazerPublisher) -> Result<()> {
    let listener = TcpListener::bind(&config.listen_address).await?;
    info!("listening on {:?}", &config.listen_address);

    loop {
        let stream_addr = listener.accept().await;
        let lazer_publisher_clone = lazer_publisher.clone();
        let config = config.clone();
        tokio::spawn(async move {
            if let Err(err) =
                try_handle_connection(config, stream_addr, lazer_publisher_clone).await
            {
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
                request_handler(
                    config.clone(),
                    request,
                    remote_addr,
                    lazer_publisher.clone(),
                )
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
                    tokio::spawn(handle_publisher(
                        server,
                        request.0,
                        publisher_connection_context,
                        lazer_publisher,
                    ));
                    Ok(response.map(|()| FullBody::default()))
                }
                Request::JrpcV1 => {
                    let publisher_connection_context = JrpcConnectionContext {};
                    tokio::spawn(handle_jrpc(
                        config.clone(),
                        server,
                        request.0,
                        publisher_connection_context,
                        lazer_publisher,
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
