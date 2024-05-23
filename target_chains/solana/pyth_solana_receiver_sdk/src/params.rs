use {
    anchor_lang::prelude::*,
    pythnet_sdk::wire::v1::MerklePriceUpdate,
};


#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PostUpdateAtomicParams {
    pub vaa:                 Vec<u8>,
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id:         u8,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PostUpdateParams {
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id:         u8,
}
