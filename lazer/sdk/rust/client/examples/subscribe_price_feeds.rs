use std::time::Duration;

use base64::Engine;
use pyth_lazer_client::backoff::PythLazerExponentialBackoffBuilder;
use pyth_lazer_client::stream_client::PythLazerStreamClientBuilder;
use pyth_lazer_client::ws_connection::AnyResponse;
use pyth_lazer_protocol::api::{
    Channel, DeliveryFormat, Format, JsonBinaryEncoding, SubscriptionParams, SubscriptionParamsRepr,
};
use pyth_lazer_protocol::api::{SubscribeRequest, SubscriptionId, WsResponse};
use pyth_lazer_protocol::message::{
    EvmMessage, LeEcdsaMessage, LeUnsignedMessage, Message, SolanaMessage,
};
use pyth_lazer_protocol::payload::PayloadData;
use pyth_lazer_protocol::time::FixedRate;
use pyth_lazer_protocol::{PriceFeedId, PriceFeedProperty};
use tokio::pin;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::EnvFilter;

fn get_lazer_access_token() -> String {
    // Place your access token in your env at LAZER_ACCESS_TOKEN or set it here
    let token = "your token here";
    std::env::var("LAZER_ACCESS_TOKEN").unwrap_or_else(|_| token.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()?,
        )
        .json()
        .init();

    // Create and start the client
    let mut client = PythLazerStreamClientBuilder::new(get_lazer_access_token())
        // Optionally override the default endpoints
        .with_endpoints(vec![
            "wss://pyth-lazer-0.dourolabs.app/v1/stream".parse()?,
            "wss://pyth-lazer-1.dourolabs.app/v1/stream".parse()?,
        ])
        // Optionally set the number of connections
        .with_num_connections(4)
        // Optionally set the backoff strategy
        .with_backoff(PythLazerExponentialBackoffBuilder::default().build())
        // Optionally set the timeout for each connection
        .with_timeout(Duration::from_secs(5))
        // Optionally set the channel capacity for responses
        .with_channel_capacity(1000)
        .build()?;

    let stream = client.start().await?;
    pin!(stream);

    let subscription_requests = vec![
        // Example subscription: Parsed JSON feed targeting Solana, specified by price feed ids
        SubscribeRequest {
            subscription_id: SubscriptionId(1),
            params: SubscriptionParams::new(SubscriptionParamsRepr {
                price_feed_ids: Some(vec![PriceFeedId(1), PriceFeedId(2)]),
                symbols: None,
                properties: vec![
                    PriceFeedProperty::Price,
                    PriceFeedProperty::Exponent,
                    PriceFeedProperty::BestAskPrice,
                    PriceFeedProperty::BestBidPrice,
                ],
                formats: vec![Format::Solana],
                delivery_format: DeliveryFormat::Json,
                json_binary_encoding: JsonBinaryEncoding::Base64,
                parsed: true,
                channel: Channel::FixedRate(FixedRate::RATE_200_MS),
                ignore_invalid_feeds: false,
                market_sessions: vec![
                    pyth_lazer_protocol::api::MarketSession::Regular,
                    pyth_lazer_protocol::api::MarketSession::PreMarket,
                    pyth_lazer_protocol::api::MarketSession::PostMarket,
                    pyth_lazer_protocol::api::MarketSession::OverNight,
                    pyth_lazer_protocol::api::MarketSession::Closed,
                ],
            })
            .expect("invalid subscription params"),
        },
        // Example subscription: binary feed targeting Solana and EVM, specified by price feed symbols
        SubscribeRequest {
            subscription_id: SubscriptionId(2),
            params: SubscriptionParams::new(SubscriptionParamsRepr {
                price_feed_ids: None,
                symbols: Some(vec![
                    "Crypto.BTC/USD".to_string(),
                    "Crypto.ETH/USD".to_string(),
                    "Crypto.PYTH/USD".to_string(),
                ]),
                properties: vec![
                    PriceFeedProperty::Price,
                    PriceFeedProperty::Exponent,
                    PriceFeedProperty::BestAskPrice,
                    PriceFeedProperty::BestBidPrice,
                ],
                formats: vec![Format::Evm, Format::Solana],
                delivery_format: DeliveryFormat::Binary,
                json_binary_encoding: JsonBinaryEncoding::Base64,
                parsed: false,
                channel: Channel::FixedRate(FixedRate::RATE_50_MS),
                ignore_invalid_feeds: false,
                market_sessions: vec![
                    pyth_lazer_protocol::api::MarketSession::Regular,
                    pyth_lazer_protocol::api::MarketSession::PreMarket,
                    pyth_lazer_protocol::api::MarketSession::PostMarket,
                    pyth_lazer_protocol::api::MarketSession::OverNight,
                    pyth_lazer_protocol::api::MarketSession::Closed,
                ],
            })
            .expect("invalid subscription params"),
        },
    ];

    for req in subscription_requests {
        client.subscribe(req).await?;
    }

    println!("Subscribed to price feeds. Waiting for updates...");

    // Process the first few updates
    let mut count = 0;
    while let Some(msg) = stream.recv().await {
        // The stream gives us base64-encoded binary messages. We need to decode, parse, and verify them.
        match msg {
            AnyResponse::Json(msg) => match msg {
                WsResponse::StreamUpdated(update) => {
                    println!("Received a JSON update for {:?}", update.subscription_id);
                    if let Some(evm_data) = update.payload.evm {
                        // Decode binary data
                        let binary_data =
                            base64::engine::general_purpose::STANDARD.decode(&evm_data.data)?;
                        let evm_message = EvmMessage::deserialize_slice(&binary_data)?;

                        // Parse and verify the EVM message
                        let payload = parse_and_verify_evm_message(&evm_message);
                        println!("EVM payload: {payload:?}");
                    }

                    if let Some(solana_data) = update.payload.solana {
                        // Decode binary data
                        let binary_data =
                            base64::engine::general_purpose::STANDARD.decode(&solana_data.data)?;
                        let solana_message = SolanaMessage::deserialize_slice(&binary_data)?;

                        // Parse and verify the Solana message
                        let payload = parse_and_verify_solana_message(&solana_message);
                        println!("Solana payload: {payload:?}");
                    }

                    if let Some(data) = update.payload.le_ecdsa {
                        // Decode binary data
                        let binary_data =
                            base64::engine::general_purpose::STANDARD.decode(&data.data)?;
                        let message = LeEcdsaMessage::deserialize_slice(&binary_data)?;

                        // Parse and verify the message
                        let payload = parse_and_verify_le_ecdsa_message(&message);
                        println!("LeEcdsa payload: {payload:?}");
                    }

                    if let Some(data) = update.payload.le_unsigned {
                        // Decode binary data
                        let binary_data =
                            base64::engine::general_purpose::STANDARD.decode(&data.data)?;
                        let message = LeUnsignedMessage::deserialize_slice(&binary_data)?;

                        // Parse the message
                        let payload = PayloadData::deserialize_slice_le(&message.payload)?;
                        println!("LE unsigned payload: {payload:?}");
                    }

                    if let Some(parsed) = update.payload.parsed {
                        // Parsed payloads (`parsed: true`) are already decoded and ready to use
                        for feed in parsed.price_feeds {
                            println!(
                                "Parsed payload: {:?}: {:?} at {:?}",
                                feed.price_feed_id, feed, parsed.timestamp_us
                            );
                        }
                    }
                }
                msg => println!("Received non-update message: {msg:?}"),
            },
            AnyResponse::Binary(msg) => {
                println!("Received a binary update for {:?}", msg.subscription_id);
                for message in msg.messages {
                    match message {
                        Message::Evm(message) => {
                            // Parse and verify the EVM message
                            let payload = parse_and_verify_evm_message(&message);
                            println!("EVM payload: {payload:?}");
                        }
                        Message::Solana(message) => {
                            // Parse and verify the Solana message
                            let payload = parse_and_verify_solana_message(&message);
                            println!("Solana payload: {payload:?}");
                        }
                        Message::LeEcdsa(message) => {
                            let payload = parse_and_verify_le_ecdsa_message(&message);
                            println!("LeEcdsa payload: {payload:?}");
                        }
                        Message::LeUnsigned(message) => {
                            let payload = PayloadData::deserialize_slice_le(&message.payload)?;
                            println!("LeUnsigned payload: {payload:?}");
                        }
                        Message::Json(message) => {
                            for feed in message.price_feeds {
                                println!(
                                    "JSON payload: {:?}: {:?} at {:?}",
                                    feed.price_feed_id, feed, message.timestamp_us
                                );
                            }
                        }
                    }
                }
            }
        }
        println!();

        count += 1;
        if count >= 50 {
            break;
        }
    }

    // Unsubscribe example
    for sub_id in [SubscriptionId(1), SubscriptionId(2)] {
        client.unsubscribe(sub_id).await?;
        println!("Unsubscribed from {sub_id:?}");
    }

    Ok(())
}

