use std::time::Duration;

use anyhow::Error;
use futures::{AsyncRead, AsyncWrite};
use soketto::{Sender, data::ByteSlice125};
use tokio::time::timeout;
use tracing::{debug, warn};

const SEND_PING_TIMEOUT: Duration = Duration::from_millis(10);
const SEND_TIMEOUT: Duration = Duration::from_secs(10);

pub fn handle_websocket_error(err: Error) {
    if let Some(soketto_err) = err.downcast_ref::<soketto::connection::Error>() {
        match soketto_err {
            soketto::connection::Error::Closed => {
                debug!("connection to client was closed")
            }
            soketto::connection::Error::Io(soketto_io_err) => {
                if soketto_io_err.kind() == std::io::ErrorKind::ConnectionReset {
                    debug!("Client disconnected WebSocket connection");
                } else {
                    warn!("Websocket IO error: {:?}", soketto_io_err);
                }
            }
            _ => {
                warn!("error while handling connection: {:?}", err.to_string())
            }
        }
    } else {
        warn!("error while handling connection: {:?}", err.to_string());
    }
}

pub async fn send_ping<T: AsyncRead + AsyncWrite + Unpin>(sender: &mut Sender<T>) {
    let ping_result = timeout(SEND_PING_TIMEOUT, async {
        let payload = ByteSlice125::try_from(&[][..])?;
        sender.send_ping(payload).await?;
        sender.flush().await?;
        anyhow::Ok(())
    })
    .await;

    if let Err(e) = ping_result {
        debug!("Failed to ping: {:?}", e);
    }
}

pub async fn send_text<T: AsyncRead + AsyncWrite + Unpin>(
    sender: &mut Sender<T>,
    text: &str,
) -> anyhow::Result<()> {
    timeout(SEND_TIMEOUT, async {
        sender.send_text(text).await?;
        sender.flush().await?;
        anyhow::Ok(())
    })
    .await?
}
