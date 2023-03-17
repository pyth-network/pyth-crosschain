use {
    crate::AccountUpdate,
    anyhow::Result,
    futures::{
        select,
        StreamExt,
    },
    libp2p::{
        gossipsub::{
            self,
            IdentTopic,
            MessageAuthenticity,
            MessageId,
        },
        identity,
        swarm::{
            NetworkBehaviour,
            SwarmEvent,
        },
        PeerId,
    },
    std::{
        collections::hash_map::DefaultHasher,
        hash::{
            Hash,
            Hasher,
        },
        time::Duration,
    },
};


/// This enum represents the P2P-specific events that can be raised by libp2p itself.
///
/// These are specifically meant to cover the various libp2p networking protocols that were chosen.
/// Pyth specific messages are covered instead by the `Message` enum.
enum PythEvent {
    Gossipsub(gossipsub::Event),
}

/// This enum represents the Pyth specific messages that can be shared over libp2p.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub enum PythMessage {
    /// Message containing an Accumulator and a Signature.
    ///
    /// These are broadcast to other nodes to allow them to aggregate state proofs, this is how
    /// Wormhole currently works.
    Accumulator {
        account_update: AccountUpdate,

        #[serde(with = "serde_arrays")]
        signature: [u8; 64],
    },

    /// Message containing a new Solana Validator set.
    ///
    /// This allows us to track how the Validator set changes with each Solana epoch, we would want
    /// to keep our P2P identities in sync with the Validator set as much as possible so when we
    /// gossip messages we want to reject anything that is not signed by a node currently staked on
    /// the network.
    ValidatorSet(Vec<()>),
}

// A From implementation to help libp2p convert Gossip events into our application p2p events.
impl From<gossipsub::Event> for PythEvent {
    fn from(e: gossipsub::Event) -> Self {
        PythEvent::Gossipsub(e)
    }
}

/// This struct represents the P2P network behaviour for Pyth.
///
/// Each of the fields in this struct represents a different libp2p protocol used to communicate
/// with other nodes. Each new field requires a new enum variant in the `PythEvent` enum above in
/// order to be able to handle events from the protocol. Libp2p will automatically convert the
/// events into the appropriate variant in the `PythEvent` enum.
#[derive(NetworkBehaviour)]
#[behaviour(out_event = "PythEvent")]
struct PythP2P {
    gossip: gossipsub::Behaviour,
}

