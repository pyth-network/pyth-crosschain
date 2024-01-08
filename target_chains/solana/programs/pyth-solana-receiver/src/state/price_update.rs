use {
    anchor_lang::prelude::{
        borsh::BorshSchema,
        *,
    },
    pythnet_sdk::messages::PriceFeedMessage,
    solana_program::pubkey::Pubkey,
};


/**
 * This enum represents how many guardian signatures were checked for a Pythnet price update
 * If full, guardian quorum has been attained
 * If partial, it is at least config.minimum signatures, but in the case config.minimum_signatures changes in the future we also include the number of signatures */
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, BorshSchema)]
pub enum VerificationLevel {
    Partial(u8),
    Full,
}
#[account]
#[derive(BorshSchema)]
pub struct PriceUpdateV1 {
    pub write_authority:    Pubkey, // This write authority can close this account
    pub verification_level: VerificationLevel, // Whether all the guardian signatures have been checked, and if not, how many have been checked
    pub price_message:      PriceFeedMessage,
}

impl PriceUpdateV1 {
    pub const LEN: usize = 8 + 32 + 2 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
}

#[cfg(test)]
pub mod tests {
    use {
        crate::state::price_update::PriceUpdateV1,
        anchor_lang::Discriminator,
        solana_program::borsh0_10,
    };

    #[test]
    fn check_size() {
        assert!(
            PriceUpdateV1::discriminator().len() + borsh0_10::get_packed_len::<PriceUpdateV1>()
                == PriceUpdateV1::LEN
        );
    }
}
