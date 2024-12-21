// We can't do much about the size of `anchor_lang::error::Error`.
#![allow(clippy::result_large_err)]

use {
    anchor_lang::{declare_id, prelude::*},
    borsh::{BorshDeserialize, BorshSerialize},
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    solana_program::{pubkey, pubkey::Pubkey},
};

pub mod config;
pub mod cpi;
pub mod error;
pub mod pda;
pub mod price_update;
pub mod program;

declare_id!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");

#[derive(Debug, BorshSerialize, BorshDeserialize, Clone)]
pub struct PostUpdateParams {
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id: u8,
}

#[derive(Debug, BorshSerialize, BorshDeserialize, Clone)]
pub struct PostUpdateAtomicParams {
    pub vaa: Vec<u8>,
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id: u8,
}

#[derive(Debug, BorshSerialize, BorshDeserialize, Clone)]
pub struct PostTwapUpdateParams {
    pub start_merkle_price_update: MerklePriceUpdate,
    pub end_merkle_price_update: MerklePriceUpdate,
    pub treasury_id: u8,
}
