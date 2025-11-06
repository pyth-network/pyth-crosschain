use {futures::StreamExt, std::time::Duration};

use pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig};
use pyth_lazer_protocol::PriceFeedId;
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
    let mut symbols_stream = client.all_symbols_metadata_stream().await?;

    while let Some(symbols) = symbols_stream.next().await {
        println!("symbols len: {}", symbols.len());
        println!(
            "symbol 1: {:?}",
            symbols
                .iter()
                .find(|feed| feed.pyth_lazer_id == PriceFeedId(1))
        );
    }
    Ok(())
}
