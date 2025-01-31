use futures_util::StreamExt;
use pyth_lazer_client::LazerClient;
use pyth_lazer_protocol::router::{
    Chain, Channel, DeliveryFormat, FixedRate, JsonBinaryEncoding, PriceFeedId, PriceFeedProperty,
    SubscriptionParams, SubscriptionParamsRepr,
};
use pyth_lazer_protocol::subscription::{Request, SubscribeRequest, SubscriptionId};

fn get_lazer_access_token() -> String {
    // Place your access token in your env at LAZER_ACCESS_TOKEN or set it here
    let token = "your token here";
    std::env::var("LAZER_ACCESS_TOKEN").unwrap_or_else(|_| token.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create and start the client
    let mut client = LazerClient::new(
        "wss://pyth-lazer.dourolabs.app/v1/stream",
        &get_lazer_access_token(),
    )?;
    let mut stream = client.start().await?;

    let subscription_requests = vec![
        // Example subscription: Parsed JSON feed targeting Solana
        SubscribeRequest {
            subscription_id: SubscriptionId(1),
            params: SubscriptionParams::new(SubscriptionParamsRepr {
                price_feed_ids: vec![PriceFeedId(1), PriceFeedId(2)],
                properties: vec![
                    PriceFeedProperty::Price,
                    PriceFeedProperty::Exponent,
                    PriceFeedProperty::BestAskPrice,
                    PriceFeedProperty::BestBidPrice,
                ],
                chains: vec![Chain::Solana],
                delivery_format: DeliveryFormat::Json,
                json_binary_encoding: JsonBinaryEncoding::default(),
                parsed: true,
                channel: Channel::FixedRate(
                    FixedRate::from_ms(200).expect("unsupported update rate"),
                ),
            })
            .expect("invalid subscription params"),
        },
        // Example subscription: binary feed targeting Solana and EVM
        SubscribeRequest {
            subscription_id: SubscriptionId(2),
            params: SubscriptionParams::new(SubscriptionParamsRepr {
                price_feed_ids: vec![PriceFeedId(3), PriceFeedId(4)],
                properties: vec![
                    PriceFeedProperty::Price,
                    PriceFeedProperty::Exponent,
                    PriceFeedProperty::BestAskPrice,
                    PriceFeedProperty::BestBidPrice,
                ],
                chains: vec![Chain::Evm, Chain::Solana],
                delivery_format: DeliveryFormat::Binary,
                json_binary_encoding: JsonBinaryEncoding::default(),
                parsed: false,
                channel: Channel::FixedRate(
                    FixedRate::from_ms(50).expect("unsupported update rate"),
                ),
            })
            .expect("invalid subscription params"),
        },
    ];

    for req in subscription_requests {
        client.subscribe(Request::Subscribe(req)).await?;
    }

    println!("Subscribed to price feeds. Waiting for updates...");

    // Process the first few updates
    let mut count = 0;
    while let Some(msg) = stream.next().await {
        println!("Received update: {:?}", msg?);
        count += 1;
        if count >= 50 {
            break;
        }
    }

    // Unsubscribe before exiting
    for sub_id in [SubscriptionId(1), SubscriptionId(2)] {
        client.unsubscribe(sub_id).await?;
        println!("Unsubscribed from {:?}", sub_id);
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    client.close().await?;
    Ok(())
}
