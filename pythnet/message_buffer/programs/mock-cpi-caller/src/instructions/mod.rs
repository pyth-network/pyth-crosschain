use anchor_lang::solana_program::hash::hashv;
pub use {add_price::*, cpi_max_test::*, update_price::*};

mod add_price;
mod cpi_max_test;
mod update_price;

/// Generate discriminator to be able to call anchor program's ix
/// * `namespace` - "global" for instructions
/// * `name` - name of ix to call CASE-SENSITIVE
///
/// Note: this could probably be converted into a constant hash value
/// since it will always be the same.
pub fn sighash(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{namespace}:{name}");

    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hashv(&[preimage.as_bytes()]).to_bytes()[..8]);
    sighash
}

pub const ACCUMULATOR_UPDATER_IX_NAME: &str = "put_all";
pub const UPD_PRICE_WRITE: &str = "upd_price_write";
