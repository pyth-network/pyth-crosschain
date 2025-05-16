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

### Streaming Price Updates

This example demonstrates how to subscribe to a real-time stream of price updates for BTC/USD and ETH/USD:

```bash
cargo run --example price_stream
```

To run the examples, clone the repository and execute the commands from the `apps/hermes/client/rust` directory.

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

This client was generated from the [Hermes OpenAPI specification](https://hermes.pyth.network/docs/openapi.json) using the OpenAPI Generator tool.

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

3. Manually update dependencies in Cargo.toml and version number if necessary.

## Publishing

This package is published to crates.io when a new tag matching `hermes-client-rust-v*` is pushed.

## Hermes Public Endpoint

The client defaults to using the Hermes public endpoint at https://hermes.pyth.network. For production applications, we recommend using a dedicated endpoint for better reliability.

## Documentation For Models

 - [AssetType](docs/AssetType.md)
 - [BinaryUpdate](docs/BinaryUpdate.md)
 - [EncodingType](docs/EncodingType.md)
 - [GetVaaCcipResponse](docs/GetVaaCcipResponse.md)
 - [GetVaaResponse](docs/GetVaaResponse.md)
 - [LatestPublisherStakeCapsUpdateDataResponse](docs/LatestPublisherStakeCapsUpdateDataResponse.md)
 - [ParsedPriceFeedTwap](docs/ParsedPriceFeedTwap.md)
 - [ParsedPriceUpdate](docs/ParsedPriceUpdate.md)
 - [ParsedPublisherStakeCap](docs/ParsedPublisherStakeCap.md)
 - [ParsedPublisherStakeCapsUpdate](docs/ParsedPublisherStakeCapsUpdate.md)
 - [PriceFeedMetadata](docs/PriceFeedMetadata.md)
 - [PriceUpdate](docs/PriceUpdate.md)
 - [RpcPrice](docs/RpcPrice.md)
 - [RpcPriceFeed](docs/RpcPriceFeed.md)
 - [RpcPriceFeedMetadata](docs/RpcPriceFeedMetadata.md)
 - [RpcPriceFeedMetadataV2](docs/RpcPriceFeedMetadataV2.md)
 - [TwapsResponse](docs/TwapsResponse.md)



