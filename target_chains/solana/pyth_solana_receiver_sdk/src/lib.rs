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

pub const PYTH_PUSH_ORACLE_ID: Pubkey = pubkey!("F9SP6tBXw9Af7BYauo7Y2R5Es2mpv8FP5aNCXMihp6Za");
