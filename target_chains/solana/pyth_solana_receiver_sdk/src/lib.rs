use {
    anchor_lang::declare_id,
    solana_program::{
        pubkey,
        pubkey::Pubkey,
    },
};

pub mod config;
pub mod error;
pub mod price_update;

declare_id!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("3a8iuFcGaMHFTX8sagDx55nPWp14fHxzWUbn2Mr4E8NR");
