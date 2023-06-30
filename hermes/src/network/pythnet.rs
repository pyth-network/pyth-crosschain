//! This module connects to the Pythnet RPC server and listens for accumulator
//! updates. It then sends the updates to the store module for processing and
//! storage.

use {
    crate::store::{
        types::{
            AccumulatorMessages,
            Update,
        },
        wormhole::{
            BridgeData,
            GuardianSet,
            GuardianSetData,
        },
        Store,
    },
    anyhow::{
        anyhow,
        Result,
    },
    borsh::BorshDeserialize,
    futures::stream::StreamExt,
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
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
        system_program,
    },
    std::{
        sync::Arc,
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

pub async fn run(store: Arc<Store>, pythnet_ws_endpoint: String) -> Result<!> {
    let client = PubsubClient::new(pythnet_ws_endpoint.as_ref()).await?;

    let config = RpcProgramAccountsConfig {
        account_config: RpcAccountInfoConfig {
            commitment: Some(CommitmentConfig::confirmed()),
            encoding: Some(UiAccountEncoding::Base64Zstd),
            ..Default::default()
        },
        filters:        Some(vec![RpcFilterType::Memcmp(Memcmp {
            offset:   0,
            bytes:    MemcmpEncodedBytes::Bytes(b"PAS1".to_vec()),
            encoding: None,
        })]),
        with_context:   Some(true),
    };

    // Listen for all PythNet accounts, we will filter down to the Accumulator related accounts.
    let (mut notif, _unsub) = client
        .program_subscribe(&system_program::id(), Some(config))
        .await?;

    loop {
        match notif.next().await {
            Some(update) => {
                let account: Account = match update.value.account.decode() {
                    Some(account) => account,
                    None => {
                        log::error!("Failed to decode account from update: {:?}", update);
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
                                if let Err(err) = store
                                    .store_update(Update::AccumulatorMessages(accumulator_messages))
                                    .await
                                {
                                    log::error!("Failed to store accumulator messages: {:?}", err);
                                }
                            });
                        } else {
                            log::error!(
                                "Failed to verify the messages public key: {:?} != {:?}",
                                candidate,
                                update.value.pubkey
                            );
                        }
                    }

                    Err(err) => {
                        log::error!("Failed to parse AccumulatorMessages: {:?}", err);
                    }
                };
            }
            None => {
                return Err(anyhow!("Pythnet network listener terminated"));
            }
        }
    }
}

/// Fetch existing GuardianSet accounts from Wormhole.
///
/// This method performs the necessary work to pull down the bridge state and associated guardian
/// sets from a deployed Wormhole contract. Note that we only fetch the last two accounts due to
/// the fact that during a Wormhole upgrade, there will only be messages produces from those two.
async fn fetch_existing_guardian_sets(
    store: Arc<Store>,
    pythnet_http_endpoint: String,
    wormhole_contract_addr: Pubkey,
) -> Result<()> {
    let client = RpcClient::new(pythnet_http_endpoint.to_string());
    let bridge = fetch_bridge_data(&client, &wormhole_contract_addr).await?;

    // Fetch the current GuardianSet we know is valid for signing.
    let current =
        fetch_guardian_set(&client, wormhole_contract_addr, bridge.guardian_set_index).await?;

    log::info!(
        "Retrieved Current GuardianSet ({}): {}",
        bridge.guardian_set_index,
        current
    );

    store
        .update_guardian_set(bridge.guardian_set_index, current)
        .await;

    // If there are more than one guardian set, we want to fetch the previous one as well as it
    // may still be in transition phase if a guardian upgrade has just occurred.
    if bridge.guardian_set_index >= 1 {
        let previous = fetch_guardian_set(
            &client,
            wormhole_contract_addr,
            bridge.guardian_set_index - 1,
        )
        .await?;

        log::info!(
            "Retrieved Previous GuardianSet ({}): {}",
            bridge.guardian_set_index - 1,
            previous
        );

        store
            .update_guardian_set(bridge.guardian_set_index - 1, previous)
            .await;
    }

    Ok(())
}


pub async fn spawn(
    store: Arc<Store>,
    pythnet_ws_endpoint: String,
    pythnet_http_endpoint: String,
    wormhole_contract_addr: Pubkey,
) -> Result<()> {
    fetch_existing_guardian_sets(
        store.clone(),
        pythnet_http_endpoint.clone(),
        wormhole_contract_addr,
    )
    .await?;

    {
        let store = store.clone();
        let pythnet_ws_endpoint = pythnet_ws_endpoint.clone();
        tokio::spawn(async move {
            loop {
                let current_time = Instant::now();

                if let Err(ref e) = run(store.clone(), pythnet_ws_endpoint.clone()).await {
                    log::error!("Error in Pythnet network listener: {:?}", e);
                }

                if current_time.elapsed() < Duration::from_secs(30) {
                    log::error!(
                        "Pythnet network listener is restarting too quickly. Sleeping for 1s"
                    );
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        });
    }

    {
        let store = store.clone();
        let pythnet_http_endpoint = pythnet_http_endpoint.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;

                match fetch_existing_guardian_sets(
                    store.clone(),
                    pythnet_http_endpoint.clone(),
                    wormhole_contract_addr,
                )
                .await
                {
                    Ok(_) => {}
                    Err(err) => {
                        log::error!("Failed to poll for new guardian sets: {:?}", err);
                    }
                }
            }
        });
    }

    Ok(())
}
