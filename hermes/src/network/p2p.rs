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
        store::{
            types::Update,
            Store,
        },
    },
    anyhow::Result,
    libp2p::Multiaddr,
    pythnet_sdk::wire::v1::{
        WormholeMessage,
        WormholePayload,
    },
    std::{
        ffi::{
            c_char,
            CString,
        },
        sync::{
            atomic::Ordering,
            mpsc::{
                Receiver,
                Sender,
            },
            Arc,
            Mutex,
        },
    },
    wormhole_sdk::{
        Address,
        Chain,
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

/// A wrapper around a VAA observed from Wormhole.
///
/// This wrapper tracks a Span that allows tracking the VAA through the system. This Span is
/// expected to be tied to the `proxy` Span and so logging will always be traced back to the
/// associated `proxy` Span regardless of where in the system it is being used.
#[derive(Clone, Debug)]
pub struct Vaa {
    pub span: tracing::Span,
    pub data: Vec<u8>,
}

// Allow PartialEq on Vaa that ignores the Span.
impl PartialEq for Vaa {
    fn eq(&self, other: &Self) -> bool {
        self.data == other.data
    }
}

/// Deref to &[u8] so we can ignore the wrapper when passing it to the store.
impl std::ops::Deref for Vaa {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

// A Static Channel to pipe the `Observation` from the callback into the local Rust handler for
// observation messages. It has to be static for now because there's no way to capture state in
// the callback passed into Go-land.
// TODO: Move this channel to the module level that spawns the services
lazy_static::lazy_static! {
    pub static ref OBSERVATIONS: (
        Mutex<Sender<Vaa>>,
        Mutex<Receiver<Vaa>>,
    ) = {
        let (tx, rc) = std::sync::mpsc::channel();
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

    // Deserialize VAA to check Creation Time
    let deserialized_vaa = {
        serde_wormhole::from_slice::<wormhole_sdk::Vaa<&serde_wormhole::RawMessage>>(&vaa)
            .map_err(|e| {
                tracing::error!(error = ?e, "Failed to deserialize VAA.");
            })
            .ok()
    }
    .unwrap();

    if deserialized_vaa.emitter_chain != Chain::Pythnet
        || deserialized_vaa.emitter_address != Address(pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS)
    {
        return; // Ignore VAA from other emitters
    }

    // Get the slot from the VAA.
    let slot = match WormholeMessage::try_from_bytes(deserialized_vaa.payload)
        .unwrap()
        .payload
    {
        WormholePayload::Merkle(proof) => proof.slot,
    };

    // Create a Span tied to the Span of the curent proxy.
    let span = tracing::span!(
        parent: tracing::Span::current(),
        tracing::Level::INFO,
        "Observation",
        slot = slot,
    );

    // Find the observation time for said VAA (which is a unix timestamp) and serialize as a ISO 8601 string.
    let observed_time = deserialized_vaa.timestamp;
    let observed_time = chrono::NaiveDateTime::from_timestamp_opt(observed_time as i64, 0).unwrap();
    let observed_time = observed_time.format("%Y-%m-%dT%H:%M:%S.%fZ").to_string();
    span.in_scope(|| tracing::info!(vaa_timestamp = observed_time, "Observed VAA"));

    // The chances of the mutex getting poisioned is very low and if it happens there is no way for
    // us to recover from it.
    if OBSERVATIONS
        .0
        .lock()
        .map_err(|_| ())
        .and_then(|tx| tx.send(Vaa { span, data: vaa }).map_err(|_| ()))
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
#[tracing::instrument(skip(opts, store))]
pub async fn spawn(opts: RunOptions, store: Arc<Store>) -> Result<()> {
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
            let vaa = tokio::task::spawn_blocking(|| {
                let observation = OBSERVATIONS.1.lock();
                let observation = match observation {
                    Ok(observation) => observation,
                    Err(e) => {
                        // This should never happen, but if it does, we want to panic and crash
                        // as it is not recoverable.
                        tracing::error!(error = ?e, "Failed to lock p2p observation channel.");
                        crate::SHOULD_EXIT.store(true, Ordering::Release);
                        return Err(anyhow::anyhow!("Failed to lock p2p observation channel"));
                    }
                };

                match observation.recv() {
                    Ok(vaa_bytes) => Ok(vaa_bytes),
                    Err(e) => {
                        // This should never happen, but if it does, we want to shutdown the
                        // application as it is unrecoverable.
                        tracing::error!(error = ?e, "Failed to receive p2p observation.");
                        crate::SHOULD_EXIT.store(true, Ordering::Release);
                        Err(anyhow::anyhow!("Failed to receive p2p observation."))
                    }
                }
            })
            .await??;

            vaa.span
                .in_scope(|| tracing::info!("Received VAA from P2P layer."));

            let store = store.clone();
            tokio::spawn(async move {
                if let Err(e) = store.store_update(Update::Vaa(vaa)).await {
                    tracing::error!(error = ?e, "Failed to process VAA.");
                }
            });
        }

        tracing::info!("Shutting down P2P server...");
        Ok::<(), anyhow::Error>(())
    });

    Ok(())
}
