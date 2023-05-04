use {
    crate::RawPubkey,
    borsh::BorshSerialize,
};
use {
    bytemuck::{
        try_from_bytes,
        Pod,
        Zeroable,
    },
    // solana_merkle_tree::MerkleTree,
    std::mem::size_of,
};

#[repr(C)]
#[derive(Copy, Clone, Zeroable, Pod, Default, BorshSerialize)]
pub struct AccountHeader {
    pub magic_number: u32,
    pub version:      u32,
    pub account_type: u32,
    pub size:         u32,
}

pub const PC_MAP_TABLE_SIZE: u32 = 640;
pub const PC_MAGIC: u32 = 2712847316;
pub const PC_VERSION: u32 = 2;

#[repr(C)]
#[derive(Copy, Clone)]
pub struct MappingAccount {
    pub header:               AccountHeader,
    pub number_of_products:   u32,
    pub unused_:              u32,
    pub next_mapping_account: RawPubkey,
    pub products_list:        [RawPubkey; PC_MAP_TABLE_SIZE as usize],
}

pub const PC_ACCTYPE_MAPPING: u32 = 1;
pub const PC_MAP_TABLE_T_PROD_OFFSET: size_t = 56;

impl PythAccount for MappingAccount {
    const ACCOUNT_TYPE: u32 = PC_ACCTYPE_MAPPING;
    /// Equal to the offset of `prod_` in `MappingAccount`, see the trait comment for more detail
    const INITIAL_SIZE: u32 = PC_MAP_TABLE_T_PROD_OFFSET as u32;
}

// Unsafe impl because product_list is of size 640 and there's no derived trait for this size
unsafe impl Pod for MappingAccount {
}

unsafe impl Zeroable for MappingAccount {
}

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
pub struct ProductAccount {
    pub header:              AccountHeader,
    pub first_price_account: RawPubkey,
}

pub const PC_ACCTYPE_PRODUCT: u32 = 2;
pub const PC_PROD_ACC_SIZE: u32 = 512;

impl PythAccount for ProductAccount {
    const ACCOUNT_TYPE: u32 = PC_ACCTYPE_PRODUCT;
    const INITIAL_SIZE: u32 = size_of::<ProductAccount>() as u32;
    const MINIMUM_SIZE: usize = PC_PROD_ACC_SIZE as usize;
}

#[repr(C)]
#[cfg_attr(not(test), derive(Copy, Clone, Pod, Zeroable))]
#[cfg_attr(test, derive(Copy, Clone, Pod, Zeroable, Default))]
pub struct PriceAccount {
    pub header:             AccountHeader,
    /// Type of the price account
    pub price_type:         u32,
    /// Exponent for the published prices
    pub exponent:           i32,
    /// Current number of authorized publishers
    pub num_:               u32,
    /// Number of valid quotes for the last aggregation
    pub num_qt_:            u32,
    /// Last slot with a succesful aggregation (status : TRADING)
    pub last_slot_:         u64,
    /// Second to last slot where aggregation was attempted
    pub valid_slot_:        u64,
    /// Ema for price
    pub twap_:              PriceEma,
    /// Ema for confidence
    pub twac_:              PriceEma,
    /// Last time aggregation was attempted
    pub timestamp_:         i64,
    /// Minimum valid publisher quotes for a succesful aggregation
    pub min_pub_:           u8,
    pub unused_1_:          i8,
    pub unused_2_:          i16,
    pub unused_3_:          i32,
    /// Corresponding product account
    pub product_account:    RawPubkey,
    /// Next price account in the list
    pub next_price_account: RawPubkey,
    /// Second to last slot where aggregation was succesful (i.e. status : TRADING)
    pub prev_slot_:         u64,
    /// Aggregate price at prev_slot_
    pub prev_price_:        i64,
    /// Confidence interval at prev_slot_
    pub prev_conf_:         u64,
    /// Timestamp of prev_slot_
    pub prev_timestamp_:    i64,
    /// Last attempted aggregate results
    pub agg_:               PriceInfo,
    /// Publishers' price components
    pub comp_:              [PriceComponent; PC_COMP_SIZE as usize],
}

pub const PC_COMP_SIZE: u32 = 32;

#[repr(C)]
// #[derive(Copy, Clone, Pod, Zeroable)]
#[cfg_attr(not(test), derive(Copy, Clone, Pod, Zeroable))]
#[cfg_attr(test, derive(Copy, Clone, Pod, Zeroable, Default))]
pub struct PriceComponent {
    pub pub_:    RawPubkey,
    pub agg_:    PriceInfo,
    pub latest_: PriceInfo,
}

#[repr(C)]
// #[derive(Debug, Copy, Clone, Pod, Zeroable)]
#[cfg_attr(not(test), derive(Copy, Clone, Pod, Zeroable))]
#[cfg_attr(test, derive(Copy, Clone, Pod, Zeroable, Default))]
pub struct PriceInfo {
    pub price_:           i64,
    pub conf_:            u64,
    pub status_:          u32,
    pub corp_act_status_: u32,
    pub pub_slot_:        u64,
}

