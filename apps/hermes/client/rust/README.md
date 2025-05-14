# Hermes Rust Client

A Rust client for interacting with the Pyth Network's real-time pricing data through the Hermes service.

## Description

This package provides a Rust client for the Hermes service, which serves Pyth price feeds. It allows you to easily fetch price feeds and subscribe to real-time price updates.

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
hermes-client = "0.1.0"
```

## Usage

```rust
use hermes_client::apis::rest_api;
use hermes_client::apis::configuration::Configuration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a new configuration with the Hermes endpoint
    let mut config = Configuration::new();
    config.base_path = "https://hermes.pyth.network".to_string();
    
    // Fetch latest price updates for a specific price feed
    let price_feed_id = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    let price_updates = rest_api::latest_price_updates(&config, Some(&[price_feed_id]), None, None).await?;
    println!("Price updates: {:?}", price_updates);
    
    Ok(())
}
```

## Examples

The package includes example applications that demonstrate how to use the client:

### Fetching Latest Prices

This example fetches and displays the latest prices for BTC/USD and ETH/USD:

```bash
cargo run --example latest_prices
```

### Real-time Price Streaming

This example demonstrates how to subscribe to a real-time stream of price updates for BTC/USD and ETH/USD using Server-Sent Events (SSE):

```bash
cargo run --example price_stream
```

## Server-Sent Events (SSE) Streaming

This client provides true streaming support for the Hermes SSE endpoint using tokio/futures streams. Unlike polling approaches that periodically request updates, SSE streaming establishes a persistent connection that receives updates in real-time as they become available.

### Using the Streaming API

```rust
use futures_util::stream::StreamExt;
use hermes_client::apis::configuration::Configuration;
use hermes_client::streaming::create_price_update_stream;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create a configuration for the Hermes API
    let mut config = Configuration::new();
    config.base_path = "https://hermes.pyth.network".to_string();
    
    // Define price feed IDs to stream (BTC/USD and ETH/USD)
    let price_feed_ids = vec![
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43".to_string(),
        "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace".to_string()
    ];
    
    // Create the SSE stream
    let mut stream = create_price_update_stream(
        &config,
        price_feed_ids,
        None,  // default encoding (base64)
        None,  // default allow_unordered
        None,  // default benchmarks_only
        None   // default ignore_invalid_price_ids
    ).await?;
    
    // Process the stream of price updates
    while let Some(result) = stream.next().await {
        match result {
            Ok(update) => {
                println!("Received price update: {:?}", update);
            },
            Err(e) => {
                eprintln!("Error: {}", e);
            }
        }
    }
    
    Ok(())
}
```

### Streaming vs. Polling

The streaming implementation offers several advantages over polling:

1. **Real-time updates**: Receive price updates as soon as they're available, without waiting for the next poll interval
2. **Reduced latency**: Eliminate the delay between when a price is published and when your application receives it
3. **Lower resource usage**: Maintain a single persistent connection instead of creating new connections for each poll
4. **Simplified code**: Use standard async/await patterns with tokio/futures streams instead of managing polling loops

The streaming implementation uses the Server-Sent Events (SSE) protocol, which is specifically designed for server-to-client streaming over HTTP. This provides a more efficient and reliable way to receive real-time updates compared to polling.

## API Documentation

For detailed API documentation, you can generate the documentation locally:

```bash
cargo doc --open
```

The client provides access to all Hermes API endpoints, including:

- Fetching latest price updates
- Getting price feed metadata
- Retrieving TWAPs (Time-Weighted Average Prices)
- Accessing publisher stake caps
- Streaming real-time price updates

## Code Generation

This client was generated from the [Hermes OpenAPI specification](https://hermes.pyth.network/docs/openapi.json) using the OpenAPI Generator tool, with custom modifications to support true streaming for the SSE endpoint.

### Regeneration Steps

To regenerate the client after updates to the Hermes API:

1. Install OpenAPI Generator CLI:
   ```bash
   npm install @openapitools/openapi-generator-cli -g
   ```

2. Generate the client:
   ```bash
   npx @openapitools/openapi-generator-cli generate \
     -i https://hermes.pyth.network/docs/openapi.json \
     -g rust \
     -o apps/hermes/client/rust \
     --additional-properties=packageName=hermes-client,packageVersion=0.1.0
   ```

3. The `.openapi-generator-ignore` file ensures that the custom streaming implementation and examples are preserved during regeneration.

4. After regeneration, you may need to update dependencies in Cargo.toml and version number if necessary.

## Publishing

This package is published to crates.io when a new tag matching `hermes-client-rust-v*` is pushed.

## Hermes Public Endpoint

The client defaults to using the Hermes public endpoint at https://hermes.pyth.network. For production applications, we recommend using a dedicated endpoint for better reliability.
