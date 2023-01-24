//! On-chain state for the pyth2wormhole SOL contract.
//!
//! Important: Changes to max batch size must be reflected in the
//! instruction logic in attest.rs (look there for more
//! details). Mismatches between config and contract logic may confuse
//! attesters.
//!
//! How to add a new config schema:
//! X - new config version number
//! Y = X - 1; previous config number
//! 1. Add a next Pyth2WormholeConfigVX struct,
//! e.g. Pyth2WormholeConfigV3,
//! 2. Add a P2WConfigAccountVX type alias with a unique seed str
//! 3. Implement From<Pyth2WormholeConfigVY> for the new struct,
//! e.g. From<Pyth2WormholeConfigV2> for Pyth2WormholeConfigV3
//! 4. Advance Pyth2WormholeConfig, P2WConfigAccount,
//! OldPyth2WormholeConfig, OldP2WConfigAccount typedefs to use the
//! previous and new config structs.
//! 5. Deploy and call migrate() to verify
//! 6. (optional) Remove/comment out config structs and aliases from
//! before version Y.

use {
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    solana_program::pubkey::Pubkey,
    solitaire::{
        processors::seeded::AccountOwner,
        AccountState,
        Data,
        Derive,
        Owned,
    },
};

/// Aliases for current config schema (to migrate into)
pub type Pyth2WormholeConfig = Pyth2WormholeConfigV3;
pub type P2WConfigAccount<'b, const IS_INITIALIZED: AccountState> =
    P2WConfigAccountV3<'b, IS_INITIALIZED>;

impl Owned for Pyth2WormholeConfig {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

/// Aliases for previous config schema (to migrate from)
pub type OldPyth2WormholeConfig = Pyth2WormholeConfigV2;
pub type OldP2WConfigAccount<'b> = P2WConfigAccountV2<'b, { AccountState::Initialized }>; // Old config must always be initialized

impl Owned for OldPyth2WormholeConfig {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

/// Initial config format
#[derive(Clone, Default, BorshDeserialize, BorshSerialize)]
#[cfg_attr(feature = "client", derive(Debug))]
pub struct Pyth2WormholeConfigV1 {
    ///  Authority owning this contract
    pub owner:          Pubkey,
    /// Wormhole bridge program
    pub wh_prog:        Pubkey,
    /// Authority owning Pyth price data
    pub pyth_owner:     Pubkey,
    pub max_batch_size: u16,
}

pub type P2WConfigAccountV1<'b, const IS_INITIALIZED: AccountState> =
    Derive<Data<'b, Pyth2WormholeConfigV1, { IS_INITIALIZED }>, "pyth2wormhole-config">;

/// Added is_active
#[derive(Clone, Default, BorshDeserialize, BorshSerialize)]
#[cfg_attr(feature = "client", derive(Debug))]
pub struct Pyth2WormholeConfigV2 {
    ///  Authority owning this contract
    pub owner:          Pubkey,
    /// Wormhole bridge program
    pub wh_prog:        Pubkey,
    /// Authority owning Pyth price data
    pub pyth_owner:     Pubkey,
    /// How many product/price pairs can be sent and attested at once
    ///
    /// Important: Whenever the corresponding logic in attest.rs
    /// changes its expected number of symbols per batch, this config
    /// must be updated accordingly on-chain.
    pub max_batch_size: u16,

    /// If set to false, attest() will reject all calls unconditionally
    pub is_active: bool,
}

/// Note: If you get stuck with a pre-existing config account
/// (e.g. someone transfers into a PDA that we're not using yet), it's
/// usually easier to change the seed slightly
/// (e.g. pyth2wormhole-config-v2 -> pyth2wormhole-config-v2.1). This
/// saves a lot of time coding around this edge case.
pub type P2WConfigAccountV2<'b, const IS_INITIALIZED: AccountState> =
    Derive<Data<'b, Pyth2WormholeConfigV2, { IS_INITIALIZED }>, "pyth2wormhole-config-v2.1">;

impl From<Pyth2WormholeConfigV1> for Pyth2WormholeConfigV2 {
    fn from(old: Pyth2WormholeConfigV1) -> Self {
        let Pyth2WormholeConfigV1 {
            owner,
            wh_prog,
            pyth_owner,
            max_batch_size,
        } = old;

        Self {
            owner,
            wh_prog,
            pyth_owner,
            max_batch_size,
            is_active: true,
        }
    }
}

// Added ops_owner which can toggle the is_active field
#[derive(Clone, Default, Hash, BorshDeserialize, BorshSerialize, PartialEq, Eq)]
#[cfg_attr(feature = "client", derive(Debug))]
pub struct Pyth2WormholeConfigV3 {
    ///  Authority owning this contract
    pub owner:          Pubkey,
    /// Wormhole bridge program
    pub wh_prog:        Pubkey,
    /// Authority owning Pyth price data
    pub pyth_owner:     Pubkey,
    /// How many product/price pairs can be sent and attested at once
    ///
    /// Important: Whenever the corresponding logic in attest.rs
    /// changes its expected number of symbols per batch, this config
    /// must be updated accordingly on-chain.
    pub max_batch_size: u16,

    /// If set to false, attest() will reject all calls unconditionally
    pub is_active: bool,

    // If the ops_owner exists, it can toggle the value of `is_active`
    pub ops_owner: Option<Pubkey>,
}

pub type P2WConfigAccountV3<'b, const IS_INITIALIZED: AccountState> =
    Derive<Data<'b, Pyth2WormholeConfigV3, { IS_INITIALIZED }>, "pyth2wormhole-config-v3">;

impl From<Pyth2WormholeConfigV2> for Pyth2WormholeConfigV3 {
    fn from(old: Pyth2WormholeConfigV2) -> Self {
        let Pyth2WormholeConfigV2 {
            owner,
            wh_prog,
            pyth_owner,
            max_batch_size,
            is_active: _,
        } = old;

        Self {
            owner,
            wh_prog,
            pyth_owner,
            max_batch_size,
            is_active: true,
            ops_owner: None,
        }
    }
}
