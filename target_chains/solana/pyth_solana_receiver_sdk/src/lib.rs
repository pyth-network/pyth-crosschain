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

declare_id!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");

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
