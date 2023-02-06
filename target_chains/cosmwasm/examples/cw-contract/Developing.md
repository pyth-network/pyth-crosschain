# Developing

This document contains guidance regarding building, testing and preparing your contracts for production.

## Prerequisites

Before starting, make sure you have [rustup](https://rustup.rs/) along with a
recent `rustc` and `cargo` version installed. Rust version 1.58.1 or above is required.

And you need to have the `wasm32-unknown-unknown` target installed as well.

You can check that via:

```sh
rustc --version
cargo --version
rustup target list --installed
# if wasm32 is not listed above, run this
rustup target add wasm32-unknown-unknown
```

## Compiling

After changing the contract, make sure you can compile and run it before
making any changes. Go into the repository and do:

```sh
# this will produce a wasm build in ./target/wasm32-unknown-unknown/release/example_cw_contract.wasm
cargo build --release --target wasm32-unknown-unknown
```

## Generating JSON Schema

While the Wasm calls (`instantiate`, `execute`, `query`) accept JSON, this is not enough
information to use it. You need to expose the schema for the expected messages to the
clients. You can generate this schema by calling `cargo run schema`, which will output
the schema at `./schema/example-cw-contract.json`, corresponding to the message types defined in `msg.rs`.

These files are in standard json-schema format, which should be usable by various
client side tools, either to auto-generate codecs, or just to validate incoming
json wrt. the defined schema.

## Preparing the Wasm bytecode for production

Before you upload it to a chain, you need to ensure the smallest output size possible,
as this will be included in the body of a transaction. You also want to have a
reproducible build process, so third parties can verify that the uploaded Wasm
code did indeed come from the claimed rust code.

To solve both these issues, CosmWasm have produced `rust-optimizer`, a docker image to
produce an extremely small build output in a consistent manner. The suggested way
to run it is this:

```sh
cd path/to/cargo/root
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer:0.12.11
```

Or, If you're on an arm64 machine, you should use a docker image built with arm64.

```sh
cd path/to/cargo/root
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer-arm64:0.12.11
```

You must mount the contract code to `/code`. You can use a absolute path instead
of `$(pwd)` if you don't want to `cd` to the directory first. The other two
volumes are nice for speedup. Mounting `/code/target` in particular is useful
to avoid docker overwriting your local dev files with root permissions.
Note the `/code/target` cache is unique for each contract being compiled to limit
interference, while the registry cache is global.

This is rather slow compared to local compilations, especially the first compile
of a given contract. The use of the two volume caches is very useful to speed up
following compiles of the same contract.

This produces an `artifacts` directory with a `PROJECT_NAME.wasm`, as well as
`checksums.txt`, containing the Sha256 hash of the wasm file.
The wasm file is compiled deterministically (anyone else running the same
docker on the same git commit should get the identical file with the same Sha256 hash).
It is also stripped and minimized for upload to a blockchain (it is also compressed using
gzip in the uploading process to make it even smaller).
