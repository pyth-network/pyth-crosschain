# Hermes

Hermes is a web service designed to monitor both Pythnet and the Wormhole
Network for the next generation of Pyth price updates. It supersedes the Pyth
Price Service, offering these updates through a user-friendly web API. The
service facilitates easy querying for recent price updates via a REST API, as
well as provides the option to subscribe to a websocket for real-time updates.
Hermes maintains compatibility with the price service API, allowing the [Price
Service JS client](/price_service/client/js)
to seamlessly connect to an instance of Hermes and fetch on-demand price
updates.

## Getting Started

To set up and run a Hermes node, follow the steps below:

0. **Prerequisites**: Hermes requires a running instance of Pythnet and the Wormhole spy RPC. You can find instructions
   for getting a Pythnet RPC instance from a node provider
   [here](https://docs.pyth.network/documentation/pythnet-price-feeds/hermes#hermes-node-providers) and instructions
   for running a Wormhole spy RPC instance [here](https://docs.wormhole.com/wormhole/explore-wormhole/spy). We recommend
   using [Beacon](https://github.com/pyth-network/beacon), a highly available rewrite for spy, for production purposes.
1. **Install Rust 1.82.0**: If you haven't already, you'll need to install Rust. You can
   do so by following the official instructions. Then, run the following command to install the required
   version of Rust:
   ```bash
    rustup toolchain install 1.82.0
   ```
2. **Install Go**: If you haven't already, you'll also need to install Go. You can
   do so by following the official instructions. If you are on a Mac with M series
   chips, make sure to install the **arm64** version of Go.
3. **Clone the repository**: Clone the Pyth Crosschain repository to your local
   machine using the following command:
   ```bash
   git clone https://github.com/pyth-network/pyth-crosschain.git
   ```
4. **Build the project**: Navigate to the project directory and run the following command to build the project:
   ```bash
   cd apps/hermes/server
   cargo build --release
   ```
   This will create a binary in the target/release directory.
5. **Run the node**: To run Hermes for Pythnet, use the following command:

   ```bash
   cargo run --release -- run \
     --pythnet-http-addr https://pythnet-rpc/ \
     --pythnet-ws-addr wss://pythnet-rpc/ \
     --wormhole-spy-rpc-addr https://wormhole-spy-rpc/
   ```

   Your Hermes node will now start and connect to the Pythnet and Wormhole spy RPC. You
   can interact with the node using the REST and Websocket APIs on port 33999.

   For local development, you can also run the node with [cargo watch](https://crates.io/crates/cargo-watch) to restart
   it automatically when the code changes.

   ```bash
   cargo watch -w src -x "run -- run --pythnet-http-addr https://pythnet-rpc/ --pythnet-ws-addr wss://pythnet-rpc/ --wormhole-spy-rpc-addr https://wormhole-spy-rpc/
   ```
