/*!
# OpenZeppelin Contracts for Stylus

A library for secure smart contract development written in Rust for
[Arbitrum Stylus](https://docs.arbitrum.io/stylus/stylus-gentle-introduction).
This library offers common smart contract primitives and affordances that take
advantage of the nature of Stylus.

> This project is still in a very early and experimental phase. It has never
> been audited nor thoroughly reviewed for security vulnerabilities. Do not use
> in production.

## Usage

To start using it, add `openzeppelin-stylus` to your `Cargo.toml`, or simply run
`cargo add openzeppelin-stylus`.

```toml
[dependencies]
openzeppelin-stylus = "x.x.x"
```

We recommend pinning to a specific version -- expect rapid iteration.

Once defined as a dependency, use one of our pre-defined implementations by
importing them:

```ignore
use openzeppelin_stylus::token::erc20::Erc20;

sol_storage! {
    #[entrypoint]
    struct MyContract {
        #[borrow]
        Erc20 erc20;
    }
}

#[external]
#[inherit(Erc20)]
impl MyContract { }
```
*/


#![allow(clippy::pub_underscore_fields, clippy::module_name_repetitions)]
#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![deny(rustdoc::broken_intra_doc_links)]

extern crate alloc;

#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

pub mod utils;
pub mod pyth;


