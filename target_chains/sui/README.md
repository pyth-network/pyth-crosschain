# Pyth on Sui

## 1. Background
Pyth price feeds on Sui are uniquely represented in the global store as `PriceInfoObjects`. These objects have the `key` ability and serve as wrappers around the `PriceInfo` object, which in turn wraps around the `PriceFeed`, the arrival time of the latest price update, and the attestation time of the latest update.

`PriceInfoObject`s are central to Pyth on Sui, since they are in unique correspondence with each Pyth price feed and must be passed in to functions that act on price feeds, e.g. 

- `update_price_feeds`
- `update_price_feed_from_single_vaa`
- `update_price_feeds_if_fresh`

## 2. How to Update and Consume Price Feeds
To update and then consume a price feed, one needs to build a Sui [programmable transaction](https://docs.sui.io/build/prog-trans-ts-sdk). 

As with other chains, one first obtains a batch price attestation VAA (of type `vector<u8>`) off-chain for a Price Info Object whose feed is to be used. Assume the ID is `PRICE_INFO_OBJECT_ID`. Then, chain together the following sequence of function calls:

### 1. `wormhole::parse_and_verify`

Call `parse_and_verify` on the batch attestation VAA bytes to obtain a `VAA` hot potato object. 
  ```Rust
  public fun parse_and_verify(
        wormhole_state: &State,
        buf: vector<u8>,
        the_clock: &Clock
    ): VAA
  ```
### 2.`pyth:update_price_feeds` 
Vectorize the `VAA` from the previous step and pass it to `update_price_feeds`.
```Rust
 public fun update_price_feeds(
        pyth_state: &PythState,
        verified_vaas: vector<VAA>,
        price_info_objects: &mut vector<PriceInfoObject>,
        fee: Coin<SUI>,
        clock: &Clock
    )
```

### 3. `pyth::get_price` 
Finally, get the price of the updated price feed in `PriceInfoObject`.
```Rust
public fun get_price(
      state: &PythState, 
      price_info_object: &PriceInfoObject, 
      clock: &Clock
): Price
```
Fetch the price of the updated Price Info Object.

## 3. Contracts Registry

## Pyth on Testnet
- PYTH_PACKAGE_ID: [0x6ab42a4799973ce95dfc3579b10343122da4e19108fbf1036d83fe0422192f73](https://explorer.sui.io/object/0x6ab42a4799973ce95dfc3579b10343122da4e19108fbf1036d83fe0422192f73),
- PYTH_STATE_ID: [0x35a0d5a868ca3612822045985cbb869354fa10b389e1816d065ebd2909cab6e8](https://explorer.sui.io/object/0x35a0d5a868ca3612822045985cbb869354fa10b389e1816d065ebd2909cab6e8),

## Wormhole on Testnet
- WORMHOLE_PACKAGE_ID: [0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7](https://explorer.sui.io/object/0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7),
- WORMHOLE_STATE_ID: [0x79ab4d569f7eb1efdcc1f25b532f8593cda84776206772e33b490694cb8fc07a](https://explorer.sui.io/object/0x79ab4d569f7eb1efdcc1f25b532f8593cda84776206772e33b490694cb8fc07a),

## Pyth on Mainnet
- PYTH_ID: TBA
- PYTH_STATE_ID: TBA

## Wormhole on Mainnet
- WORMHOLE_ID: TBA
- WORMHOLE_STATE_ID: TBA
