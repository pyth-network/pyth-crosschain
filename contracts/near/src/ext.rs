//! This module defines external contract API's that are used by the contract. This includes
//! Wormhole and perhaps any ancillary Pyth contracts.

use near_sdk::ext_contract;

/// Defines the external contract API we care about for interacting with Wormhole. Note that
/// Wormhole on NEAR passes VAA's as hex encoded strings so that the explorer can display them in a
/// clean way. This may require juggling between Vec<u8> and HexString.
#[ext_contract(ext_wormhole)]
pub trait Wormhole {
    /// Returns the Governance Index of the current GuardianSet only if the VAA verifies.
    fn verify_vaa(&self, vaa: String) -> u32;
}
