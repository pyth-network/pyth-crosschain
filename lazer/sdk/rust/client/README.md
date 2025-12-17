# Pyth Lazer Rust Client

A high-performance Rust client for connecting to [Pyth Lazer](https://pyth.network/) real-time data streams. This client provides reliable, low-latency access to Pyth's oracle price feeds with built-in redundancy and automatic failover.

## Features

- **Multiple redundant WebSocket connections** - Maintains 4 concurrent connections by default for high availability
- **Automatic message deduplication** - Uses TTL-based caching to eliminate duplicate messages across connections
- **Exponential backoff reconnection** - Automatically handles connection failures with configurable retry logic
- **Flexible subscription options** - Support for multiple data formats (EVM, Solana, etc.) and delivery channels
- **History API client** - Fetch symbol metadata and historical price information
- **Type-safe API** - Strongly-typed Rust interface with comprehensive error handling

## Installation

Add the following to your `Cargo.toml`:

```toml
[dependencies]
pyth-lazer-client = "8.2.2"
pyth-lazer-protocol = "0.16.0"
tokio = { version = "1", features = ["full"] }
```

## Authentication

To use the Pyth Lazer client, you need an access token. Set your access token via the `LAZER_ACCESS_TOKEN` environment variable:

```bash
export LAZER_ACCESS_TOKEN="your_access_token_here"
```

Or provide it directly in your code:

```rust
use pyth_lazer_client::stream_client::PythLazerStreamClientBuilder;

let access_token = std::env::var("LAZER_ACCESS_TOKEN")
    .expect("LAZER_ACCESS_TOKEN not set");

let client = PythLazerStreamClientBuilder::new(access_token)
    .build()?;
```

## Quick Start

Here's a minimal example to get started with streaming price feeds:

```rust
use pyth_lazer_client::stream_client::PythLazerStreamClientBuilder;
use pyth_lazer_protocol::api::{SubscribeRequest, SubscriptionParams, SubscriptionParamsRepr, Channel};
use pyth_lazer_protocol::{PriceFeedId, PriceFeedProperty};
use pyth_lazer_protocol::time::FixedRate;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create and start the client
    let mut client = PythLazerStreamClientBuilder::new(
        std::env::var("LAZER_ACCESS_TOKEN")?
    ).build()?;

    let mut receiver = client.start().await?;

    // Subscribe to price feeds
    let subscribe_request = SubscribeRequest {
        subscription_id: pyth_lazer_protocol::api::SubscriptionId(1),
        params: SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: Some(vec![PriceFeedId(1), PriceFeedId(2)]),
            symbols: None,
            properties: vec![PriceFeedProperty::Price, PriceFeedProperty::Exponent],
            formats: vec![pyth_lazer_protocol::api::Format::Solana],
            delivery_format: pyth_lazer_protocol::api::DeliveryFormat::Json,
            json_binary_encoding: pyth_lazer_protocol::api::JsonBinaryEncoding::Base64,
            parsed: true,
            channel: Channel::FixedRate(FixedRate::RATE_200_MS),
            ignore_invalid_feeds: false,
        })?,
    };

    client.subscribe(subscribe_request).await?;

    // Process incoming messages
    while let Some(response) = receiver.recv().await {
        println!("Received update: {:?}", response);
    }

    Ok(())
}
```

## Configuration

The `PythLazerStreamClientBuilder` provides several configuration options:

### Custom Endpoints

Override the default production endpoints:

```rust
let client = PythLazerStreamClientBuilder::new(access_token)
    .with_endpoints(vec![
        "wss://pyth-lazer-0.dourolabs.app/v1/stream".parse()?,
        "wss://pyth-lazer-1.dourolabs.app/v1/stream".parse()?,
    ])
    .build()?;
```

### Number of Connections

Set the number of concurrent WebSocket connections (default: 4):

```rust
let client = PythLazerStreamClientBuilder::new(access_token)
    .with_num_connections(2)
    .build()?;
```

### Connection Timeout

Configure the timeout for WebSocket operations (default: 5 seconds):

```rust
use std::time::Duration;

let client = PythLazerStreamClientBuilder::new(access_token)
    .with_timeout(Duration::from_secs(10))
    .build()?;
```

### Exponential Backoff

Customize the reconnection backoff strategy:

```rust
use pyth_lazer_client::backoff::PythLazerExponentialBackoffBuilder;

let backoff = PythLazerExponentialBackoffBuilder::default()
    .build();

let client = PythLazerStreamClientBuilder::new(access_token)
    .with_backoff(backoff)
    .build()?;
```

### Channel Capacity

Set the internal message buffer size (default: 1000):

```rust
let client = PythLazerStreamClientBuilder::new(access_token)
    .with_channel_capacity(5000)
    .build()?;
```

## Subscription Options

### Channels

Choose the update frequency for your price feeds:

- **`Channel::RealTime`** - Receive updates as soon as they're available
- **`Channel::FixedRate(FixedRate::RATE_50_MS)`** - Updates every 50ms
- **`Channel::FixedRate(FixedRate::RATE_200_MS)`** - Updates every 200ms (recommended for most use cases)
- **`Channel::FixedRate(FixedRate::RATE_1000_MS)`** - Updates every 1000ms

```rust
use pyth_lazer_protocol::api::Channel;
use pyth_lazer_protocol::time::FixedRate;

// Real-time updates
let channel = Channel::RealTime;

// Fixed rate updates
let channel = Channel::FixedRate(FixedRate::RATE_200_MS);
```

### Formats

Specify the signature format for the price data:

- **`Format::Evm`** - EVM-compatible format with secp256k1 signatures
- **`Format::Solana`** - Solana-compatible format with Ed25519 signatures
- **`Format::LeEcdsa`** - Little-endian ECDSA format
- **`Format::LeUnsigned`** - Little-endian unsigned format

```rust
use pyth_lazer_protocol::api::Format;

let formats = vec![Format::Evm, Format::Solana];
```

### Delivery Format

Choose how messages are delivered:

- **`DeliveryFormat::Json`** - Receive updates as JSON text messages (default)
- **`DeliveryFormat::Binary`** - Receive updates as binary messages (more efficient)

```rust
use pyth_lazer_protocol::api::DeliveryFormat;

let delivery_format = DeliveryFormat::Binary;
```

### Properties

Select which price feed properties to receive:

- `PriceFeedProperty::Price` - Current price
- `PriceFeedProperty::BestBidPrice` - Best bid price
- `PriceFeedProperty::BestAskPrice` - Best ask price
- `PriceFeedProperty::PublisherCount` - Number of contributing publishers
- `PriceFeedProperty::Exponent` - Price exponent
- `PriceFeedProperty::Confidence` - Confidence interval
- `PriceFeedProperty::FundingRate` - Funding rate (for perpetual markets)
- `PriceFeedProperty::FundingTimestamp` - Funding rate timestamp
- `PriceFeedProperty::FundingRateInterval` - Funding rate update interval
- `PriceFeedProperty::MarketSession` - Current market session

```rust
use pyth_lazer_protocol::PriceFeedProperty;

let properties = vec![
    PriceFeedProperty::Price,
    PriceFeedProperty::Exponent,
    PriceFeedProperty::Confidence,
];
```

### Identifying Price Feeds

Subscribe to feeds using either price feed IDs or symbols:

```rust
// By price feed ID
let params = SubscriptionParamsRepr {
    price_feed_ids: Some(vec![PriceFeedId(1), PriceFeedId(2)]),
    symbols: None,
    // ... other fields
};

// By symbol
let params = SubscriptionParamsRepr {
    price_feed_ids: None,
    symbols: Some(vec![
        "Crypto.BTC/USD".to_string(),
        "Crypto.ETH/USD".to_string(),
    ]),
    // ... other fields
};
```

## Examples

### Comprehensive Streaming Example

See [`examples/subscribe_price_feeds.rs`](examples/subscribe_price_feeds.rs) for a complete example demonstrating:

- Client configuration with multiple connections
- Subscribing to price feeds with different formats
- Processing JSON and binary updates
- Verifying message signatures
- Unsubscribing from feeds

Run the example:

```bash
cargo run --example subscribe_price_feeds
```

### Symbol Metadata

Fetch symbol metadata using the history client:

```rust
use pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig};

let client = PythLazerHistoryClient::new(
    PythLazerHistoryClientConfig::default()
);

// Get all symbol metadata
let symbols = client.all_symbols_metadata().await?;

// Or get an auto-updating handle
let handle = client.all_symbols_metadata_handle().await?;
let symbols = handle.symbols();
```

See [`examples/symbols.rs`](examples/symbols.rs) and [`examples/symbols_stream.rs`](examples/symbols_stream.rs) for complete examples.

## History Client

The `PythLazerHistoryClient` provides access to symbol metadata and historical price information:

```rust
use pyth_lazer_client::history_client::{PythLazerHistoryClient, PythLazerHistoryClientConfig};
use std::time::Duration;

let config = PythLazerHistoryClientConfig {
    urls: vec!["https://history.pyth-lazer.dourolabs.app/".parse()?],
    update_interval: Duration::from_secs(30),
    request_timeout: Duration::from_secs(15),
    cache_dir: Some("/tmp/pyth-lazer-cache".into()),
    channel_capacity: 1000,
};

let client = PythLazerHistoryClient::new(config);

// Fetch symbol metadata once
let symbols = client.all_symbols_metadata().await?;

// Or get an auto-updating handle that refreshes in the background
let handle = client.all_symbols_metadata_handle().await?;

// Or get a stream of updates
let mut stream = client.all_symbols_metadata_stream().await?;
while let Some(symbols) = stream.recv().await {
    println!("Updated symbols: {} feeds", symbols.len());
}
```

The history client supports:

- **One-time fetches** - Get current data with `all_symbols_metadata()`
- **Auto-updating handles** - Background updates with `all_symbols_metadata_handle()`
- **Streaming updates** - Receive updates via channels with `all_symbols_metadata_stream()`
- **Local caching** - Optional disk cache for offline access
- **Fault tolerance** - Graceful fallback to cached data on network failures

## API Reference

### Main Types

- **`PythLazerStreamClient`** - The main client for streaming price updates
- **`PythLazerStreamClientBuilder`** - Builder for configuring the stream client
- **`PythLazerHistoryClient`** - Client for fetching symbol metadata
- **`SubscribeRequest`** - Subscription configuration
- **`SubscriptionParams`** - Subscription parameters wrapper
- **`AnyResponse`** - Enum for JSON or binary responses

### Core Methods

#### PythLazerStreamClient

- `start() -> Result<Receiver<AnyResponse>>` - Start the client and return message receiver
- `subscribe(request: SubscribeRequest) -> Result<()>` - Subscribe to price feeds
- `unsubscribe(id: SubscriptionId) -> Result<()>` - Unsubscribe from a feed

#### PythLazerHistoryClient

- `all_symbols_metadata() -> Result<Vec<SymbolMetadata>>` - Fetch all symbols once
- `all_symbols_metadata_handle() -> Result<SymbolMetadataHandle>` - Get auto-updating handle
- `all_symbols_metadata_stream() -> Result<Receiver<Vec<SymbolMetadata>>>` - Get update stream

For complete API documentation, visit [docs.rs/pyth-lazer-client](https://docs.rs/pyth-lazer-client).

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](../../../../LICENSE) file for details.

## Resources

- [Pyth Network Documentation](https://docs.pyth.network/)
- [Pyth Lazer Overview](https://docs.pyth.network/price-feeds/lazer)
- [API Reference](https://docs.rs/pyth-lazer-client)
- [Examples](examples/)
- [GitHub Repository](https://github.com/pyth-network/pyth-crosschain)
