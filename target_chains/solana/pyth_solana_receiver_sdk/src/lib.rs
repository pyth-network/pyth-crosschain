use {
    anchor_lang::declare_id,
    solana_program::{
        pubkey,
        pubkey::Pubkey,
    },
};

pub mod config;
pub mod cpi;
pub mod error;
pub mod params;
pub mod pda;
pub mod price_update;
pub mod program;

declare_id!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");
