use anyhow::{bail, Error};
use futures_util::future::err;
use reqwest::Client;
use pyth_lazer_protocol::jrpc::{GetMetadataParams, JrpcResponse, JsonRpcVersion, JrpcParams, PythLazerAgentJrpcV1};
use crate::config::Config;
use crate::http_server::InnerHandlerResult;
use crate::lazer_publisher::LazerPublisher;

pub fn jrpc_handler_inner(config: Config, receive_buf: Vec<u8>, lazer_publisher: LazerPublisher, _context: ()) -> InnerHandlerResult {
    Box::pin(async move {
        let (data, _) = bincode::serde::decode_from_slice::<PythLazerAgentJrpcV1, _>(
            &receive_buf,
            bincode::config::legacy(),
        )?;

        match data.params {
            JrpcParams::SendUpdates(update_params) => {
                lazer_publisher
                    .push_feed_update(update_params.into())
                    .await?;

                return Ok(Some(serde_json::to_string::<JrpcResponse<()>>(&JrpcResponse {
                    jsonrpc: JsonRpcVersion::V2,
                    result: (),
                    id: data.id,
                })?))
            }
            JrpcParams::GetMetadata(params) => {
                match get_metadata(config, params).await {
                    Ok(result) => {
                        return Ok(Some(serde_json::to_string::<JrpcResponse<()>>(&JrpcResponse {
                            jsonrpc: JsonRpcVersion::V2,
                            result: result,
                            id: data.id,
                        })?))
                    }
                    Err(_) => {}
                }
            }
        }

        Ok(None)
    })
}

async fn get_metadata(config: Config, params: GetMetadataParams) -> Result<Option<String>, anyhow::Error> {
    let client = Client::new();

    let resp = client
        .post("https://httpbin.org/post")
        .json(&payload)
        .send()
        .await?
        .json::<HttpBinPostResponse>()
        .await?;

    let
    Ok(None)
}
