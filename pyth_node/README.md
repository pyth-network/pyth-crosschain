Wormhole Node
================================================================================

Pyth Node is a highly available and versatile software that defines the Pyth
P2P network, Pyth API, and connects with the Pyth Geyser node software to
listen for PythNet events. It offers both REST and Websocket APIs for ease of
integration and interaction with the Pyth network stack.

The Node can be run by anyone who wishes to participate / observe the PythNet
network operations.

Overview
--------------------------------------------------------------------------------

Pyth was initially designed with a simple "Price Service" with a REST API.
However, as the project evolved, its architecture can be rethought and improved
to be a more general node software that incorporates the Price Service as one
of its components.

The new architecture is more in line with other well-known projects in the
blockchain and P2P space, such as Solana, Bitcoin, and Cosmos chains, where
users who run the node can also act as observers with specific features
disabled. In our case, the node software can be run with or without a PythNet
validator running.

Pyth Node has several responsibilities:

- Offering a REST and Websocket API to interact with the Pyth network.
- Connecting to the Wormhole P2P network and listening for Pyth-related VAAs/Messages.
- Connecting to the Pyth P2P network and sharing Pyth-specific Account Updates.
- Connecting to PythNet itself via our Geyser plugin to allow for a fully
  decentralised PythNet.

The node is designed to fetch updates from either Pyth or Geyser networks for
high availability.

Architecture
--------------------------------------------------------------------------------

The Pyth Node software consists of the following components:

- *Wormhole P2P Connector*: Responsible for connecting to the Wormhole P2P network and listening for VAAs.
- *Pyth P2P Connector*: Responsible for connecting to the Pyth P2P network and listening for Account Updates.
- *Geyser Connector*: Responsible for connecting to the Geyser node software and listening for Account Updates. It can be disabled if desired to run the node as an observer, only listening to the Pyth P2P network.
- *REST API*: Provides an interface for external applications to interact with the node and retrieve information from the connected networks.
- *Websocket API*: Offers real-time data streaming and interaction with the node, enabling efficient updates and communication.

Justification for the New Architecture
--------------------------------------------------------------------------------

The new architecture allows for increased flexibility and high availability by
incorporating multiple components that can be enabled or disabled based on
specific use cases.

In particular this allows user's to run the node in order to participate in the
Pyth P2P network to observe prices and serve their own API/RPC. It also allows
a better data ownership model that allow's the Node software to be the main
source of responsibility when interacting with Pyth.

Getting Started
--------------------------------------------------------------------------------

To set up and run a Pyth Node, follow the steps below:

1. *Install Rust&: If you haven't already, you'll need to install Rust. You can
   do so by following the official instructions.
2. *Clone the repository*: Clone the Pyth Node repository to your local
   machine using the following command:
   ```bash
   git clone https://github.com/pyth-network/pyth-crosschain.git
   ```
3. *Build the project*: Navigate to the project directory and run the following command to build the project:
   ```bash
   cd pyth-node
   cargo build --release
   ```
   This will create a binary in the target/release directory.
4. *Run the node*: To run the Pyth Node, use the following command, replacing
   ```bash
   ./target/release/pyth-node run
   ```
   Your Pyth Node will now start and connect to the specified networks. You
   can interact with the node using the REST and Websocket APIs as described
   in the [API Documentation]().
   ```
