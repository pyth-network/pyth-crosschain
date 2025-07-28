# Stylus Proxy Contracts

This directory contains the Pyth Network proxy contract implementation for Arbitrum Stylus, following the proxy pattern from [stylus-proxy](https://github.com/byteZorvin/stylus-proxy).

## Architecture

The proxy pattern consists of two main contracts:

1. **pyth-proxy** - The proxy contract that holds storage and delegates calls to the implementation
2. **pyth-receiver** - The implementation contract containing the business logic

## Contracts

### pyth-proxy

The proxy contract (`pyth-proxy/src/lib.rs`) provides:
- Storage for proxy state (owner, implementation address, initialization status)
- Delegation of function calls to the implementation contract via `delegate_call`
- Ownership controls for upgrading the implementation
- Fallback function to handle all calls not explicitly defined in the proxy

Key functions:
- `init(owner)` - Initialize the proxy with an owner
- `set_implementation(address)` - Set the implementation contract address (owner only)
- `get_implementation()` - Get the current implementation address
- `fallback()` - Delegate all calls to the implementation contract

### pyth-receiver

The implementation contract (`pyth-receiver/src/lib.rs`) provides:
- All Pyth price feed functionality
- Price feed updates and queries
- Governance operations
- Initialization guard to prevent direct initialization

Key functions:
- `initialize(...)` - Initialize the contract state (should be called through proxy)
- `update_price_feeds(...)` - Update price feed data
- `get_price_unsafe(...)` - Get price data for a feed
- `query_price_feed(...)` - Query complete price feed information

## Usage

### Deployment

1. Deploy the implementation contract (pyth-receiver)
2. Deploy the proxy contract (pyth-proxy)
3. Initialize the proxy with an owner
4. Set the implementation address in the proxy
5. Initialize the implementation through the proxy

### Upgrading

To upgrade the implementation:
1. Deploy a new implementation contract
2. Call `set_implementation(new_address)` on the proxy (owner only)

All existing storage in the proxy is preserved during upgrades.

## Testing

The contracts include comprehensive motsu tests:

### Running Tests

```bash
# Test proxy contract
cd pyth-proxy
cargo test

# Test receiver contract  
cd pyth-receiver
cargo test

# Test specific proxy functionality
cargo test proxy_tests
```

### Test Coverage

- Proxy initialization and ownership
- Implementation setting and upgrades
- Delegation of calls to implementation
- Initialization guards
- Price feed functionality through proxy
- Error handling and edge cases

## Security Considerations

- Only the proxy owner can upgrade the implementation
- Implementation contracts cannot be initialized directly
- All storage is maintained in the proxy contract
- Delegate calls preserve the proxy's storage context
- Zero address checks prevent invalid implementations

## Development

### Building

```bash
# Build proxy contract
cd pyth-proxy
cargo build --release

# Build receiver contract
cd pyth-receiver  
cargo build --release
```

### Testing

```bash
# Run all tests
cargo test

# Run specific test modules
cargo test proxy_tests
cargo test integration_tests
```
