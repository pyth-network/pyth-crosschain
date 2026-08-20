//! **ATTENTION INTEGRATORS!** Core Bridge Program developer kit. It is recommended to use
//! [sdk::cpi](crate::sdk::cpi) for invoking Core Bridge instructions as opposed to the
//! code-generated Anchor CPI (found in [cpi](crate::cpi)).
//! CPI builders. Methods useful for interacting with the Core Bridge program from another program.

#[doc(inline)]
pub use wormhole_raw_vaas::{Header, Payload, Vaa};

/// Sub-module for System program interaction.
#[cfg(feature = "cpi")]
pub mod system_program {
    #[doc(inline)]
    pub use crate::utils::cpi::{create_account_safe, CreateAccountSafe};
}

#[doc(inline)]
pub use crate::{
    constants::{PROGRAM_EMITTER_SEED_PREFIX, SOLANA_CHAIN},
    id,
    processor::WriteEncodedVaaArgs,
    state,
    types::*,
    utils::quorum,
    utils::vaa::{EmitterInfo, VaaAccount, VAA_START},
};
#[doc(inline)]
#[cfg(feature = "cpi")]
pub use crate::utils::vaa::{claim_vaa, ClaimVaa};

pub mod io {
    pub use wormhole_io::{Readable, TypePrefixedPayload, Writeable};
}

pub mod legacy {
    pub use crate::legacy::utils::{
        AccountVariant, LegacyAccount, LegacyAnchorized, ProcessLegacyInstruction,
    };
}

/// Wormhole Core Bridge Program.
pub type CoreBridge = crate::program::WormholeCoreBridgeSolana;
