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
    anyhow::Result,
    std::{
        ffi::{
            c_char,
            CString,
        },
        sync::{
            mpsc::{
                Receiver,
                Sender,
            },
            Mutex,
        },
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

pub type Observation = Vec<u8>;

// A Static Channel to pipe the `Observation` from the callback into the local Rust handler for
// observation messages. It has to be static for now because there's no way to capture state in
// the callback passed into Go-land.
// TODO: Move this channel to the module level that spawns the services
lazy_static::lazy_static! {
    pub static ref OBSERVATIONS: (
        Mutex<Sender<Observation>>,
        Mutex<Receiver<Observation>>,
    ) = {
        let (tx, rc) = std::sync::mpsc::channel();
        (Mutex::new(tx), Mutex::new(rc))
    };
}

/// This function is passed as a callback to the Go libp2p runtime, it passes observations back and
/// acts as a proxy forwarding these observations into our main loop.
#[no_mangle]
extern "C" fn proxy(o: ObservationC) {
    // Create a fixed slice from the pointer and length.
    let vaa = unsafe { std::slice::from_raw_parts(o.vaa, o.vaa_len) }.to_owned();
    if let Err(e) = OBSERVATIONS.0.lock().unwrap().send(vaa) {
        log::error!("Failed to send observation: {}", e);
    }
}

/// This function handles bootstrapping libp2p (in Go) and listening for Wormhole Observations.
///
/// TODO: handle_message should be capable of handling more than just Observations. But we don't
/// have our own P2P network, we pass it in to keep the code structure and read directly from the
/// OBSERVATIONS channel in the RPC for now.
pub fn bootstrap<H>(
    _handle_message: H,
    network_id: String,
    wh_bootstrap_addrs: String,
    wh_listen_addrs: String,
) -> Result<()>
where
    H: Fn(Observation) -> Result<()> + 'static,
{
    log::warn!("Network ID: {:?}", network_id);
    let c_network_id = CString::new(network_id)?;
    let c_wh_bootstrap_addrs = CString::new(wh_bootstrap_addrs)?;
    let c_wh_listen_addrs = CString::new(wh_listen_addrs)?;

    // Launch the Go LibP2P Reactor.
    unsafe {
        RegisterObservationCallback(
            proxy as extern "C" fn(observation: ObservationC),
            c_network_id.as_ptr(),
            c_wh_bootstrap_addrs.as_ptr(),
            c_wh_listen_addrs.as_ptr(),
        );

        // The memory will be freed when the Go function finishes using the
        // pointers since C.GoString creates a copy of the strings.
        std::mem::forget(c_network_id);
        std::mem::forget(c_wh_bootstrap_addrs);
        std::mem::forget(c_wh_listen_addrs);
    }
    Ok(())
}

// Spawn's the P2P layer as a separate thread via Go.
pub async fn spawn<H>(
    handle_message: H,
    network_id: String,
    wh_bootstrap_addrs: String,
    wh_listen_addrs: String,
) -> Result<()>
where
    H: Fn(Observation) -> Result<()> + Send + 'static,
{
    bootstrap(
        handle_message,
        network_id,
        wh_bootstrap_addrs,
        wh_listen_addrs,
    )?;
    Ok(())
}