#[repr(C)]
// #[derive(Debug, Copy, Clone, Pod, Zeroable)]
#[cfg_attr(not(test), derive(Copy, Clone, Pod, Zeroable))]
#[cfg_attr(test, derive(Copy, Clone, Pod, Zeroable, Default))]
pub struct PriceEma {
    pub val_:   i64,
    pub numer_: i64,
    pub denom_: i64,
}

pub const PC_ACCTYPE_PRICE: u32 = 3;

pub type size_t = ::std::os::raw::c_ulong;

pub const PC_PRICE_T_COMP_OFFSET: size_t = 240;

impl PythAccount for PriceAccount {
    const ACCOUNT_TYPE: u32 = PC_ACCTYPE_PRICE;
    /// Equal to the offset of `comp_` in `PriceAccount`, see the trait comment for more detail
    const INITIAL_SIZE: u32 = PC_PRICE_T_COMP_OFFSET as u32;
}

/// The PythAccount trait's purpose is to attach constants to the 3 types of accounts that Pyth has
/// (mapping, price, product). This allows less duplicated code, because now we can create generic
/// functions to perform common checks on the accounts and to load and initialize the accounts.
pub trait PythAccount: Pod {
    /// `ACCOUNT_TYPE` is just the account discriminator, it is different for mapping, product and
    /// price
    const ACCOUNT_TYPE: u32;

    /// `INITIAL_SIZE` is the value that the field `size_` will take when the account is first
    /// initialized this one is slightly tricky because for mapping (resp. price) `size_` won't
    /// include the unpopulated entries of `prod_` (resp. `comp_`). At the beginning there are 0
    /// products (resp. 0 components) therefore `INITIAL_SIZE` will be equal to the offset of
    /// `prod_` (resp. `comp_`)  Similarly the product account `INITIAL_SIZE` won't include any
    /// key values.
    const INITIAL_SIZE: u32;

    /// `minimum_size()` is the minimum size that the solana account holding the struct needs to
    /// have. `INITIAL_SIZE` <= `minimum_size()`
    const MINIMUM_SIZE: usize = size_of::<Self>();
}

/// Interpret the bytes in `data` as a value of type `T`
/// This will fail if :
/// - `data` is too short
/// - `data` is not aligned for T
pub fn load<T: Pod>(data: &[u8]) -> &T {
    try_from_bytes(data.get(0..size_of::<T>()).unwrap()).unwrap()
}

pub fn load_as_option<T: Pod>(data: &[u8]) -> Option<&T> {
    data.get(0..size_of::<T>())
        .map(|data| try_from_bytes(data).unwrap())
}

pub fn check<T: PythAccount>(account_data: &[u8]) -> bool {
    if account_data.len() < T::MINIMUM_SIZE {
        return false;
    }

    let account_header = load::<AccountHeader>(account_data);
    if account_header.magic_number != PC_MAGIC
        || account_header.version != PC_VERSION
        || account_header.account_type != T::ACCOUNT_TYPE
    {
        return false;
    }

    true
}

pub fn load_account<'a, T: Pod>(data: &'a [u8]) -> Option<&'a T> {
    // let data = account.try_borrow_mut_data()?;

    bytemuck::try_from_bytes(&data[0..size_of::<T>()]).ok()
}

pub fn load_checked<'a, T: PythAccount>(account_data: &'a [u8], _version: u32) -> Option<&'a T> {
    if !check::<T>(account_data) {
        return None;
    }

    load_account::<T>(account_data)
}

/// Precedes every message implementing the p2w serialization format
pub const PACC2W_MAGIC: &[u8] = b"acc";

/// Format version used and understood by this codebase
pub const P2W_FORMAT_VER_MAJOR: u16 = 3;

/// Starting with v3, format introduces a minor version to mark
/// forward-compatible iterations.
/// IMPORTANT: Remember to reset this to 0 whenever major version is
/// bumped.
/// Changelog:
/// * v3.1 - last_attested_publish_time field added
pub const P2W_FORMAT_VER_MINOR: u16 = 1;

/// Starting with v3, format introduces append-only
/// forward-compatibility to the header. This is the current number of
/// bytes after the hdr_size field. After the specified bytes, inner
/// payload-specific fields begin.
pub const P2W_FORMAT_HDR_SIZE: u16 = 1;

pub const PUBKEY_LEN: usize = 32;

#[repr(u8)]
pub enum PayloadId {
    PriceAttestation        = 1,
    // Not in use
    PriceBatchAttestation   = 2,
    // Not in use
    AccumulationAttestation = 3,
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_price_account_size() {
        let price_account_size = size_of::<PriceAccount>();
        // comp_ offset + (size_of::<PriceComp>() * PC_COMP_SIZE)
        // = 240 + (96 * 32)
        // = 3312
        assert_eq!(price_account_size, 3312);
    }
}
