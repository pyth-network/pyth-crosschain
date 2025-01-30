use futures_util::StreamExt;
use pyth_lazer_client::LazerClient;
use pyth_lazer_protocol::router::{
    Chain, Channel, DeliveryFormat, FixedRate, JsonBinaryEncoding, PriceFeedId, PriceFeedProperty,
    SubscriptionParams, SubscriptionParamsRepr,
};
use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionId};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create and start the client
    let mut client = LazerClient::new(
        "wss://pyth-lazer.dourolabs.app/v1/stream",
        "YOUR_ACCESS_TOKEN",
    )?;
    let mut stream = client.start().await?;
    // Create subscription request
    let subscription_id = SubscriptionId(1);
    let subscription_request = SubscribeRequest {
        subscription_id,
        params: SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: vec![PriceFeedId(1), PriceFeedId(2), PriceFeedId(3)],
            properties: vec![PriceFeedProperty::Price],
            chains: vec![Chain::Solana],
            delivery_format: DeliveryFormat::Binary,
            json_binary_encoding: JsonBinaryEncoding::default(),
            parsed: false,
            channel: Channel::FixedRate(FixedRate::from_ms(200).expect("unsupported update rate")),
        })
        .expect("invalid subscription params"),
    };

    client
        .subscribe(Request::Subscribe(subscription_request))
        .await?;

    println!("Subscribed to BTC/USD price feed. Waiting for updates...");

    // Process the first 50 updates
    let mut count = 0;
    while let Some(msg) = stream.next().await {
        println!("Received update: {:?}", msg?);
        count += 1;
        if count >= 10 {
            break;
        }
    }

    // Unsubscribe before exiting
    client.unsubscribe(subscription_id).await?;
    println!("Unsubscribed from {:?}", subscription_id);

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    client.close().await?;
    Ok(())
}
