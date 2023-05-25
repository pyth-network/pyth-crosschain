//! This module connects to the Pythnet RPC server and listens for accumulator
//! updates. It then sends the updates to the store module for processing and
//! storage.

use {
    crate::store::{
        types::{
            AccumulatorMessages,
            Update,
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
        nonblocking::pubsub_client::PubsubClient,
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


pub async fn spawn(store: Arc<Store>, pythnet_ws_endpoint: String) -> Result<()> {
    tokio::spawn(async move {
        loop {
            let current_time = Instant::now();

            if let Err(ref e) = run(store.clone(), pythnet_ws_endpoint.clone()).await {
                log::error!("Error in Pythnet network listener: {:?}", e);
            }

            if current_time.elapsed() < Duration::from_secs(30) {
                log::error!("Pythnet network listener is restarting too quickly. Sleeping for 1s");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    });

    Ok(())
}
