use {
    anchor_lang::{
        declare_id,
        prelude::*,
    },
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    solana_program::{
        pubkey,
        pubkey::Pubkey,
    },
};

pub mod config;
pub mod cpi;
pub mod error;
pub mod pda;
pub mod price_update;
pub mod program;

declare_id!("G6EoTTTgpkNBtVXo96EQp2m6uwwVh2Kt6YidjkmQqoha");

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("Bt56KjMCV2Ao7DCCffQ7RqGPt6E2zVRoS32hgzkEfEyZ");

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
