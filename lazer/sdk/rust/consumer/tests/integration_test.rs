use {
    anyhow::Result,
    pyth_lazer_consumer::{Chain, DeliveryFormat, PriceFeedProperty, PythLazerConsumer, Response},
    pyth_lazer_protocol::{
        router::{JsonUpdate, PriceFeedId},
        subscription::{StreamUpdatedResponse, SubscribedResponse, SubscriptionId},
    },
    std::{sync::Arc, time::Duration},
    tokio::sync::Mutex,
    tokio_tungstenite::tungstenite::Message,
    ttl_cache::TtlCache,
};

// Test helper trait
#[cfg(test)]
trait TestHelpers {
    fn handle_message(&self, message: Message);
}

#[cfg(test)]
impl TestHelpers for PythLazerConsumer {
    fn handle_message(&self, message: Message) {
        if let Message::Text(text) = message {
            if let Ok(response) = serde_json::from_str::<Response>(&text) {
                let _ = self.get_tx().send(response);
            }
        }
    }
}

#[cfg(test)]
#[tokio::test]
async fn test_subscription_lifecycle() -> Result<()> {
    let mut consumer = PythLazerConsumer::new(
        vec!["wss://test.pyth.network".to_string()],
        "test_token".to_string(),
    )
    .await?;

    // Connect before testing subscriptions
    consumer.connect().await?;

    // Test subscription
    let subscription_id = 1;
    let feed_ids = vec![PriceFeedId(1)];
    let properties = Some(vec![PriceFeedProperty::Price]);
    let chains = Some(vec![Chain::Evm]);
    let delivery_format = Some(DeliveryFormat::Json);

    consumer
        .subscribe(
            subscription_id,
            feed_ids,
            properties,
            chains,
            delivery_format,
        )
        .await?;

    // Verify subscription was created
    let mut rx = consumer.subscribe_to_updates();

    // Simulate subscription confirmation
    let subscribed_response = Response::Subscribed(SubscribedResponse {
        subscription_id: SubscriptionId(1),
    });
    let confirmation = Message::Text(serde_json::to_string(&subscribed_response).unwrap());
    consumer.handle_message(confirmation);

    // Wait a short time for the message to be processed
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Try to receive the confirmation message
    let result = rx.try_recv();
    assert!(
        result.is_ok(),
        "Expected to receive subscription confirmation"
    );

    if let Ok(Response::Subscribed(response)) = result {
        assert_eq!(response.subscription_id, SubscriptionId(1));
    } else {
        panic!("Expected Subscribed response");
    }

    // Test unsubscribe
    consumer.unsubscribe(subscription_id).await?;
    let rx = consumer.subscribe_to_updates();
    assert_eq!(rx.len(), 0);

    Ok(())
}

#[cfg(test)]
#[tokio::test]
async fn test_message_deduplication() -> Result<()> {
    let mut consumer = PythLazerConsumer::new(
        vec!["wss://test.pyth.network".to_string()],
        "test_token".to_string(),
    )
    .await?;

    // Connect and subscribe to receive messages
    consumer.connect().await?;
    let mut rx = consumer.subscribe_to_updates();

    // Create a test stream update message
    let stream_update = Response::StreamUpdated(StreamUpdatedResponse {
        subscription_id: SubscriptionId(1),
        payload: JsonUpdate {
            parsed: None,
            evm: None,
            solana: None,
        },
    });

    let message = Message::Text(serde_json::to_string(&stream_update).unwrap());
    let cache = Arc::new(Mutex::new(TtlCache::new(100)));

    consumer.process_message(message.clone(), &cache).await?;
    consumer.process_message(message, &cache).await?;

    // Wait for the first message
    let result = tokio::time::timeout(Duration::from_secs(1), rx.recv()).await;
    assert!(result.is_ok(), "Expected to receive first message");

    // Try to receive a second message (should fail due to deduplication)
    let result = tokio::time::timeout(Duration::from_millis(100), rx.recv()).await;
    assert!(result.is_err(), "Should not receive duplicate message");

    Ok(())
}