/// This function handles bootstrapping libp2p and running the main event loop.
///
/// The event loop itself is single-threaded, and so it is important that the handler function does
/// not block for long periods of time or messages will be dropped. Make sure to fork immediately
/// if you need to do any long-running work.
///
/// This function can be called multiple times to spawn multiple instances of the event loop. This
/// is useful for testing purposes.
#[allow(clippy::collapsible_match)]
#[allow(clippy::single_match)]
pub async fn bootstrap() -> Result<()> {
    // Initialize Bootstrap Params - This sets up our identity that represents us in the network
    // and also sets up the various transports used to communicate. We can combine for example TCP,
    // QUIC and IPC here.
    let local_key = identity::Keypair::generate_secp256k1();
    let local_pid = PeerId::from(local_key.public());

    // Message Mapper - This assigns an ID to each message by hashing the message data. The ID is
    // used for message deduplication.
    let mapper = |message: &gossipsub::Message| {
        let mut s = DefaultHasher::new();
        message.data.hash(&mut s);
        MessageId::from(s.finish().to_string())
    };

    // Gossip Topic, we use a single one for now.
    let topic = IdentTopic::new("pyth".to_string());

    // Gossipsub Configuration. Gossipsub is the protocol used to route messages between nodes. We
    // can set various configuration here such as configuration mesh, caching, max message size and
    // so forth.
    let gossip_config = gossipsub::ConfigBuilder::default()
        .heartbeat_interval(Duration::from_secs(10))
        .message_id_fn(mapper)
        .backoff_slack(20)
        .build()
        .unwrap();

    // Create the Gossipsub instance.
    let mut gossip =
        gossipsub::Behaviour::new(MessageAuthenticity::Signed(local_key), gossip_config)
            .map_err(|e| anyhow::anyhow!("Failed to create Gossipsub: {}", e))?;

    // Subscribe to Pyth topic, every node must do this in order to receive messages.
    gossip.subscribe(&topic)?;

    // Transport for the P2P network. This is where we can combine various transports such as TCP,
    let transport = libp2p::quic::Config::new(&local_key)
        .upgrade(libp2p::core::upgrade::Version::V1)
        .authenticate(libp2p::tls::Config::new(&local_key))
        .multiplex(libp2p::yamux::YamuxConfig::default())
        .boxed();

    // Swarm puts the transport and the network behaviour together, and sets up our event loop
    // handler for everything. Use the tokio runtime to spawn the swarm.
    let mut swarm =
        libp2p::swarm::SwarmBuilder::with_tokio_executor(transport, PythP2P { gossip }, local_pid)
            .build();

    // Set up which interfaces we want to listen on for libp2p traffic.
    swarm.listen_on("/ip4/0.0.0.0/tcp/34000".parse()?)?;

    // Start our event loop, note that we setup two contexts here. One is listening for events from
    // Solana and the other from libp2p. The reason our solana listener is here is because we can't
    // emit libp2p messages from anywhere else. Even though the Solana events come in through the
    // plugin in `geyser.rs` they are forwarded here via a channel so we can gossip them.
    loop {
        select! {
            // Handle incoming libp2p events.
            event = swarm.select_next_some() => match event {
                SwarmEvent::Behaviour(event) => {
                    match event {
                        PythEvent::Gossipsub(event) => match event {
                            // This event is where we handle our Pyth specific network messages.
                            gossipsub::Event::Message {
                                propagation_source: _,
                                message_id: _,
                                message,
                            } => {
                                // TODO: Handle Messages here. This is where we would do message
                                // signing for example if we were to do threshold.
                            },

                            // For all other Gossip events we just ignore them for now. It may be
                            // wise to log them later in case we need to debug libp2p issues or to
                            // inspect the network.
                            _ => {}
                        }
                    }
                },

                // Log every other Swarm event for debugging.

                SwarmEvent::NewListenAddr { address, .. } => {
                    log::info!("Listening on {:?}", address);
                },

                SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                    log::info!("Connected to {:?}", peer_id);
                },

                SwarmEvent::ConnectionClosed { peer_id, .. } => {
                    log::info!("Disconnected from {:?}", peer_id);
                },

                SwarmEvent::IncomingConnection { send_back_addr, .. } => {
                    log::info!("Incoming connection from {:?}", send_back_addr);
                },

                SwarmEvent::IncomingConnectionError { send_back_addr, error, .. } => {
                    log::info!("Incoming connection error from {:?}: {:?}", send_back_addr, error);
                },

                SwarmEvent::Dialing(peer_id) => {
                    log::info!("Dialing {:?}", peer_id);
                },

                SwarmEvent::ListenerClosed { reason, .. } => {
                    log::info!("Listener closed: {:?}", reason);
                },

                SwarmEvent::ListenerError { error, .. } => {
                    log::info!("Listener error: {:?}", error);
                },

                SwarmEvent::BannedPeer { peer_id, .. } => {
                    log::info!("Banned peer: {:?}", peer_id);
                },

                _ => {
                }
            }
        }
    }
}

pub async fn spawn() {
    tokio::spawn(bootstrap());
}

/// A Node Identity.
///
/// This type exists to wrap secp256k1 keys so we can easily convert to both `secp256k1` and
/// `libp2p::identity` for all secp256k1 use cases.
#[derive(Clone, Debug)]
pub struct NodeIdentity {
    /// A raw byte form of an secp256k1 keypair.
    bytes: [u8; 32],
}

// Convert NodeIdentity into an sec256k1 keypair for general signing.
impl From<NodeIdentity> for secp256k1::KeyPair {
    fn from(identity: NodeIdentity) -> Self {
        let secp = secp256k1::Secp256k1::new();
        let secret_key = secp256k1::SecretKey::from_slice(&identity.bytes[0..32]).unwrap();
        secp256k1::KeyPair::from_secret_key(&secp, &secret_key)
    }
}

// Convert NodeIdentity into a libp2p::identity::Keypair for libp2p use.
impl From<NodeIdentity> for libp2p::identity::Keypair {
    fn from(identity: NodeIdentity) -> Self {
        let local_key = identity::secp256k1::SecretKey::from_bytes(identity.bytes).unwrap();
        identity::Keypair::Secp256k1(local_key.into())
    }
}

/// Generate a new secp256k1 keypair, storing the private key in the specified file.
pub async fn write_new_identity(output: std::path::PathBuf) -> anyhow::Result<()> {
    let secret_key = secp256k1::SecretKey::new(&mut rand::thread_rng());
    let mut file = tokio::fs::File::create(output).await?;
    tokio::io::AsyncWriteExt::write_all(&mut file, &secret_key.secret_bytes()).await?;
    Ok(())
}

/// Read a secp256k1 keypair from the specified file. This is the raw bytes of the private key.
pub async fn read_identity(input: std::path::PathBuf) -> anyhow::Result<NodeIdentity> {
    let mut file = tokio::fs::File::open(input).await?;
    let mut bytes = [0u8; 32];
    tokio::io::AsyncReadExt::read_exact(&mut file, &mut bytes).await?;
    Ok(NodeIdentity { bytes })
}
