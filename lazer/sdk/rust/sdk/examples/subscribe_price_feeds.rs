use futures_util::StreamExt;
use pyth_lazer_protocol::router::{
    Chain, Channel, DeliveryFormat, FixedRate, JsonBinaryEncoding, PriceFeedId, PriceFeedProperty,
    SubscriptionParams, SubscriptionParamsRepr,
};
use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionId};
use pyth_lazer_sdk::LazerClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let (mut client, mut stream) = LazerClient::start("lazer_endpoint").await?;

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

    // Unsubscribe before exiting
    client.unsubscribe(SubscriptionId(1)).await?;
    println!("Unsubscribed from feed");

    Ok(())
}
