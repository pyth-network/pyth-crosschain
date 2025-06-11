//! This module connects to the Pythnet RPC server and listens for accumulator
//! updates. It then sends the updates to the store module for processing and
//! storage. It also periodically fetches and stores the latest price feeds metadata.

use {
    crate::{
        api::types::{PriceFeedMetadata, RpcPriceIdentifier},
        config::RunOptions,
        network::wormhole::{BridgeData, GuardianSet, GuardianSetData},
        state::{
            aggregate::{AccumulatorMessages, Aggregates, Update},
            price_feeds_metadata::{PriceFeedMeta, DEFAULT_PRICE_FEEDS_CACHE_UPDATE_INTERVAL},
            wormhole::Wormhole,
        },
    },
    anyhow::{anyhow, bail, Result},
    borsh::{BorshDeserialize, BorshSerialize},
    futures::{stream::StreamExt, SinkExt},
    pyth_sdk::PriceIdentifier,
    pyth_sdk_solana::state::load_product_account,
    solana_account_decoder::UiAccountEncoding,
    solana_client::{
        nonblocking::{pubsub_client::PubsubClient, rpc_client::RpcClient},
        rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig},
        rpc_filter::{Memcmp, MemcmpEncodedBytes, RpcFilterType},
    },
    solana_sdk::{
        account::Account, commitment_config::CommitmentConfig, pubkey::Pubkey, system_program,
    },
    std::{collections::BTreeMap, sync::Arc, time::Duration},
    tokio::time::Instant,
    tokio_tungstenite::{
        connect_async,
        tungstenite::{client::IntoClientRequest, Message},
    },
};

/// Using a Solana RPC endpoint, fetches the target GuardianSet based on an index.
async fn fetch_guardian_set(
    client: &RpcClient,
    wormhole_contract_addr: Pubkey,
    guardian_set_index: u32,
) -> Result<GuardianSet> {
    // Fetch GuardianSet account from Solana RPC.
    let guardian_set = client
        .get_account_with_commitment(
            &Pubkey::find_program_address(
                &[b"GuardianSet", &guardian_set_index.to_be_bytes()],
                &wormhole_contract_addr,
            )
            .0,
            CommitmentConfig::confirmed(),
        )
        .await;

    let guardian_set = match guardian_set {
        Ok(response) => match response.value {
            Some(guardian_set) => guardian_set,
            None => return Err(anyhow!("GuardianSet account not found")),
        },
        Err(err) => return Err(anyhow!("Failed to fetch GuardianSet account: {}", err)),
    };

    // Deserialize the result into a GuardianSet, this is where we can
    // extract the new Signer set.
    match GuardianSetData::deserialize(&mut guardian_set.data.as_ref()) {
        Ok(guardian_set) => Ok(GuardianSet {
            keys: guardian_set.keys,
        }),

        Err(err) => Err(anyhow!(
            "Failed to deserialize GuardianSet account: {}",
            err
        )),
    }
}

/// Using a Solana RPC endpoint, fetches the target Bridge state.
///
/// You can use this function to get access to metadata about the Wormhole state by reading the
/// Bridge account. We currently use this to find the active guardian set index.
async fn fetch_bridge_data(
    client: &RpcClient,
    wormhole_contract_addr: &Pubkey,
) -> Result<BridgeData> {
    // Fetch Bridge account from Solana RPC.
    let bridge = client
        .get_account_with_commitment(
            &Pubkey::find_program_address(&[b"Bridge"], wormhole_contract_addr).0,
            CommitmentConfig::confirmed(),
        )
        .await;

    let bridge = match bridge {
        Ok(response) => match response.value {
            Some(bridge) => bridge,
            None => return Err(anyhow!("Bridge account not found")),
        },
        Err(err) => return Err(anyhow!("Failed to fetch Bridge account: {}", err)),
    };

    // Deserialize the result into a BridgeData, this is where we can
    // extract the new Signer set.
    match BridgeData::deserialize(&mut bridge.data.as_ref()) {
        Ok(bridge) => Ok(bridge),
        Err(err) => Err(anyhow!("Failed to deserialize Bridge account: {}", err)),
    }
}

