use {
    crate::{
        network::p2p::OBSERVATIONS,
        Vaa,
    },
    anyhow::Result,
    axum::{
        routing::get,
        Router,
    },
    dashmap::DashMap,
    std::sync::Arc,
};

mod rest;

#[derive(Clone, Default)]
pub struct VaaCache(Arc<DashMap<String, Vec<(i64, Vaa)>>>);

impl VaaCache {
    /// Add a VAA to the cache. Keeps the cache sorted by timestamp.
    fn add(&mut self, key: String, timestamp: i64, vaa: Vaa) -> Result<()> {
        self.remove_expired()?;
        let mut entry = self.0.entry(key).or_default();
        let key = entry
            .binary_search_by(|(t, _)| t.cmp(&timestamp))
            .unwrap_or_else(|e| e);
        entry.insert(key, (timestamp, vaa));
        Ok(())
    }

    /// Remove expired VAA's from the cache.
    fn remove_expired(&mut self) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        // Scan for items older than now, remove, if the result is empty remove the key altogether.
        for mut item in self.0.iter_mut() {
            let (key, vaas) = item.pair_mut();
            vaas.retain(|(t, _)| t > &now);
            if vaas.is_empty() {
                self.0.remove(key);
            }
        }

        Ok(())
    }

    /// For a given set of Price IDs, return the latest VAA for each Price ID.
    fn latest_for_ids(&self, ids: Vec<String>) -> Vec<(String, Vaa)> {
        self.0
            .iter()
            .filter_map(|item| {
                if !ids.contains(item.key()) {
                    return None;
                }

                let (_, latest_vaa) = item.value().last()?;
                Some((item.key().clone(), latest_vaa.clone()))
            })
            .collect()
    }
}

#[derive(Clone)]
pub struct State {
    /// A Cache of VAA's that have been fetched from the Wormhole RPC.
    pub vaa_cache: VaaCache,
}

impl State {
    fn new() -> Self {
        Self {
            vaa_cache: VaaCache::default(),
        }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
pub async fn spawn(rpc_addr: String) -> Result<()> {
    let mut cfg = State::new();

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .route("/", get(rest::index))
        .route("/live", get(rest::live))
        .route("/latest_vaas", get(rest::latest_vaas))
        .with_state(cfg.clone());

    // Listen in the background for new VAA's from the Wormhole RPC.
    tokio::spawn(async move {
        loop {
            if let Ok(observation) = OBSERVATIONS.1.lock().unwrap().recv() {
                let vaa = Vaa { data: observation };

                // Add the VAA to the cache.
                //
                // TODO: We haven't deserialized the VAA yet, so we don't know the Price ID. We
                // should this but for this PR we just use a placeholder.
                cfg.vaa_cache.add("UnknownID".to_string(), 0, vaa).unwrap();
            }
        }
    });

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::bind(&rpc_addr.parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
