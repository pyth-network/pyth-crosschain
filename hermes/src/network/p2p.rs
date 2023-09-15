//! This module implements P2P connections for the PythNet service.
//!
//! Originally this code contained a full implementation of a libp2p node, but due to the fact that
//! QUIC+TLS is not yet supported by the Rust ecosystem, we had to resort to replacing this with a
//! small library implemented in Go that connects to the Wormhole network.
//!
//! This works and allows us to keep the program structure the same as if we could do it natively
//! in Rust but it should absolutely be removed once QUIC+TLS is supported in Rust. The change to
//! the program structure should be minimal, and users of the service won't need to change any of
//! their infrastructure.

use {
    crate::{
        config::RunOptions,
        state::State,
        wormhole::{
            forward_vaa,
            VaaBytes,
        },
    },
    anyhow::Result,
    libp2p::Multiaddr,
    std::{
        ffi::{
            c_char,
            CString,
        },
        sync::{
            atomic::Ordering,
            Arc,
        },
    },
    tokio::sync::{
        mpsc::{
            Receiver,
            Sender,
        },
        Mutex,
    },
};

extern "C" {
    fn RegisterObservationCallback(
        cb: extern "C" fn(o: ObservationC),
        network_id: *const c_char,
        bootstrap_addrs: *const c_char,
        listen_addrs: *const c_char,
    );
}

// An `Observation` C type passed back to us from Go.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct ObservationC {
    pub vaa:     *const u8,
    pub vaa_len: usize,
}

const CHANNEL_SIZE: usize = 1000;

// A Static Channel to pipe the `Observation` from the callback into the local Rust handler for
// observation messages. It has to be static for now because there's no way to capture state in
// the callback passed into Go-land.
lazy_static::lazy_static! {
    pub static ref OBSERVATIONS: (
        Mutex<Sender<VaaBytes>>,
        Mutex<Receiver<VaaBytes>>,
    ) = {
        let (tx, rc) = tokio::sync::mpsc::channel(CHANNEL_SIZE);
        (Mutex::new(tx), Mutex::new(rc))
    };
}

/// This function is passed as a callback to the Go libp2p runtime, it passes observations back and
/// acts as a proxy forwarding these observations into our main loop.
#[no_mangle]
#[tracing::instrument(skip(o))]
extern "C" fn proxy(o: ObservationC) {
    // Create a fixed slice from the pointer and length.
    let vaa = unsafe { std::slice::from_raw_parts(o.vaa, o.vaa_len) }.to_owned();

    // The chances of the mutex getting poisioned is very low and if it happens there is no way for
    // us to recover from it.
    if OBSERVATIONS
        .0
        .blocking_lock()
        .blocking_send(vaa)
        .map_err(|_| ())
        .is_err()
    {
        crate::SHOULD_EXIT.store(true, Ordering::Release);
        tracing::error!("Failed to lock p2p observation channel or to send observation.");
    }
}

/// This function handles bootstrapping libp2p (in Go) and listening for Wormhole Observations.
///
/// TODO: handle_message should be capable of handling more than just Observations. But we don't
/// have our own P2P network, we pass it in to keep the code structure and read directly from the
/// OBSERVATIONS channel in the RPC for now.
#[tracing::instrument(skip(wh_bootstrap_addrs, wh_listen_addrs))]
pub fn bootstrap(
    network_id: String,
    wh_bootstrap_addrs: Vec<Multiaddr>,
    wh_listen_addrs: Vec<Multiaddr>,
) -> Result<()> {
    let network_id_cstr = CString::new(network_id)?;
    let wh_bootstrap_addrs_cstr = CString::new(
        wh_bootstrap_addrs
            .iter()
            .map(|a| a.to_string())
            .collect::<Vec<_>>()
            .join(","),
    )?;
    let wh_listen_addrs_cstr = CString::new(
        wh_listen_addrs
            .iter()
            .map(|a| a.to_string())
            .collect::<Vec<_>>()
            .join(","),
    )?;

    // Launch the Go LibP2P Reactor.
    unsafe {
        RegisterObservationCallback(
            proxy as extern "C" fn(observation: ObservationC),
            network_id_cstr.as_ptr(),
            wh_bootstrap_addrs_cstr.as_ptr(),
            wh_listen_addrs_cstr.as_ptr(),
        );
    }

    tracing::info!("Registered observation callback.");

    Ok(())
}

// Spawn's the P2P layer as a separate thread via Go.
#[tracing::instrument(skip(opts, state))]
pub async fn spawn(opts: RunOptions, state: Arc<State>) -> Result<()> {
    tracing::info!(listeners = ?opts.wh_listen_addrs, "Starting P2P Server");

    std::thread::spawn(|| {
        if bootstrap(
            opts.wh_network_id,
            opts.wh_bootstrap_addrs,
            opts.wh_listen_addrs,
        )
        .is_err()
        {
            tracing::error!("Failed to bootstrap P2P server.");
            crate::SHOULD_EXIT.store(true, Ordering::Release);
        }
    });

    tokio::spawn(async move {
        // Listen in the background for new VAA's from the p2p layer
        // and update the state accordingly.
        while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
            let vaa_bytes = {
                let mut observation = OBSERVATIONS.1.lock().await;

                match observation.recv().await {
                    Some(vaa) => vaa,
                    None => {
                        // This should never happen, but if it does, we want to shutdown the
                        // application as it is unrecoverable.
                        tracing::error!("Failed to receive p2p observation. Channel closed.");
                        crate::SHOULD_EXIT.store(true, Ordering::Release);
                        return Err(anyhow::anyhow!("Failed to receive p2p observation."));
                    }
                }
            };

            forward_vaa(state.clone(), vaa_bytes).await;
        }

        tracing::info!("Shutting down P2P server...");
        Ok::<(), anyhow::Error>(())
    });

    Ok(())
}
