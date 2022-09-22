#![feature(adt_const_params)]
pub mod attest;
pub mod config;
pub mod initialize;
pub mod message;
pub mod migrate;
pub mod set_config;
pub mod set_is_active;

use solitaire::solitaire;

pub use attest::{
    attest,
    Attest,
    AttestData,
};
pub use config::Pyth2WormholeConfig;
pub use initialize::{
    initialize,
    Initialize,
};
pub use migrate::{
    migrate,
    Migrate,
};
pub use set_config::{
    set_config,
    SetConfig,
};

pub use set_is_active::{
    set_is_active,
    SetIsActive,
};

pub use pyth_client;

solitaire! {
    Attest => attest,
    Initialize => initialize,
    SetConfig => set_config,
    Migrate => migrate,
    SetIsActive => set_is_active
}
