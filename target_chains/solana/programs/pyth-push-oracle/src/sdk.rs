use {
    crate::{
        accounts,
        instruction,
        PostUpdateParams,
        ID,
    },
    anchor_lang::{
        prelude::*,
        system_program,
        InstructionData,
    },
    pyth_solana_receiver_sdk::pda::{
        get_config_address,
        get_treasury_address,
    },
    pythnet_sdk::{
        messages::FeedId,
        wire::v1::MerklePriceUpdate,
    },
    solana_program::instruction::Instruction,
};

pub fn get_price_feed_address(shard_id: u16, feed_id: FeedId) -> Pubkey {
    Pubkey::find_program_address(&[&shard_id.to_le_bytes(), feed_id.as_ref()], &ID).0
}

impl accounts::InitPriceFeed {
    pub fn populate(
        payer: Pubkey,
        shard_id: u16,
        feed_id: FeedId,
    ) -> Self {
        accounts::InitPriceFeed {
            payer,
            price_feed_account: get_price_feed_address(shard_id, feed_id),
            system_program: system_program::ID,
            pyth_solana_receiver: pyth_solana_receiver_sdk::ID,
        }
    }
}

impl instruction::InitPriceFeed {
    pub fn populate(
        payer: Pubkey,
        shard_id: u16,
        feed_id: FeedId,
    ) -> Instruction {
        let init_price_feed_accounts =
            accounts::InitPriceFeed::populate(payer, shard_id, feed_id)
                .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   init_price_feed_accounts,
            data:       instruction::InitPriceFeed {
                shard_id,
                feed_id,
            }
                .data(),
        }
    }
}

impl accounts::UpdatePriceFeed {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        shard_id: u16,
        feed_id: FeedId,
    ) -> Self {
        accounts::UpdatePriceFeed {
            payer,
            encoded_vaa,
            price_feed_account: get_price_feed_address(shard_id, feed_id),
            pyth_solana_receiver: pyth_solana_receiver_sdk::ID,
            system_program: system_program::ID,
        }
    }
}

impl instruction::UpdatePriceFeed {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        shard_id: u16,
        feed_id: FeedId,
        merkle_price_update: MerklePriceUpdate,
    ) -> Instruction {
        let update_price_feed_accounts =
            accounts::UpdatePriceFeed::populate(payer, encoded_vaa, shard_id, feed_id)
                .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   update_price_feed_accounts,
            data:       instruction::UpdatePriceFeed {
                params: PostUpdateParams {
                    merkle_price_update,
                    treasury_id: 0,
                },
                shard_id,
                feed_id,
            }
            .data(),
        }
    }
}