pub async fn run<S>(store: Arc<S>, pythnet_ws_endpoint: String) -> Result<()>
where
    S: Aggregates,
    S: Wormhole,
    S: Send + Sync + 'static,
{
    let client = PubsubClient::new(pythnet_ws_endpoint.as_ref()).await?;

    let config = RpcProgramAccountsConfig {
        account_config: RpcAccountInfoConfig {
            commitment: Some(CommitmentConfig::confirmed()),
            encoding: Some(UiAccountEncoding::Base64Zstd),
            ..Default::default()
        },
        filters: Some(vec![RpcFilterType::Memcmp(Memcmp::new(
            0,                                           // offset
            MemcmpEncodedBytes::Bytes(b"PAS1".to_vec()), // bytes
        ))]),
        with_context: Some(true),
    };

    // Listen for all PythNet accounts, we will filter down to the Accumulator related accounts.
    let (mut notif, _unsub) = client
        .program_subscribe(&system_program::id(), Some(config))
        .await?;

    while let Some(update) = notif.next().await {
        let account: Account = match update.value.account.decode() {
            Some(account) => account,
            None => {
                tracing::error!(?update, "Failed to decode account from update.");
                continue;
            }
        };

        let accumulator_messages = AccumulatorMessages::try_from_slice(&account.data);
        match accumulator_messages {
            Ok(accumulator_messages) => {
                let (candidate, _) = Pubkey::find_program_address(
                    &[
                        b"AccumulatorState",
                        &accumulator_messages.ring_index().to_be_bytes(),
                    ],
                    &system_program::id(),
                );

                if candidate.to_string() == update.value.pubkey {
                    let store = store.clone();
                    tokio::spawn(async move {
                        if let Err(err) = Aggregates::store_update(
                            &*store,
                            Update::AccumulatorMessages(accumulator_messages),
                        )
                        .await
                        {
                            tracing::error!(error = ?err, "Failed to store accumulator messages.");
                        }
                    });
                } else {
                    tracing::error!(
                        ?candidate,
                        ?update.value.pubkey,
                        "Failed to verify message public keys.",
                    );
                }
            }

            Err(err) => {
                tracing::error!(error = ?err, "Failed to parse AccumulatorMessages.");
            }
        };
    }

    Err(anyhow!("Pythnet network listener connection terminated"))
}

/// Fetch existing GuardianSet accounts from Wormhole.
///
/// This method performs the necessary work to pull down the bridge state and associated guardian
/// sets from a deployed Wormhole contract. Note that we only fetch the last two accounts due to
/// the fact that during a Wormhole upgrade, there will only be messages produces from those two.
async fn fetch_existing_guardian_sets<S>(
    state: Arc<S>,
    pythnet_http_endpoint: String,
    wormhole_contract_addr: Pubkey,
) -> Result<()>
where
    S: Wormhole,
    S: Send + Sync + 'static,
{
    let client = RpcClient::new(pythnet_http_endpoint.to_string());
    let bridge = fetch_bridge_data(&client, &wormhole_contract_addr).await?;

    // Fetch the current GuardianSet we know is valid for signing.
    let current =
        fetch_guardian_set(&client, wormhole_contract_addr, bridge.guardian_set_index).await?;

    tracing::info!(
        guardian_set_index = bridge.guardian_set_index,
        %current,
        "Retrieved Current GuardianSet.",
    );

    Wormhole::update_guardian_set(&*state, bridge.guardian_set_index, current).await;

    // If there are more than one guardian set, we want to fetch the previous one as well as it
    // may still be in transition phase if a guardian upgrade has just occurred.
    if bridge.guardian_set_index >= 1 {
        let previous = fetch_guardian_set(
            &client,
            wormhole_contract_addr,
            bridge.guardian_set_index - 1,
        )
        .await?;

        tracing::info!(
            previous_guardian_set_index = bridge.guardian_set_index - 1,
            %previous,
            "Retrieved Previous GuardianSet.",
        );

        Wormhole::update_guardian_set(&*state, bridge.guardian_set_index - 1, previous).await;
    }

    Ok(())
}

pub async fn fetch_and_store_price_feeds_metadata<S>(
    state: &S,
    oracle_program_address: &Pubkey,
    rpc_client: &RpcClient,
) -> Result<Vec<PriceFeedMetadata>>
where
    S: PriceFeedMeta + Aggregates,
{
    let price_feeds_metadata =
        fetch_price_feeds_metadata(oracle_program_address, rpc_client).await?;

    // Wait for the crosschain price feed ids to be available in the state
    // This is to prune the price feeds that are not available crosschain yet (i.e. they are coming soon)
    let mut all_ids;
    let mut retry_count = 0;
    loop {
        all_ids = Aggregates::get_price_feed_ids(state).await;
        if !all_ids.is_empty() {
            break;
        }
        tracing::info!("Waiting for price feed ids...");
        tokio::time::sleep(Duration::from_secs(retry_count + 1)).await;
        retry_count += 1;
        if retry_count > 10 {
            bail!("Failed to fetch price feed ids after 10 retries");
        }
    }

    // Filter price_feeds_metadata to only include entries with IDs in all_ids
    let filtered_metadata: Vec<PriceFeedMetadata> = price_feeds_metadata
        .into_iter()
        .filter(|metadata| all_ids.contains(&PriceIdentifier::from(metadata.id)))
        .collect();

    state.store_price_feeds_metadata(&filtered_metadata).await?;
    Ok(filtered_metadata)
}

