use std::time::Duration;

use pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig};
use pyth_lazer_protocol::PriceFeedId;
use tokio::time::sleep;
use url::Url;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let urls = std::env::args()
        .skip(1)
        .map(|s| Url::parse(&s))
        .collect::<Result<Vec<_>, _>>()?;

    let client = PythLazerHistoryClient::new(PythLazerHistoryClientConfig {
        urls,
        update_interval: Duration::from_secs(5),
        ..Default::default()
    });
    let feeds = client.all_symbols_metadata_handle().await?;

    loop {
        println!("feeds len: {}", feeds.symbols().len());
        println!("feed 1: {:?}", feeds.symbols().get(&PriceFeedId(1)));
        sleep(Duration::from_secs(15)).await;
    }
}
