use pyth_lazer_sdk::LazerClient;
use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionId, SubscriptionParams};
use futures_util::StreamExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Connect to the Pyth Lazer WebSocket endpoint
    let (mut client, mut stream) = LazerClient::start("wss://hermes.pyth.network").await?;
    
    // Subscribe to BTC/USD price feed
    let btc_feed_id = "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
    
    client.subscribe(Request::Subscribe(SubscribeRequest {
        subscription_id: SubscriptionId(1),
        params: SubscriptionParams {
            ids: vec![btc_feed_id.to_string()],
            binary_message_format: true,
        },
    })).await?;

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
