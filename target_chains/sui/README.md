# Pyth on Sui

## 1. The `PriceInfoObject`
Pyth price feeds on Sui are uniquely represented in the global store as `PriceInfoObjects`. These objects have the `key` ability and serve as wrappers around the `PriceInfo` object, which in turn wraps around the `PriceFeed`, the arrival time of the latest price update, and the attestation time of the latest update.

`PriceInfoObject`s are central to Pyth on Sui, since they are in unique correspondence with each Pyth price feed and must be passed in to functions that act on price feeds, e.g. 

- `update_price_feeds`
- `update_price_feed_from_single_vaa`
- `update_price_feeds_if_fresh`

## 2. Updating and Consuming Price Feeds
Assuming that a price feed with PRICE_FEED_ID exists, 

1. Obtain a batch price attestation VAA bytes of type `vector<u8>`
2. Call `wormhole::parse_and_verify` on the to obtain a `VAA` hot potato object. Note, you will also need to pass in a reference to the Wormhole state and the Sui clock.
  ```Rust
  public fun parse_and_verify(
        wormhole_state: &State,
        buf: vector<u8>,
        the_clock: &Clock
    ): VAA
  ```
3. Call `pyth:`
4.

## 3. Contracts Registry

### Pyth on Testnet
- WORMHOLE_ID: TBA
- PYTH_STATE_ID: TBA

### Wormhole on Testnet
- WORMHOLE_ID: `0x3542d705ec6a7e05045288ec99a6c4b4e3ded999b6feab720fab535b08fa51f8`
- WORMHOLE_STATE_ID: `0x69ae41bdef4770895eb4e7aaefee5e4673acc08f6917b4856cf55549c4573ca8`

### Pyth on Mainnet
- PYTH_ID: TBA
- PYTH_STATE_ID: TBA

### Wormhole on Mainnet
- WORMHOLE_ID: TBA
- WORMHOLE_STATE_ID: TBA

