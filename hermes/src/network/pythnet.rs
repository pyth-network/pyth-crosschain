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
    anyhow::Result,
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
};

pub async fn spawn(pythnet_ws_endpoint: String, store: Store) -> Result<()> {
    let client = PubsubClient::new(pythnet_ws_endpoint.as_ref()).await?;

    let config = RpcProgramAccountsConfig {
        account_config: RpcAccountInfoConfig {
            commitment: Some(CommitmentConfig::confirmed()),
            encoding: Some(UiAccountEncoding::Base64Zstd),
            ..Default::default()
        },
        filters: Some(vec![RpcFilterType::Memcmp(Memcmp {
            offset:   0,
            bytes:    MemcmpEncodedBytes::Bytes(b"PAS1".to_vec()),
            encoding: None,
        })]),
        with_context: Some(true),
        ..Default::default()
    };

    let (mut notif, _unsub) = client
        .program_subscribe(&system_program::id(), Some(config))
        .await?;

    loop {
        let update = notif.next().await;
        log::debug!("Received Pythnet update: {:?}", update);

        if let Some(update) = update {
            let account: Account = update.value.account.decode().unwrap();
            log::debug!("Received Accumulator update: {:?}", account);

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
                        store
                            .store_update(Update::AccumulatorMessages(accumulator_messages))
                            .await?;
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
    }
}
