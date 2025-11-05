use {
    pyth_lazer_client::arc_swap::StreamIntoAutoUpdatedHandle,
    pyth_lazer_client::history_client::GetStateParams,
    pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig},
    std::{env, time::Duration},
    tokio::time::sleep,
    url::Url,
};

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
    let state = client
        .state_stream(GetStateParams {
            publishers: true,
            ..Default::default()
        })
        .await?
        .into_auto_updated_handle()
        .await?;

    loop {
        println!("publishers len: {}", state.load().publishers.len());
        println!(
            "publisher 1: {:?}",
            state
                .load()
                .publishers
                .iter()
                .find(|p| p.publisher_id == Some(1))
        );
        sleep(Duration::from_secs(15)).await;
    }
}
