#![feature(never_type)]

use {
    anyhow::Result,
    futures::{
        channel::mpsc::Receiver,
        SinkExt,
    },
    std::time::Duration,
    structopt::StructOpt,
    tokio::{
        spawn,
        time::sleep,
    },
};

mod config;
mod network;

/// A Wormhole VAA is an array of bytes. TODO: Decoding.
#[derive(Debug, Clone, Eq, Hash, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Vaa {
    pub data: Vec<u8>,
}

/// A PythNet AccountUpdate is a 32-byte address and a variable length data field.
///
/// This type is emitted by the Geyser plugin when an observed account is updated and is forwrarded
/// to this process via IPC.
#[derive(Debug, Clone, Eq, Hash, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct AccountUpdate {
    addr: [u8; 32],
    data: Vec<u8>,
}

/// Handler for LibP2P messages. Currently these consist only of Wormhole Observations.
fn handle_message(_observation: network::p2p::Observation) -> Result<()> {
    println!("Rust: Received Observation");
    Ok(())
}

/// Initialize the Application. This can be invoked either by real main, or by the Geyser plugin.
async fn init(_update_channel: Receiver<AccountUpdate>) -> Result<()> {
    log::info!("Initializing PythNet...");

    // Parse the command line arguments with StructOpt, will exit automatically on `--help` or
    // with invalid arguments.
    match config::Options::from_args() {
        config::Options::Run {
            id: _,
            id_secp256k1: _,
            wormhole_addr: _,
            wormhole_peer: _,
            rpc_addr,
            p2p_addr,
            p2p_peer: _,
        } => {
            log::info!("Starting PythNet...");

            // Spawn the P2P layer.
            log::info!("Starting P2P server on {}", p2p_addr);
            network::p2p::spawn(handle_message).await?;

            // Spawn the RPC server.
            log::info!("Starting RPC server on {}", rpc_addr);
            network::rpc::spawn(rpc_addr.to_string()).await?;

            // Wait on Ctrl+C similar to main.
            tokio::signal::ctrl_c().await?;
        }

        config::Options::Keygen { output: _ } => {
            println!("Currently not implemented.");
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<!> {
    env_logger::init();

    // Generate a stream of fake AccountUpdates when run in binary mode. This is temporary until
    // the Geyser component of the accumulator work is complete.
    let (mut tx, rx) = futures::channel::mpsc::channel(1);

    spawn(async move {
        let mut data = 0u32;

        loop {
            // Simulate PythNet block time.
            sleep(Duration::from_millis(200)).await;

            // Ignore the return type of `send`, since we don't care if the receiver is closed.
            // It's better to let the process continue to run as this is just a temporary hack.
            let _ = SinkExt::send(
                &mut tx,
                AccountUpdate {
                    addr: [0; 32],
                    data: {
                        data += 1;
                        let mut data = data.to_be_bytes().to_vec();
                        data.resize(32, 0);
                        data
                    },
                },
            )
            .await;
        }
    });

    tokio::spawn(async move {
        // Launch the application. If it fails, print the full backtrace and exit. RUST_BACKTRACE
        // should be set to 1 for this otherwise it will only print the top-level error.
        if let Err(result) = init(rx).await {
            eprintln!("{}", result.backtrace());
            for cause in result.chain() {
                eprintln!("{cause}");
            }
        }
    });

    // TODO: Setup a Ctrl-C handler that waits. We use process::exit(0) for now but we should have
    // a graceful shutdown with an AtomicBool or similar before production.
    tokio::signal::ctrl_c().await?;
    std::process::exit(0);
}
