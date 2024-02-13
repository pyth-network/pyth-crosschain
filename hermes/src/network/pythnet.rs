//! This module connects to the Pythnet RPC server and listens for accumulator
//! updates. It then sends the updates to the store module for processing and
//! storage. It also periodically fetches and stores the latest price feeds metadata.

use {
    crate::{
        aggregate::{
            AccumulatorMessages,
            Update,
        },
        api::types::PriceFeedMetadata,
        config::RunOptions,
        network::wormhole::{
            update_guardian_set,
            BridgeData,
            GuardianSet,
            GuardianSetData,
        },
        state::{
            store_price_feeds_metadata,
            State,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
    borsh::BorshDeserialize,
    futures::stream::StreamExt,
    pyth_sdk::PriceIdentifier,
    pyth_sdk_solana::state::{
        load_mapping_account,
        load_product_account,
    },
    solana_account_decoder::UiAccountEncoding,
    solana_client::{
        nonblocking::{
            pubsub_client::PubsubClient,
            rpc_client::RpcClient,
        },
        rpc_config::{
            RpcAccountInfoConfig,
            RpcProgramAccountsConfig,
        },
        rpc_filter::{
            Memcmp,
            MemcmpEncodedBytes,
            RpcFilterType,
        },
    },
    solana_sdk::{
        account::Account,
        bs58,
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
        system_program,
    },
    std::{
        collections::BTreeMap,
        sync::{
            atomic::Ordering,
            Arc,
        },
        time::Duration,
    },
    tokio::time::Instant,
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

pub async fn run(store: Arc<State>, pythnet_ws_endpoint: String) -> Result<()> {
    let client = PubsubClient::new(pythnet_ws_endpoint.as_ref()).await?;

    let config = RpcProgramAccountsConfig {
        account_config: RpcAccountInfoConfig {
            commitment: Some(CommitmentConfig::confirmed()),
            encoding: Some(UiAccountEncoding::Base64Zstd),
            ..Default::default()
        },
        filters:        Some(vec![RpcFilterType::Memcmp(Memcmp::new(
            0,                                           // offset
            MemcmpEncodedBytes::Bytes(b"PAS1".to_vec()), // bytes
        ))]),
        with_context:   Some(true),
    };

    // Listen for all PythNet accounts, we will filter down to the Accumulator related accounts.
    let (mut notif, _unsub) = client
        .program_subscribe(&system_program::id(), Some(config))
        .await?;

    while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
        match notif.next().await {
            Some(update) => {
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
                                if let Err(err) = crate::aggregate::store_update(
                                    &store,
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
            None => {
                return Err(anyhow!("Pythnet network listener terminated"));
            }
        }
    }

    Ok(())
}

/// Fetch existing GuardianSet accounts from Wormhole.
///
/// This method performs the necessary work to pull down the bridge state and associated guardian
/// sets from a deployed Wormhole contract. Note that we only fetch the last two accounts due to
/// the fact that during a Wormhole upgrade, there will only be messages produces from those two.
async fn fetch_existing_guardian_sets(
    state: Arc<State>,
    pythnet_http_endpoint: String,
    wormhole_contract_addr: Pubkey,
) -> Result<()> {
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

    update_guardian_set(&state, bridge.guardian_set_index, current).await;

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

        update_guardian_set(&state, bridge.guardian_set_index - 1, previous).await;
    }

    Ok(())
}

#[tracing::instrument(skip(opts, state))]
pub async fn spawn(opts: RunOptions, state: Arc<State>) -> Result<()> {
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
        tokio::spawn(async move {
            while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
                let current_time = Instant::now();

                if let Err(ref e) = run(store.clone(), pythnet_ws_endpoint.clone()).await {
                    tracing::error!(error = ?e, "Error in Pythnet network listener.");
                    if current_time.elapsed() < Duration::from_secs(30) {
                        tracing::error!("Pythnet listener restarting too quickly. Sleep 1s.");
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }

            tracing::info!("Shutting down Pythnet listener...");
        })
    };

    let task_guardian_watcher = {
        let store = state.clone();
        let pythnet_http_endpoint = opts.pythnet.http_addr.clone();
        tokio::spawn(async move {
            while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
                // Poll for new guardian sets every 60 seconds. We use a short wait time so we can
                // properly exit if a quit signal was received. This isn't a perfect solution, but
                // it's good enough for now.
                for _ in 0..60 {
                    if crate::SHOULD_EXIT.load(Ordering::Acquire) {
                        break;
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }

                match fetch_existing_guardian_sets(
                    store.clone(),
                    pythnet_http_endpoint.clone(),
                    opts.wormhole.contract_addr,
                )
                .await
                {
                    Ok(_) => {}
                    Err(err) => {
                        tracing::error!(error = ?err, "Failed to poll for new guardian sets.")
                    }
                }
            }

            tracing::info!("Shutting down Pythnet guardian set poller...");
        })
    };


    let task_price_feeds_metadata_updater = {
        let price_feeds_state = state.clone();
        let price_feeds_update_interval = opts.price_feeds_cache_update_interval;
        tokio::spawn(async move {
            while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
                tokio::time::sleep(Duration::from_secs(price_feeds_update_interval)).await;
                if crate::SHOULD_EXIT.load(Ordering::Acquire) {
                    break;
                }
                if let Err(e) =
                    fetch_and_store_price_feeds_metadata(price_feeds_state.as_ref(), &rpc_client)
                        .await
                {
                    tracing::error!("Error in fetching and storing price feeds metadata: {}", e);
                }
            }
        })
    };

    let _ = tokio::join!(
        task_listener,
        task_guardian_watcher,
        task_price_feeds_metadata_updater
    );
    Ok(())
}


pub async fn fetch_and_store_price_feeds_metadata(
    state: &State,
    rpc_client: &RpcClient,
) -> Result<Vec<PriceFeedMetadata>> {
    let price_feeds_metadata = get_price_feeds_metadata(&state, &rpc_client).await?;
    store_price_feeds_metadata(&state, &price_feeds_metadata).await?;
    Ok(price_feeds_metadata)
}

async fn get_price_feeds_metadata(
    state: &State,
    rpc_client: &RpcClient,
) -> Result<Vec<PriceFeedMetadata>> {
    let mut price_feeds_metadata = Vec::<PriceFeedMetadata>::new();
    let mapping_address = &state.mapping_address;
    let mapping_data = rpc_client.get_account_data(mapping_address).await?;
    let map_acct = load_mapping_account(&mapping_data)?;
    for prod_pkey in &map_acct.products {
        let prod_data = rpc_client.get_account_data(prod_pkey).await?;

        if *prod_pkey == Pubkey::default() {
            continue;
        }
        let prod_acct = load_product_account(&prod_data)?;

        let attributes = prod_acct
            .iter()
            .filter(|(key, _)| !key.is_empty())
            // Convert (&str, &str) to (String, String)
            .map(|(key, val)| (key.to_string(), val.to_string()))
            .collect::<BTreeMap<String, String>>();

        if prod_acct.px_acc != Pubkey::default() {
            let px_pkey = prod_acct.px_acc;

            // Convert px_pkey from base58 to hex
            let px_pkey_bytes = bs58::decode(&px_pkey.to_string()).into_vec()?;
            let px_pkey_array: [u8; 32] = px_pkey_bytes
                .try_into()
                .expect("Invalid length for PriceIdentifier");

            // Create PriceFeedMetadata
            let price_feed_metadata = PriceFeedMetadata {
                id: PriceIdentifier::new(px_pkey_array),
                attributes,
            };

            price_feeds_metadata.push(price_feed_metadata);
        }
    }
    Ok(price_feeds_metadata)
}
