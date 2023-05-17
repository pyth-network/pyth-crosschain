//! This module connects to the Pythnet RPC server and listens for accumulator
//! updates. It then sends the updates to the store module for processing and
//! storage.

use {
    crate::store::{
        types::{
            AccumulatorMessages,
            RawMessage,
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
    },
    solana_sdk::{
        account::Account,
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
        system_program,
    },
    std::ops::Rem,
};

const RING_SIZE: u32 = 10_000;

pub async fn spawn(pythnet_ws_endpoint: String, store: Store) -> Result<()> {
    let client = PubsubClient::new(pythnet_ws_endpoint.as_ref()).await?;

    let config = RpcProgramAccountsConfig {
        account_config: RpcAccountInfoConfig {
            commitment: Some(CommitmentConfig::confirmed()),
            encoding: Some(UiAccountEncoding::Base64Zstd),
            ..Default::default()
        },
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
            // Check whether this account matches the state for this slot
            // FIXME this is hardcoded for localnet, we need to remove it from the code
            let pyth = Pubkey::try_from("7th6GdMuo4u1zNLzFAyMY6psunHNsGjPjo8hXvcTgKei").unwrap();

            let accumulator_slot = update.context.slot - 1;

            // Apparently we get the update for the previous slot, so we need to subtract 1
            let ring_index = accumulator_slot.rem(RING_SIZE as u64) as u32;

            let (candidate, _) = Pubkey::find_program_address(
                &[
                    b"AccumulatorState",
                    &pyth.to_bytes(),
                    &ring_index.to_be_bytes(),
                ],
                &system_program::id(),
            );

            if candidate.to_string() != update.value.pubkey {
                continue;
            }

            let account: Account = update.value.account.decode().unwrap();
            log::debug!("Received Accumulator update: {:?}", account);
            let accumulator_messages = AccumulatorMessages {
                slot:     accumulator_slot,
                messages: Vec::<RawMessage>::try_from_slice(account.data.as_ref())?,
            };

            store
                .store_update(Update::AccumulatorMessages(accumulator_messages))
                .await?;
        }
    }
}