async fn fetch_price_feeds_metadata(
    oracle_program_address: &Pubkey,
    rpc_client: &RpcClient,
) -> Result<Vec<PriceFeedMetadata>> {
    let product_accounts = rpc_client
        .get_program_accounts_with_config(
            oracle_program_address,
            RpcProgramAccountsConfig {
                filters: Some(vec![RpcFilterType::Memcmp(Memcmp::new(
                    0, // offset
                    // Product account header: <magic:u32le:0xa1b2c3d4> <version:u32le:0x02> <account_type:u32le:0x02>
                    MemcmpEncodedBytes::Bytes(
                        b"\xd4\xc3\xb2\xa1\x02\x00\x00\x00\x02\x00\x00\x00".to_vec(),
                    ),
                ))]),
                account_config: RpcAccountInfoConfig {
                    encoding: Some(UiAccountEncoding::Base64Zstd),
                    commitment: Some(CommitmentConfig::confirmed()),
                    ..Default::default()
                },
                ..Default::default()
            },
        )
        .await?;

    let price_feeds_metadata: Vec<PriceFeedMetadata> = product_accounts
        .into_iter()
        .filter_map(
            |(pubkey, account)| match load_product_account(&account.data) {
                Ok(product_account) => {
                    if product_account.px_acc == Pubkey::default() {
                        return None;
                    }

                    let attributes = product_account
                        .iter()
                        .filter(|(key, _)| !key.is_empty())
                        .map(|(key, val)| (key.to_string(), val.to_string()))
                        .collect::<BTreeMap<String, String>>();

                    Some(PriceFeedMetadata {
                        id: RpcPriceIdentifier::new(product_account.px_acc.to_bytes()),
                        attributes,
                    })
                }
                Err(e) => {
                    tracing::warn!(error = ?e, pubkey = ?pubkey, "Error loading product account");
                    None
                }
            },
        )
        .collect();

    tracing::info!(
        len = price_feeds_metadata.len(),
        "Fetched price feeds metadata"
    );

    Ok(price_feeds_metadata)
}

