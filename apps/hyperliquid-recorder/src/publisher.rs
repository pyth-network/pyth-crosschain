use anyhow::{Context, Result};
use futures_util::{
    SinkExt, StreamExt,
    stream::{SplitSink, SplitStream},
};
use pyth_lazer_protocol::publisher::PriceFeedDataV2;
use tokio::{net::TcpStream, task::JoinHandle};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{Message, client::IntoClientRequest},
};
use tracing::{debug, error, info, warn};
use url::Url;

type WsSink = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
type WsStream = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

pub struct Publisher {
    agent: Option<AgentPublisher>,
}

impl Publisher {
    pub async fn start(url: Option<Url>) -> Result<Self> {
        let agent = if let Some(url) = url {
            Some(AgentPublisher::start(url).await?)
        } else {
            None
        };
        Ok(Publisher { agent })
    }

    pub async fn publish(&mut self, update: &PriceFeedDataV2) -> Result<()> {
        debug!(?update);
        if let Some(agent) = &mut self.agent {
            agent.publish(update).await?;
        }
        Ok(())
    }
}

struct AgentPublisher {
    url: Url,
    sink: WsSink,
    watch_task: JoinHandle<()>,
}

impl AgentPublisher {
    async fn start(url: Url) -> Result<Self> {
        let (stream, response) = connect_async(url.clone().into_client_request()?)
            .await
            .with_context(|| format!("failed to connect to lazer agent at {url}"))?;
        info!(agent = %url, ?response);
        let (sink, stream) = stream.split();
        let watch_task = tokio::spawn(watch_agent_messages(url.clone(), stream));

        Ok(Self {
            url,
            sink,
            watch_task,
        })
    }

    async fn publish(&mut self, update: &PriceFeedDataV2) -> Result<()> {
        let payload = Message::Binary(
            bincode::serde::encode_to_vec(update, bincode::config::legacy())
                .context("failed to serialize price update")?
                .into(),
        );

        if let Err(error) = self.send(payload.clone()).await {
            warn!(?error, url = %self.url, "send to lazer agent failed; reconnecting");
            self.close().await;
            self.send(payload).await?;
        }

        Ok(())
    }

    async fn send(&mut self, message: Message) -> Result<()> {
        self.ensure_connected().await?;
        self.sink
            .send(message)
            .await
            .context("failed to send websocket message")?;
        self.sink
            .flush()
            .await
            .context("failed to flush websocket message")?;

        Ok(())
    }

    async fn ensure_connected(&mut self) -> Result<()> {
        if self.watch_task.is_finished() {
            self.close().await;
            *self = Self::start(self.url.clone()).await?;
        }
        Ok(())
    }

    async fn close(&mut self) {
        if let Err(error) = self.sink.close().await {
            warn!(agent = %self.url, close_failure = %error);
        }
    }
}

async fn watch_agent_messages(url: Url, mut stream: WsStream) {
    while let Some(message) = stream.next().await {
        match message {
            Ok(Message::Text(text)) => warn!(agent = %url, %text),
            Ok(Message::Binary(bytes)) => warn!(agent = %url, bytes_len = bytes.len()),
            Ok(Message::Close(close_reason)) => warn!(agent = %url, ?close_reason),
            Ok(Message::Ping(_) | Message::Pong(_) | Message::Frame(_)) => {}
            Err(error) => error!(agent = %url, ?error),
        }
    }
}