fn parse_and_verify_solana_message(solana_message: &SolanaMessage) -> anyhow::Result<PayloadData> {
    // Verify signature using the pubkey
    let public_key = ed25519_dalek::VerifyingKey::from_bytes(&solana_message.public_key)?;
    public_key.verify_strict(
        &solana_message.payload,
        &ed25519_dalek::Signature::from_bytes(&solana_message.signature),
    )?;

    let payload = PayloadData::deserialize_slice_le(&solana_message.payload)?;
    Ok(payload)
}

fn parse_and_verify_evm_message(evm_message: &EvmMessage) -> anyhow::Result<PayloadData> {
    // Recover pubkey from message
    let public_key = libsecp256k1::recover(
        &libsecp256k1::Message::parse(&alloy_primitives::keccak256(&evm_message.payload)),
        &libsecp256k1::Signature::parse_standard(&evm_message.signature)?,
        &libsecp256k1::RecoveryId::parse(evm_message.recovery_id)?,
    )?;
    println!(
        "evm address recovered from signature: {:?}",
        hex::encode(&alloy_primitives::keccak256(&public_key.serialize()[1..])[12..])
    );

    let payload = PayloadData::deserialize_slice_be(&evm_message.payload)?;
    Ok(payload)
}

fn parse_and_verify_le_ecdsa_message(message: &LeEcdsaMessage) -> anyhow::Result<PayloadData> {
    // Recover pubkey from message
    let public_key = libsecp256k1::recover(
        &libsecp256k1::Message::parse(&alloy_primitives::keccak256(&message.payload)),
        &libsecp256k1::Signature::parse_standard(&message.signature)?,
        &libsecp256k1::RecoveryId::parse(message.recovery_id)?,
    )?;
    println!(
        "evm address recovered from signature: {:?}",
        hex::encode(&alloy_primitives::keccak256(&public_key.serialize()[1..])[12..])
    );

    let payload = PayloadData::deserialize_slice_le(&message.payload)?;
    Ok(payload)
}
