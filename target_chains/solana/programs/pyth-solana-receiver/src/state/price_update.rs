use {
    anchor_lang::prelude::*,
    pythnet_sdk::messages::PriceFeedMessage,
    solana_program::pubkey::Pubkey,
};

#[account]
pub struct PriceUpdateV1 {
    pub write_authority:     Pubkey, // This write authority can close this account
    pub verified_signatures: u8, // The number of wormhole signatures that were verified by the wormhole receiver
    pub price_message:       PriceFeedMessage,
}

impl PriceUpdateV1 {
    pub const LEN: usize = 8 + 32 + 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
}