#[tracing::instrument(skip(opts, state))]
pub async fn spawn<S>(opts: RunOptions, state: Arc<S>) -> Result<()>
where
    S: Wormhole,
    S: Send + Sync + 'static,
{
    tracing::info!(endpoint = opts.pythnet.ws_addr, "Started Pythnet Listener.");

    // Create RpcClient instance here
    let rpc_client = RpcClient::new(opts.pythnet.http_addr.clone());

    fetch_existing_guardian_sets(
        state.clone(),
        opts.pythnet.http_addr.clone(),
        opts.wormhole.contract_addr,
    )
    .await?;

    let task_listener = {
        let store = state.clone();
        let pythnet_ws_endpoint = opts.pythnet.ws_addr.clone();
        let mut exit = crate::EXIT.subscribe();
        tokio::spawn(async move {
            loop {
                let current_time = Instant::now();
                tokio::select! {
                    _ = exit.changed() => break,
                    Err(err) = run(store.clone(), pythnet_ws_endpoint.clone()) => {
                        tracing::error!(error = ?err, "Error in Pythnet network listener.");
                        if current_time.elapsed() < Duration::from_secs(30) {
                            tracing::error!("Pythnet listener restarting too quickly. Sleep 1s.");
                            tokio::time::sleep(Duration::from_secs(1)).await;
                        }
                    }
                }
            }
            tracing::info!("Shutting down Pythnet listener...");
        })
    };

    let task_guardian_watcher = {
        let store = state.clone();
        let pythnet_http_endpoint = opts.pythnet.http_addr.clone();
        let mut exit = crate::EXIT.subscribe();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = exit.changed() => break,
                    _ = tokio::time::sleep(Duration::from_secs(60)) => {
                        if let Err(err) = fetch_existing_guardian_sets(
                            store.clone(),
                            pythnet_http_endpoint.clone(),
                            opts.wormhole.contract_addr,
                        )
                        .await
                        {
                            tracing::error!(error = ?err, "Failed to poll for new guardian sets.")
                        }
                    }
                }
            }
            tracing::info!("Shutting down Pythnet guardian set poller...");
        })
    };

    let task_price_feeds_metadata_updater = {
        let price_feeds_state = state.clone();
        let mut exit = crate::EXIT.subscribe();
        tokio::spawn(async move {
            // Run fetch and store once before the loop
            tracing::info!("Fetching and storing price feeds metadata...");
            if let Err(e) = fetch_and_store_price_feeds_metadata(
                price_feeds_state.as_ref(),
                &opts.pythnet.oracle_program_addr,
                &rpc_client,
            )
            .await
            {
                tracing::error!(
                    "Error in initial fetching and storing price feeds metadata: {}",
                    e
                );
            }
            loop {
                tokio::select! {
                    _ = exit.changed() => break,
                    _ = tokio::time::sleep(Duration::from_secs(DEFAULT_PRICE_FEEDS_CACHE_UPDATE_INTERVAL)) => {
                        tracing::info!("Fetching and storing price feeds metadata...");
                        if let Err(e) = fetch_and_store_price_feeds_metadata(
                            price_feeds_state.as_ref(),
                            &opts.pythnet.oracle_program_addr,
                            &rpc_client,
                        )
                        .await
                        {
                            tracing::error!("Error in fetching and storing price feeds metadata: {}", e);
                        }
                    }
                }
            }
        })
    };

    let task_quorum_listener = match opts.pythnet.quorum_ws_addr {
        Some(pythnet_quorum_ws_addr) => {
            let store = state.clone();
            let mut exit = crate::EXIT.subscribe();
            tokio::spawn(async move {
                loop {
                    let current_time = Instant::now();
                    tokio::select! {
                        _ = exit.changed() => break,
                        Err(err) = run_quorom_listener(store.clone(), pythnet_quorum_ws_addr.clone()) => {
                            tracing::error!(error = ?err, "Error in Pythnet quorum network listener.");
                            if current_time.elapsed() < Duration::from_secs(30) {
                                tracing::error!("Pythnet quorum listener restarting too quickly. Sleep 1s.");
                                tokio::time::sleep(Duration::from_secs(1)).await;
                            }
                        }
                    }
                }
                tracing::info!("Shutting down Pythnet quorum listener...");
            })
        }
        None => tokio::spawn(async {
            tracing::warn!(
                "Pythnet quorum websocket address not provided, skipping quorum listener."
            );
        }),
    };

    let _ = tokio::join!(
        task_listener,
        task_guardian_watcher,
        task_price_feeds_metadata_updater,
        task_quorum_listener,
    );
    Ok(())
}

const QUORUM_PING_INTERVAL: Duration = Duration::from_secs(10);

#[tracing::instrument(skip(state))]
async fn run_quorom_listener<S>(state: Arc<S>, pythnet_quorum_ws_endpoint: String) -> Result<()>
where
    S: Wormhole,
    S: Send + Sync + 'static,
{
    let mut ping_interval = tokio::time::interval(QUORUM_PING_INTERVAL);
    let mut responded_to_ping = true; // Start with a true to not close the connection immediately
    let request = pythnet_quorum_ws_endpoint.into_client_request()?;
    let (mut ws_stream, _) = connect_async(request).await?;

    loop {
        tokio::select! {
            message = ws_stream.next() => {
                let vaa_bytes = match message.ok_or_else(|| anyhow!("PythNet quorum stream terminated."))?? {
                    Message::Frame(_) => continue,
                    Message::Text(message) => {
                        match message.try_to_vec() {
                            Ok(bytes) => bytes,
                            Err(e) => {
                                tracing::error!(error = ?e, "Failed to convert PythNet quorum text message to bytes.");
                                continue;
                            }
                        }
                    },
                    Message::Binary(bytes) => bytes.to_vec(),
                    Message::Ping(_) => continue,
                    Message::Pong(_) => {
                        responded_to_ping = true;
                        continue;
                    }
                    Message::Close(_) => break,
                };
                tokio::spawn({
                    let state = state.clone();
                    async move {
                        if let Err(e) = state.process_message(vaa_bytes).await {
                            tracing::debug!(error = ?e, "Skipped VAA.");
                        }
                    }
                });
            },
            _  = ping_interval.tick() => {
                if !responded_to_ping {
                    return Err(anyhow!("PythNet quorum subscriber did not respond to ping. Closing connection."));
                }
                responded_to_ping = false; // Reset the flag for the next ping
                if let Err(e) = ws_stream.send(Message::Ping(vec![].into())).await {
                    tracing::error!(error = ?e, "Failed to send PythNet quorum ping message.");
                    return Err(anyhow!("Failed to send PythNet quorum ping message."));
                }
            },
        }
    }
    Err(anyhow!("Pyth quorum stream terminated."))
}
