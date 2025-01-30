use futures_util::StreamExt;
use pyth_lazer_protocol::router::{
    Chain, Channel, DeliveryFormat, FixedRate, JsonBinaryEncoding, PriceFeedId, PriceFeedProperty,
    SubscriptionParams, SubscriptionParamsRepr,
};
use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionId};
use pyth_lazer_sdk::LazerClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create and start the client
    let mut client = LazerClient::new("lazer_endpoint", None)?;
    let mut stream = client.start().await?;

    // Create subscription request
    let subscription_request = SubscribeRequest {
        subscription_id: SubscriptionId(1),
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

    // Process the first 5 updates
    let mut count = 0;
    while let Some(msg) = stream.next().await {
        println!("Received update: {:?}", msg?);
        count += 1;
        if count >= 5 {
            break;
        }
    }

    // Unsubscribe from all feeds before exiting
    for feed_id in 1..=3 {
        client.unsubscribe(SubscriptionId(feed_id)).await?;
        println!("Unsubscribed from feed {}", feed_id);
    }

    Ok(())
}
