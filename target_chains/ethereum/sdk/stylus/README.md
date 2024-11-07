# Pyth Stylus SDK

This package provides utilities for consuming prices from the [Pyth Network](https://pyth.network/) Oracle using Solidity. Also, it contains [the Pyth Interface ABI](./abis/IPyth.json) that you can use in your libraries
to communicate with the Pyth contract.

It is **strongly recommended** to follow the [consumer best practices](https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices) when consuming Pyth data.


## Features

- Pyth  smart contracts use external calls  [`pyth-solidty-contracts`] library.
- First-class `no_std` support.
- Solidity constructors powered by [`koba`].
- [Unit] and [integration] test affordances are used in our tests.
  

## Installation

You can import Stylus  Contracts from crates.io by adding the following
line to your `Cargo.toml` (We recommend pinning to a specific version):

```toml
[dependencies]
pyth-stylus = "0.0.1"
```

Optionally, you can specify a git dependency if you want to have the latest
changes from the `main` branch:

```toml
[dependencies]
pyth-stylus = { git = "URL" }
```

## Example Usage

To consume prices you should use the functions interface. Please make sure to read the documentation of this
functions to use the prices safely.

For example, to read the latest price, call [`getPriceNoOlderThan`](IPyth.sol) with the Price ID of the price feed
you're interested in

```rust

use pyth_stylus::pyth::{functions::{ get_price_unsafe}};

sol_storage! {
    #[entrypoint]
    struct FunctionCallsExample {
        address pyth_address;
        bytes32 price_id;
        StoragePrice price;
        StoragePriceFeed price_feed;
        StoragePrice ema_price;
        StoragePriceFeed ema_price_feed;
    }
}

sol! {

    error ArraySizeNotMatch();

    error CallFailed();

}

#[derive(SolidityError)]
pub enum MultiCallErrors {

    ArraySizeNotMatch(ArraySizeNotMatch),

    CallFailed(CallFailed),

}


impl FunctionCallsExample {
    pub fn get_price_no_older_than(&mut self) -> Result<(), Vec<u8>> {
       let _ =  get_price_no_older_than(self, self.pyth_address.get(), self.price_id.get(), U256::from(1000))?;
       Ok(())
    }
}

```

Another approach is not to  use the call functions but use the Pyth contract, that implement the IPyth functions 

```rust 
#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use stylus_sdk::prelude::{entrypoint,public, sol_storage,};
use pyth_stylus::pyth::pyth_contract::PythContract;


sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        #[borrow]
        PythContract pyth
    }
}

#[public]
#[inherit(PythContract)]
impl ProxyCallsExample {
}

```

## Mocking Pyth

[MockPyth](./mock.rs) is a mock contract you can use and deploy locally to mock Pyth contract behavior. To set and update price feeds you should call `updatePriceFeeds` and provide an array of encoded price feeds  as its argument. You can create encoded price feeds either by calling `create_price_feed_update_data` function in the mock contract, That functions also exist in the function file.

### Releases

We use [Semantic Versioning](https://semver.org/) for our releases. In order to release a new version of this package and publish it to npm, follow these steps:

1. Run `npm version <new version number> --no-git-tag-version`. This command will update the version of the package. Then push your changes to github.
2. Once your change is merged into `main`, create a release with tag `v<new version number>` like `v1.5.2`, and a github action will automatically publish the new version of this package to npm.
