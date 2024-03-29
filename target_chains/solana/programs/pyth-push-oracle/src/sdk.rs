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
    pyth_solana_receiver::sdk::{
        get_config_address,
        get_treasury_address,
    },
    pythnet_sdk::{
        messages::FeedId,
        wire::v1::MerklePriceUpdate,
    },
    solana_program::instruction::Instruction,
};

pub fn get_price_feed_address(instance_id: u8, feed_id: FeedId) -> Pubkey {
    Pubkey::find_program_address(&[&[instance_id], feed_id.as_ref()], &ID).0
}

impl accounts::UpdatePriceFeed {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        instance_id: u8,
        feed_id: FeedId,
        treasury_id: u8,
    ) -> Self {
        accounts::UpdatePriceFeed {
            payer,
            encoded_vaa,
            config: get_config_address(),
            treasury: get_treasury_address(treasury_id),
            price_feed_account: get_price_feed_address(instance_id, feed_id),
            pyth_solana_receiver: pyth_solana_receiver::ID,
            system_program: system_program::ID,
        }
    }
}

impl instruction::UpdatePriceFeed {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        instance_id: u8,
        feed_id: FeedId,
        treasury_id: u8,
        merkle_price_update: MerklePriceUpdate,
    ) -> Instruction {
        let update_price_feed_accounts = accounts::UpdatePriceFeed::populate(
            payer,
            encoded_vaa,
            instance_id,
            feed_id,
            treasury_id,
        )
        .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   update_price_feed_accounts,
            data:       instruction::UpdatePriceFeed {
                params: PostUpdateParams {
                    merkle_price_update,
                    treasury_id,
                },
                instance_id: 0,
                feed_id,
            }
            .data(),
        }
    }
}
