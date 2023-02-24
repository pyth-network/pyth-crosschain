#![allow(incomplete_features)]
#![feature(adt_const_params)]
pub mod attest;
pub mod attestation_state;
pub mod config;
pub mod error;
pub mod initialize;
pub mod message;
pub mod migrate;
pub mod set_config;
pub mod set_is_active;

use solitaire::solitaire;
pub use {
    attest::{
        attest,
        Attest,
        AttestData,
    },
    config::Pyth2WormholeConfig,
    initialize::{
        initialize,
        Initialize,
    },
    migrate::{
        migrate,
        Migrate,
    },
    pyth_client,
    set_config::{
        set_config,
        SetConfig,
    },
    set_is_active::{
        set_is_active,
        SetIsActive,
    },
};

solitaire! {
    Attest => attest,
    Initialize => initialize,
    SetConfig => set_config,
    Migrate => migrate,
    SetIsActive => set_is_active
}
