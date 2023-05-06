# Pyth on Sui

## 1. Background

Pyth price feeds on Sui are uniquely represented in the global store as `PriceInfoObjects`. These objects have the `key` ability and serve as wrappers around the `PriceInfo` object, which in turn wraps around the `PriceFeed`, the arrival time of the latest price update, and the attestation time of the latest update.

`PriceInfoObject`s are central to Pyth on Sui, since they are in unique correspondence with each Pyth price feed and must be passed in to functions that act on price feeds, e.g.

- `update_single_price_feed`
- `update_single_pric_feeds_if_fresh`

## 2. How to Update and Consume Price Feeds

To update and then consume a price feed, one needs to build a Sui [programmable transaction](https://docs.sui.io/build/prog-trans-ts-sdk).

As with other chains, one first obtains a batch price attestation VAA (of type `vector<u8>`) off-chain for a Price Info Object whose feed is to be used. Assume the ID is `PRICE_INFO_OBJECT_ID`. Then, chain together the following sequence of function calls to update a price feed.

### 1. `wormhole::wormhole::parse_and_verify`

Call `parse_and_verify` on the batch attestation VAA bytes to obtain a `VAA` hot potato object.

```Rust
public fun parse_and_verify(
      wormhole_state: &State,
      buf: vector<u8>,
      the_clock: &Clock
  ): VAA
```
### 2. `pyth::pyth::update_single_price_feed`
Use the verified VAA and create a hot potato containing price updates.
```Rust
public fun create_price_infos_hot_potato(
        pyth_state: &PythState,
        verified_vaas: vector<VAA>,
        clock: &Clock
): HotPotatoVector<PriceInfo> 
```

### 3.`pyth::pyth::update_single_price_feed`
Use the hot potato to update a price feed.

```Rust
public fun update_single_price_feed(
    pyth_state: &PythState,
    price_updates: HotPotatoVector<PriceInfo>,
    price_info_object: &mut PriceInfoObject,
    fee: Coin<SUI>,
    clock: &Clock
): HotPotatoVector<PriceInfo>
```

### 4.`pyth::hot_potato_vector::destroy`
Drop the hot potato. (You must call this function to drop the potato).
```Rust
public fun destroy<T: copy + drop>(
    hot_potato_vector: HotPotatoVector<T>
)
```

### 5. `pyth::get_price`
Finally, get the price of the updated price feed in `PriceInfoObject` 🎉🎉🎉.
```Rust
public fun get_price(
      state: &PythState,
      price_info_object: &PriceInfoObject,
      clock: &Clock
): Price
```

Fetch the price of the updated Price Info Object.

## 3. Examples

See the `./scripts` folder for examples of programmable transactions for creating price feeds and updating price feeds.
- [Demo for updating a price feed](./scripts/pyth/update_price_feeds.ts)
- [Demo for creating new price feeds](./scripts/pyth/create_all_price_feeds.ts)

To build and test the contracts, run the following
```
$ make test
$ make build
```

## 4. Contracts Registry

## Pyth on Testnet

- PYTH_PACKAGE_ID: [0x4eb4b9b5f3ca3293d3b92898ebb54f4a8705cc6c1fb2a0d2b7ec69388c7f14e4](https://explorer.sui.io/object/0x4eb4b9b5f3ca3293d3b92898ebb54f4a8705cc6c1fb2a0d2b7ec69388c7f14e4?network=testnet)
- PYTH_STATE_ID: [0xe96526143f8305830a103331151d46063339f7a9946b50aaa0d704c8c04173e5](https://explorer.sui.io/object/0xe96526143f8305830a103331151d46063339f7a9946b50aaa0d704c8c04173e5?network=testnet)

## Wormhole on Testnet

- WORMHOLE_PACKAGE_ID: [0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7](https://explorer.sui.io/object/0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7?network=testnet)
- WORMHOLE_STATE_ID: [0x79ab4d569f7eb1efdcc1f25b532f8593cda84776206772e33b490694cb8fc07a](https://explorer.sui.io/object/0x79ab4d569f7eb1efdcc1f25b532f8593cda84776206772e33b490694cb8fc07a?network=testnet)

## Pyth on Mainnet

- PYTH_PACKAGE_ID: [0xa446c4a37c0bb69d03357c1a52d60da0b434048226d5f3feffdb693586bea861](https://explorer.sui.io/object/0xa446c4a37c0bb69d03357c1a52d60da0b434048226d5f3feffdb693586bea861?network=https%3A%2F%2Ffullnode.mainnet.sui.io%3A443)
- PYTH_STATE_ID: [0x428b5795904d5256d1eea5991df672934315fb8dcf8f6111134c1a52afd005ca](https://explorer.sui.io/object/0x428b5795904d5256d1eea5991df672934315fb8dcf8f6111134c1a52afd005ca?network=https%3A%2F%2Ffullnode.mainnet.sui.io%3A443)

## Wormhole on Mainnet

- WORMHOLE_PACKAGE_ID: [0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a](https://explorer.sui.io/object/0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a)
- WORMHOLE_STATE_ID: [0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c](https://explorer.sui.io/object/0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c)
