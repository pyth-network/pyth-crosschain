use {
    pyth_lazer_protocol::PublisherId,
    std::{env, time::Duration},
};

use pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig};
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
        access_token: Some(env::var("ACCESS_TOKEN")?),
        ..Default::default()
    });
    let publishers = client.publishers_handle().await?;

    loop {
        println!("publishers len: {}", publishers.get().by_id.len());
        println!(
            "publisher 1: {:?}",
            publishers.get().by_id.get(&PublisherId(1))
        );
        sleep(Duration::from_secs(15)).await;
    }
}
