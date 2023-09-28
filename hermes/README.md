# Hermes

Hermes is a web service designed to monitor both Pythnet and the Wormhole
Network for the next generation of Pyth price updates. It supersedes the Pyth
Price Service, offering these updates through a user-friendly web API. The
service facilitates easy querying for recent price updates via a REST API, as
well as provides the option to subscribe to a websocket for real-time updates.
Hermes maintains compatibility with the price service API, allowing the [Price
Service JS client](https://github.com/pyth-network/pyth-crosschain/tree/main/price_service/client/js)
to seamlessly connect to an instance of Hermes and fetch on-demand price
updates.

## Getting Started

To set up and run a Hermes node, follow the steps below:

1. **Install Rust nightly-2023-07-23**: If you haven't already, you'll need to install Rust. You can
   do so by following the official instructions. Then, run the following command to install the required
   nightly version of Rust:
   ```bash
    rustup toolchain install nightly-2023-07-23
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
   cd hermes
   cargo build --release
   ```
   This will create a binary in the target/release directory.
5. **Run the node**: To run Hermes for Pythnet, use the following command:

   ```bash
   ./target/release/hermes run \
     --pythnet-http-addr https://pythnet-rpc/ \
     --pythnet-ws-addr wss://pythnet-rpc/
   ```

   Your Hermes node will now start and connect to the specified networks. You
   can interact with the node using the REST and Websocket APIs on port 33999.

   For local development, you can also run the node with [cargo watch](https://crates.io/crates/cargo-watch) to restart
   it automatically when the code changes:

   ```bash
   cargo watch -w src -x "run -- run --pythnet-http-addr https://pythnet-rpc/ --pythnet-ws-addr wss://pythnet-rpc/"
   ```
