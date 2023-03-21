# Hermes

Hermes is a highly available and versatile software that defines the Pyth P2P
network. It also provides the public Pyth API and connects with the Pyth Geyser
node software to listen for Pythnet events. Hermes offers both REST and
WebSocket APIs for seamless integration and interaction with the Pyth network
stack. Anyone can run the Node to:

1. Provide their own Pyth API for interacting with the Pyth Network stack.
2. Observe Pyth price updates in real-time.
3. Operate alongside their Pythnet validator for fully decentralized access to Pyth.

## Getting Started

To set up and run a Hermes node, follow the steps below:

1. **Install Rust**: If you haven't already, you'll need to install Rust. You can
   do so by following the official instructions.
2. **Install Go**: If you haven't already, you'll also need to install Go. You can
   do so by following the official instructions.
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
5. **Run the node**: To run Hermes, use the following command:
   ```bash
   ./target/release/hermes run --geyser-socket /tmp/geyser.ipc
   ```
   Your Hermes node will now start and connect to the specified networks. You
   can interact with the node using the REST and Websocket APIs as described
   in the [API Documentation](). You can leave off the `--geyser-socket` arg
   if you are planning to run the node without a Pythnet validator, it will
   extract data only from the Pyth P2P network. Running a Pythnet node will
   improve the speed and accuracy of network observations.

## Architecture Overview

For users who simply want to run the software, this section can be skipped.
However, for those interested in understanding Pyth's architecture, this
section explains the old and new architecture, as well as our motivation for
the design.

### Background

The Pyth project offers a cross-chain price oracle service for real-time access
to current prices of real-world assets. These prices are aggregated on Pythnet,
where core Pyth contracts are hosted, and pricing information is generated. The
Wormhole project currently sends these prices to other chains.

To share these prices, the Pyth project provides a standalone application
called the Price Service, which queries the message API provided by Wormhole to
look for Pyth prices.

The original communication flow can be visualized in the following graph:

```
           +--------+     +--------+     +--------+
           | User 3 |     | User 2 |     | User 1 |
           +--------+     +--------+     +--------+
             |              |              |
             |              |              |
             +--------------+--------------+
                            |
                            v
                 +---------------------+
                 |    Price Service    | (Weakly Decentralised)
                 +----------+----------+
                            |
                            v
                 +---------------------+
                 |      Wormhole       | (Decentralised)
                 +---------------------+
                            ^
                            |
                            v
        + - - - - - - - - - + - - - - - - - - - - - +
        ' Pythnet                                   '
        '                                           '
        ' +----------------+                        '
        ' | Pythnet Node 1 | ------+                '
        ' +----------------+       |                '
        '   |                      |                '
        '   |                      |                '
        ' +----------------+       |                ' (Decentralised)
        ' | Pythnet Node 2 |       |                '
        ' +----------------+       |                '
        '   |                      |                '
        '   |                      |                '
        ' +----------------+     +----------------+ '
        ' | Pythnet Node 3 | --- | Pythnet Node 4 | '
        ' +----------------+     +----------------+ '
        + - - - - - - - - - - - - - - - - - - - - - +
```

This design has issues due to latency and API complexity introduced by the
Price Service, which acts as a middleman between the user, Wormhole, and
Pythnet. Additionally, it does not represent a particularly decentralized
design, which was a weak point for Pyth.

### New Model

In the new model, we designed a single node-style service, Hermes, intended for
direct integration into Pythnet nodes. This aligns with other blockchain
projects where running standard node software allows users to act as observers
of the network:

```
           +--------+     +--------+     +--------+
           | User 3 |     | User 2 |     | User 1 |
           +--------+     +--------+     +--------+
             |              |              |
             |              |              |
             +--------------+--------------+
                            |
                            v
        + - - - - - - - - - + - - - - - - - - - - - +
        ' Pythnet                                   '
        '                                           '
        ' +----------------+                        '
        ' | Pythnet Node 1 | ------+                '
        ' +----------------+       |                '
        '   |     |Hermes|         |                '
        '   |     +------+         |                '
        '   |                      |                '
        ' +----------------+       |                '
        ' | Pythnet Node 2 |       |                '
        ' +----------------+       |                '
        '   |     |Hermes|         |                '
        '   |     +------+         |                '
        '   |                      |                '
        ' +----------------+     +----------------+ '
        ' | Pythnet Node 3 | --- | Pythnet Node 4 | '
        ' +----------------+     +----------------+ '
        '         |Hermes|               |Hermes|   '
        '         +------+               +------+   '
        + - - - - - - - - - - - - - - - - - - - - - +
                            ^
                            |
                            v
                 +---------------------+
                 |      Wormhole       |
                 +---------------------+
```

In this new design, the Price Service is integrated into the Hermes node
service, decentralizing the API. Hermes is now also responsible for direct
communication with Wormhole over P2P, which reduces latency and simplifies
responsibilities.

The new design offers several benefits:

1. Hermes can participate as a P2P node in the Wormhole network directly.
2. Hermes nodes form a Pyth-specific P2P network with fast communication.
3. Hermes can directly observe on-chain state for faster operation.
4. Hermes can have its identity tied to a Pythnet node for authenticated operation.
5. Data ownership is clearer with the removal of the middleman.

With tighter communication flow, we can define new behaviors such as
Pyth-specific threshold signing, fast price accumulation with proving (due to
direct node access), improved metrics and observations, and the ability for
users to run observe-only Hermes nodes to watch the Pyth network directly
instead of relying on a Price Service host.

The Hermes node architecture is as follows:

---

![image](https://user-images.githubusercontent.com/158967/225939587-f19cfe77-0393-4798-ad72-0022420d3e51.png)

---

This is more in line with other well-known projects in the blockchain and P2P
space, such as Solana, Bitcoin, and Cosmos chains, where users who run the node
can also act as observers with specific features disabled.

In our case, the node software can be run with or without a Pythnet validator
running due to it being designed to fetch updates from either Pyth or Geyser
networks for high availability.

## Components

The Hermes Node software consists of the following components:

- **Wormhole P2P Connector**: Connects to the Wormhole P2P network and listens for VAAs.
- **Pyth P2P Connector**: Connects to the Pyth P2P network and listens for Account Updates.
- **Geyser Connector**: Connects to the Geyser node software and listens for Account Updates.
- **REST API**: Provides an interface for external applications to interact with Pythnet.
- **Websocket API**: Offers real-time data streaming for interacting with Pythnet.

While Hermes will always participate in the Wormhole and Pyth P2P networks, the
Pyth network shares network updates on the Pyth layer and so can be run without
a Pythnet node running along-side it for a spy-only mode. This can be done by
running without specifying `--geyser-socket`.
