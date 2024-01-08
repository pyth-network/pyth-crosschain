#![feature(prelude_import)]
#[prelude_import]
use std::prelude::rust_2021::*;
#[macro_use]
extern crate std;
use {
    crate::error::ReceiverError, anchor_lang::{prelude::*, system_program},
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot, hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{from_slice, v1::{MerklePriceUpdate, WormholeMessage, WormholePayload}},
    },
    serde_wormhole::RawMessage,
    solana_program::{
        keccak, program_memory::sol_memcpy, secp256k1_recover::secp256k1_recover,
        system_instruction,
    },
    state::{
        config::{Config, DataSource},
        price_update::PriceUpdateV1,
    },
    wormhole_core_bridge_solana::{
        sdk::legacy::AccountVariant, state::{EncodedVaa, GuardianSet},
    },
    wormhole_raw_vaas::{GuardianSetSig, Vaa},
    wormhole_sdk::vaa::{Body, Header},
};
pub mod error {
    use anchor_lang::prelude::*;
    #[repr(u32)]
    pub enum ReceiverError {
        InvalidDataSource,
        WrongVaaOwner,
        PostedVaaHeaderWrongMagicNumber,
        DeserializeVaaFailed,
        DeserializeUpdateFailed,
        DeserializeMessageFailed,
        InvalidWormholeMessage,
        InvalidPriceUpdate,
        UnsupportedMessageType,
        GovernanceAuthorityMismatch,
        TargetGovernanceAuthorityMismatch,
        NonexistentGovernanceAuthorityTransferRequest,
        InsufficientFunds,
        InvalidVaaVersion,
        GuardianSetMismatch,
        InvalidGuardianIndex,
        InvalidSignature,
        InvalidGuardianKeyRecovery,
    }
    #[automatically_derived]
    impl ::core::fmt::Debug for ReceiverError {
        fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
            ::core::fmt::Formatter::write_str(
                f,
                match self {
                    ReceiverError::InvalidDataSource => "InvalidDataSource",
                    ReceiverError::WrongVaaOwner => "WrongVaaOwner",
                    ReceiverError::PostedVaaHeaderWrongMagicNumber => {
                        "PostedVaaHeaderWrongMagicNumber"
                    }
                    ReceiverError::DeserializeVaaFailed => "DeserializeVaaFailed",
                    ReceiverError::DeserializeUpdateFailed => "DeserializeUpdateFailed",
                    ReceiverError::DeserializeMessageFailed => "DeserializeMessageFailed",
                    ReceiverError::InvalidWormholeMessage => "InvalidWormholeMessage",
                    ReceiverError::InvalidPriceUpdate => "InvalidPriceUpdate",
                    ReceiverError::UnsupportedMessageType => "UnsupportedMessageType",
                    ReceiverError::GovernanceAuthorityMismatch => {
                        "GovernanceAuthorityMismatch"
                    }
                    ReceiverError::TargetGovernanceAuthorityMismatch => {
                        "TargetGovernanceAuthorityMismatch"
                    }
                    ReceiverError::NonexistentGovernanceAuthorityTransferRequest => {
                        "NonexistentGovernanceAuthorityTransferRequest"
                    }
                    ReceiverError::InsufficientFunds => "InsufficientFunds",
                    ReceiverError::InvalidVaaVersion => "InvalidVaaVersion",
                    ReceiverError::GuardianSetMismatch => "GuardianSetMismatch",
                    ReceiverError::InvalidGuardianIndex => "InvalidGuardianIndex",
                    ReceiverError::InvalidSignature => "InvalidSignature",
                    ReceiverError::InvalidGuardianKeyRecovery => {
                        "InvalidGuardianKeyRecovery"
                    }
                },
            )
        }
    }
    #[automatically_derived]
    impl ::core::clone::Clone for ReceiverError {
        #[inline]
        fn clone(&self) -> ReceiverError {
            *self
        }
    }
    #[automatically_derived]
    impl ::core::marker::Copy for ReceiverError {}
    impl ReceiverError {
        /// Gets the name of this [#enum_name].
        pub fn name(&self) -> String {
            match self {
                ReceiverError::InvalidDataSource => "InvalidDataSource".to_string(),
                ReceiverError::WrongVaaOwner => "WrongVaaOwner".to_string(),
                ReceiverError::PostedVaaHeaderWrongMagicNumber => {
                    "PostedVaaHeaderWrongMagicNumber".to_string()
                }
                ReceiverError::DeserializeVaaFailed => "DeserializeVaaFailed".to_string(),
                ReceiverError::DeserializeUpdateFailed => {
                    "DeserializeUpdateFailed".to_string()
                }
                ReceiverError::DeserializeMessageFailed => {
                    "DeserializeMessageFailed".to_string()
                }
                ReceiverError::InvalidWormholeMessage => {
                    "InvalidWormholeMessage".to_string()
                }
                ReceiverError::InvalidPriceUpdate => "InvalidPriceUpdate".to_string(),
                ReceiverError::UnsupportedMessageType => {
                    "UnsupportedMessageType".to_string()
                }
                ReceiverError::GovernanceAuthorityMismatch => {
                    "GovernanceAuthorityMismatch".to_string()
                }
                ReceiverError::TargetGovernanceAuthorityMismatch => {
                    "TargetGovernanceAuthorityMismatch".to_string()
                }
                ReceiverError::NonexistentGovernanceAuthorityTransferRequest => {
                    "NonexistentGovernanceAuthorityTransferRequest".to_string()
                }
                ReceiverError::InsufficientFunds => "InsufficientFunds".to_string(),
                ReceiverError::InvalidVaaVersion => "InvalidVaaVersion".to_string(),
                ReceiverError::GuardianSetMismatch => "GuardianSetMismatch".to_string(),
                ReceiverError::InvalidGuardianIndex => "InvalidGuardianIndex".to_string(),
                ReceiverError::InvalidSignature => "InvalidSignature".to_string(),
                ReceiverError::InvalidGuardianKeyRecovery => {
                    "InvalidGuardianKeyRecovery".to_string()
                }
            }
        }
    }
    impl From<ReceiverError> for u32 {
        fn from(e: ReceiverError) -> u32 {
            e as u32 + anchor_lang::error::ERROR_CODE_OFFSET
        }
    }
    impl From<ReceiverError> for anchor_lang::error::Error {
        fn from(error_code: ReceiverError) -> anchor_lang::error::Error {
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: error_code.name(),
                error_code_number: error_code.into(),
                error_msg: error_code.to_string(),
                error_origin: None,
                compared_values: None,
            })
        }
    }
    impl std::fmt::Display for ReceiverError {
        fn fmt(
            &self,
            fmt: &mut std::fmt::Formatter<'_>,
        ) -> std::result::Result<(), std::fmt::Error> {
            match self {
                ReceiverError::InvalidDataSource => {
                    fmt.write_fmt(
                        format_args!(
                            "The tuple emitter chain, emitter doesn\'t match one of the valid data sources."
                        ),
                    )
                }
                ReceiverError::WrongVaaOwner => {
                    fmt.write_fmt(
                        format_args!("The posted VAA account has the wrong owner."),
                    )
                }
                ReceiverError::PostedVaaHeaderWrongMagicNumber => {
                    fmt.write_fmt(format_args!("The posted VAA has wrong magic number."))
                }
                ReceiverError::DeserializeVaaFailed => {
                    fmt.write_fmt(
                        format_args!("An error occurred when deserializing the VAA."),
                    )
                }
                ReceiverError::DeserializeUpdateFailed => {
                    fmt.write_fmt(
                        format_args!("An error occurred when deserializing the updates."),
                    )
                }
                ReceiverError::DeserializeMessageFailed => {
                    fmt.write_fmt(
                        format_args!("An error occurred when deserializing the message"),
                    )
                }
                ReceiverError::InvalidWormholeMessage => {
                    fmt.write_fmt(format_args!("Received an invalid wormhole message"))
                }
                ReceiverError::InvalidPriceUpdate => {
                    fmt.write_fmt(format_args!("Received an invalid price update"))
                }
                ReceiverError::UnsupportedMessageType => {
                    fmt.write_fmt(
                        format_args!("This type of message is not supported currently"),
                    )
                }
                ReceiverError::GovernanceAuthorityMismatch => {
                    fmt.write_fmt(
                        format_args!(
                            "The signer is not authorized to perform this governance action"
                        ),
                    )
                }
                ReceiverError::TargetGovernanceAuthorityMismatch => {
                    fmt.write_fmt(
                        format_args!(
                            "The signer is not authorized to accept the governance authority"
                        ),
                    )
                }
                ReceiverError::NonexistentGovernanceAuthorityTransferRequest => {
                    fmt.write_fmt(
                        format_args!(
                            "The governance authority needs to request a transfer first"
                        ),
                    )
                }
                ReceiverError::InsufficientFunds => {
                    fmt.write_fmt(
                        format_args!("Funds are insufficient to pay the receiving fee"),
                    )
                }
                ReceiverError::InvalidVaaVersion => {
                    fmt.write_fmt(format_args!("Invalid VAA version"))
                }
                ReceiverError::GuardianSetMismatch => {
                    fmt.write_fmt(
                        format_args!(
                            "Guardian set version in the VAA doesn\'t match the guardian set passed"
                        ),
                    )
                }
                ReceiverError::InvalidGuardianIndex => {
                    fmt.write_fmt(
                        format_args!(
                            "Guardian index exceeds the number of guardians in the set"
                        ),
                    )
                }
                ReceiverError::InvalidSignature => {
                    fmt.write_fmt(format_args!("A VAA signature is invalid"))
                }
                ReceiverError::InvalidGuardianKeyRecovery => {
                    fmt.write_fmt(
                        format_args!(
                            "The recovered guardian public key doesn\'t match the guardian set"
                        ),
                    )
                }
            }
        }
    }
}
pub mod state {
    pub mod config {
        use {anchor_lang::prelude::*, solana_program::pubkey::Pubkey};
        pub struct Config {
            pub governance_authority: Pubkey,
            pub target_governance_authority: Option<Pubkey>,
            pub wormhole: Pubkey,
            pub valid_data_sources: Vec<DataSource>,
            pub single_update_fee_in_lamports: u64,
        }
        impl borsh::ser::BorshSerialize for Config
        where
            Pubkey: borsh::ser::BorshSerialize,
            Option<Pubkey>: borsh::ser::BorshSerialize,
            Pubkey: borsh::ser::BorshSerialize,
            Vec<DataSource>: borsh::ser::BorshSerialize,
            u64: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.governance_authority, writer)?;
                borsh::BorshSerialize::serialize(
                    &self.target_governance_authority,
                    writer,
                )?;
                borsh::BorshSerialize::serialize(&self.wormhole, writer)?;
                borsh::BorshSerialize::serialize(&self.valid_data_sources, writer)?;
                borsh::BorshSerialize::serialize(
                    &self.single_update_fee_in_lamports,
                    writer,
                )?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for Config
        where
            Pubkey: borsh::BorshDeserialize,
            Option<Pubkey>: borsh::BorshDeserialize,
            Pubkey: borsh::BorshDeserialize,
            Vec<DataSource>: borsh::BorshDeserialize,
            u64: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    governance_authority: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                    target_governance_authority: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                    wormhole: borsh::BorshDeserialize::deserialize_reader(reader)?,
                    valid_data_sources: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                    single_update_fee_in_lamports: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                })
            }
        }
        #[automatically_derived]
        impl ::core::clone::Clone for Config {
            #[inline]
            fn clone(&self) -> Config {
                Config {
                    governance_authority: ::core::clone::Clone::clone(
                        &self.governance_authority,
                    ),
                    target_governance_authority: ::core::clone::Clone::clone(
                        &self.target_governance_authority,
                    ),
                    wormhole: ::core::clone::Clone::clone(&self.wormhole),
                    valid_data_sources: ::core::clone::Clone::clone(
                        &self.valid_data_sources,
                    ),
                    single_update_fee_in_lamports: ::core::clone::Clone::clone(
                        &self.single_update_fee_in_lamports,
                    ),
                }
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountSerialize for Config {
            fn try_serialize<W: std::io::Write>(
                &self,
                writer: &mut W,
            ) -> anchor_lang::Result<()> {
                if writer.write_all(&[155, 12, 170, 224, 30, 250, 204, 130]).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                if AnchorSerialize::serialize(self, writer).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                Ok(())
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountDeserialize for Config {
            fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                if buf.len() < [155, 12, 170, 224, 30, 250, 204, 130].len() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDiscriminatorNotFound
                            .into(),
                    );
                }
                let given_disc = &buf[..8];
                if &[155, 12, 170, 224, 30, 250, 204, 130] != given_disc {
                    return Err(
                        anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                error_name: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .name(),
                                error_code_number: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .into(),
                                error_msg: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .to_string(),
                                error_origin: Some(
                                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                        filename: "programs/pyth-solana-receiver/src/state/config.rs",
                                        line: 6u32,
                                    }),
                                ),
                                compared_values: None,
                            })
                            .with_account_name("Config"),
                    );
                }
                Self::try_deserialize_unchecked(buf)
            }
            fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                let mut data: &[u8] = &buf[8..];
                AnchorDeserialize::deserialize(&mut data)
                    .map_err(|_| {
                        anchor_lang::error::ErrorCode::AccountDidNotDeserialize.into()
                    })
            }
        }
        #[automatically_derived]
        impl anchor_lang::Discriminator for Config {
            const DISCRIMINATOR: [u8; 8] = [155, 12, 170, 224, 30, 250, 204, 130];
        }
        #[automatically_derived]
        impl anchor_lang::Owner for Config {
            fn owner() -> Pubkey {
                crate::ID
            }
        }
        pub struct DataSource {
            pub chain: u16,
            pub emitter: Pubkey,
        }
        impl borsh::ser::BorshSerialize for DataSource
        where
            u16: borsh::ser::BorshSerialize,
            Pubkey: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.chain, writer)?;
                borsh::BorshSerialize::serialize(&self.emitter, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for DataSource
        where
            u16: borsh::BorshDeserialize,
            Pubkey: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    chain: borsh::BorshDeserialize::deserialize_reader(reader)?,
                    emitter: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        #[automatically_derived]
        impl ::core::clone::Clone for DataSource {
            #[inline]
            fn clone(&self) -> DataSource {
                DataSource {
                    chain: ::core::clone::Clone::clone(&self.chain),
                    emitter: ::core::clone::Clone::clone(&self.emitter),
                }
            }
        }
        #[automatically_derived]
        impl ::core::marker::StructuralPartialEq for DataSource {}
        #[automatically_derived]
        impl ::core::cmp::PartialEq for DataSource {
            #[inline]
            fn eq(&self, other: &DataSource) -> bool {
                self.chain == other.chain && self.emitter == other.emitter
            }
        }
        impl Config {
            pub const LEN: usize = 370;
        }
    }
    pub mod price_update {
        use {
            anchor_lang::prelude::*, pythnet_sdk::messages::PriceFeedMessage,
            solana_program::pubkey::Pubkey,
        };
        pub struct PriceUpdateV1 {
            pub write_authority: Pubkey,
            pub verified_signatures: u8,
            pub price_message: PriceFeedMessage,
        }
        impl borsh::ser::BorshSerialize for PriceUpdateV1
        where
            Pubkey: borsh::ser::BorshSerialize,
            u8: borsh::ser::BorshSerialize,
            PriceFeedMessage: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.write_authority, writer)?;
                borsh::BorshSerialize::serialize(&self.verified_signatures, writer)?;
                borsh::BorshSerialize::serialize(&self.price_message, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for PriceUpdateV1
        where
            Pubkey: borsh::BorshDeserialize,
            u8: borsh::BorshDeserialize,
            PriceFeedMessage: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    write_authority: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                    verified_signatures: borsh::BorshDeserialize::deserialize_reader(
                        reader,
                    )?,
                    price_message: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        #[automatically_derived]
        impl ::core::clone::Clone for PriceUpdateV1 {
            #[inline]
            fn clone(&self) -> PriceUpdateV1 {
                PriceUpdateV1 {
                    write_authority: ::core::clone::Clone::clone(&self.write_authority),
                    verified_signatures: ::core::clone::Clone::clone(
                        &self.verified_signatures,
                    ),
                    price_message: ::core::clone::Clone::clone(&self.price_message),
                }
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountSerialize for PriceUpdateV1 {
            fn try_serialize<W: std::io::Write>(
                &self,
                writer: &mut W,
            ) -> anchor_lang::Result<()> {
                if writer.write_all(&[182, 92, 197, 196, 187, 243, 181, 48]).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                if AnchorSerialize::serialize(self, writer).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                Ok(())
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountDeserialize for PriceUpdateV1 {
            fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                if buf.len() < [182, 92, 197, 196, 187, 243, 181, 48].len() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDiscriminatorNotFound
                            .into(),
                    );
                }
                let given_disc = &buf[..8];
                if &[182, 92, 197, 196, 187, 243, 181, 48] != given_disc {
                    return Err(
                        anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                error_name: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .name(),
                                error_code_number: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .into(),
                                error_msg: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .to_string(),
                                error_origin: Some(
                                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                        filename: "programs/pyth-solana-receiver/src/state/price_update.rs",
                                        line: 7u32,
                                    }),
                                ),
                                compared_values: None,
                            })
                            .with_account_name("PriceUpdateV1"),
                    );
                }
                Self::try_deserialize_unchecked(buf)
            }
            fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                let mut data: &[u8] = &buf[8..];
                AnchorDeserialize::deserialize(&mut data)
                    .map_err(|_| {
                        anchor_lang::error::ErrorCode::AccountDidNotDeserialize.into()
                    })
            }
        }
        #[automatically_derived]
        impl anchor_lang::Discriminator for PriceUpdateV1 {
            const DISCRIMINATOR: [u8; 8] = [182, 92, 197, 196, 187, 243, 181, 48];
        }
        #[automatically_derived]
        impl anchor_lang::Owner for PriceUpdateV1 {
            fn owner() -> Pubkey {
                crate::ID
            }
        }
        impl PriceUpdateV1 {
            pub const LEN: usize = 8 + 32 + 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
        }
    }
}
/// The static program ID
pub static ID: anchor_lang::solana_program::pubkey::Pubkey = anchor_lang::solana_program::pubkey::Pubkey::new_from_array([
    12u8,
    183u8,
    250u8,
    187u8,
    82u8,
    247u8,
    166u8,
    72u8,
    187u8,
    91u8,
    49u8,
    125u8,
    154u8,
    1u8,
    139u8,
    144u8,
    87u8,
    203u8,
    2u8,
    71u8,
    116u8,
    250u8,
    254u8,
    1u8,
    230u8,
    196u8,
    223u8,
    152u8,
    204u8,
    56u8,
    88u8,
    129u8,
]);
/// Confirms that a given pubkey is equivalent to the program ID
pub fn check_id(id: &anchor_lang::solana_program::pubkey::Pubkey) -> bool {
    id == &ID
}
/// Returns the program ID
pub fn id() -> anchor_lang::solana_program::pubkey::Pubkey {
    ID
}
use self::pyth_solana_receiver::*;
/// # Safety
#[no_mangle]
pub unsafe extern "C" fn entrypoint(input: *mut u8) -> u64 {
    let (program_id, accounts, instruction_data) = unsafe {
        ::solana_program::entrypoint::deserialize(input)
    };
    match entry(&program_id, &accounts, &instruction_data) {
        Ok(()) => ::solana_program::entrypoint::SUCCESS,
        Err(error) => error.into(),
    }
}
/// The Anchor codegen exposes a programming model where a user defines
/// a set of methods inside of a `#[program]` module in a way similar
/// to writing RPC request handlers. The macro then generates a bunch of
/// code wrapping these user defined methods into something that can be
/// executed on Solana.
///
/// These methods fall into one categorie for now.
///
/// Global methods - regular methods inside of the `#[program]`.
///
/// Care must be taken by the codegen to prevent collisions between
/// methods in these different namespaces. For this reason, Anchor uses
/// a variant of sighash to perform method dispatch, rather than
/// something like a simple enum variant discriminator.
///
/// The execution flow of the generated code can be roughly outlined:
///
/// * Start program via the entrypoint.
/// * Strip method identifier off the first 8 bytes of the instruction
///   data and invoke the identified method. The method identifier
///   is a variant of sighash. See docs.rs for `anchor_lang` for details.
/// * If the method identifier is an IDL identifier, execute the IDL
///   instructions, which are a special set of hardcoded instructions
///   baked into every Anchor program. Then exit.
/// * Otherwise, the method identifier is for a user defined
///   instruction, i.e., one of the methods in the user defined
///   `#[program]` module. Perform method dispatch, i.e., execute the
///   big match statement mapping method identifier to method handler
///   wrapper.
/// * Run the method handler wrapper. This wraps the code the user
///   actually wrote, deserializing the accounts, constructing the
///   context, invoking the user's code, and finally running the exit
///   routine, which typically persists account changes.
///
/// The `entry` function here, defines the standard entry to a Solana
/// program, where execution begins.
pub fn entry(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> anchor_lang::solana_program::entrypoint::ProgramResult {
    try_entry(program_id, accounts, data)
        .map_err(|e| {
            e.log();
            e.into()
        })
}
fn try_entry(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> anchor_lang::Result<()> {
    if *program_id != ID {
        return Err(anchor_lang::error::ErrorCode::DeclaredProgramIdMismatch.into());
    }
    if data.len() < 8 {
        return Err(anchor_lang::error::ErrorCode::InstructionMissing.into());
    }
    dispatch(program_id, accounts, data)
}
/// Module representing the program.
pub mod program {
    use super::*;
    /// Type representing the program.
    pub struct PythSolanaReceiver;
    #[automatically_derived]
    impl ::core::clone::Clone for PythSolanaReceiver {
        #[inline]
        fn clone(&self) -> PythSolanaReceiver {
            PythSolanaReceiver
        }
    }
    impl anchor_lang::Id for PythSolanaReceiver {
        fn id() -> Pubkey {
            ID
        }
    }
}
/// Performs method dispatch.
///
/// Each method in an anchor program is uniquely defined by a namespace
/// and a rust identifier (i.e., the name given to the method). These
/// two pieces can be combined to creater a method identifier,
/// specifically, Anchor uses
///
/// Sha256("<namespace>:<rust-identifier>")[..8],
///
/// where the namespace can be one type. "global" for a
/// regular instruction.
///
/// With this 8 byte identifier, Anchor performs method dispatch,
/// matching the given 8 byte identifier to the associated method
/// handler, which leads to user defined code being eventually invoked.
fn dispatch(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> anchor_lang::Result<()> {
    let mut ix_data: &[u8] = data;
    let sighash: [u8; 8] = {
        let mut sighash: [u8; 8] = [0; 8];
        sighash.copy_from_slice(&ix_data[..8]);
        ix_data = &ix_data[8..];
        sighash
    };
    use anchor_lang::Discriminator;
    match sighash {
        instruction::Initialize::DISCRIMINATOR => {
            __private::__global::initialize(program_id, accounts, ix_data)
        }
        instruction::RequestGovernanceAuthorityTransfer::DISCRIMINATOR => {
            __private::__global::request_governance_authority_transfer(
                program_id,
                accounts,
                ix_data,
            )
        }
        instruction::AuthorizeGovernanceAuthorityTransfer::DISCRIMINATOR => {
            __private::__global::authorize_governance_authority_transfer(
                program_id,
                accounts,
                ix_data,
            )
        }
        instruction::SetDataSources::DISCRIMINATOR => {
            __private::__global::set_data_sources(program_id, accounts, ix_data)
        }
        instruction::SetFee::DISCRIMINATOR => {
            __private::__global::set_fee(program_id, accounts, ix_data)
        }
        instruction::SetWormholeAddress::DISCRIMINATOR => {
            __private::__global::set_wormhole_address(program_id, accounts, ix_data)
        }
        instruction::PostUpdatesAtomic::DISCRIMINATOR => {
            __private::__global::post_updates_atomic(program_id, accounts, ix_data)
        }
        instruction::PostUpdates::DISCRIMINATOR => {
            __private::__global::post_updates(program_id, accounts, ix_data)
        }
        anchor_lang::idl::IDL_IX_TAG_LE => {
            __private::__idl::__idl_dispatch(program_id, accounts, &ix_data)
        }
        anchor_lang::event::EVENT_IX_TAG_LE => {
            Err(anchor_lang::error::ErrorCode::EventInstructionStub.into())
        }
        _ => Err(anchor_lang::error::ErrorCode::InstructionFallbackNotFound.into()),
    }
}
/// Create a private module to not clutter the program's namespace.
/// Defines an entrypoint for each individual instruction handler
/// wrapper.
mod __private {
    use super::*;
    /// __idl mod defines handlers for injected Anchor IDL instructions.
    pub mod __idl {
        use super::*;
        #[inline(never)]
        #[cfg(not(feature = "no-idl"))]
        pub fn __idl_dispatch(
            program_id: &Pubkey,
            accounts: &[AccountInfo],
            idl_ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            let mut accounts = accounts;
            let mut data: &[u8] = idl_ix_data;
            let ix = anchor_lang::idl::IdlInstruction::deserialize(&mut data)
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            match ix {
                anchor_lang::idl::IdlInstruction::Create { data_len } => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlCreateAccounts::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_create_account(program_id, &mut accounts, data_len)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::Resize { data_len } => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlResizeAccount::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_resize_account(program_id, &mut accounts, data_len)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::Close => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlCloseAccount::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_close_account(program_id, &mut accounts)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::CreateBuffer => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlCreateBuffer::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_create_buffer(program_id, &mut accounts)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::Write { data } => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlAccounts::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_write(program_id, &mut accounts, data)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::SetAuthority { new_authority } => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlAccounts::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_set_authority(program_id, &mut accounts, new_authority)?;
                    accounts.exit(program_id)?;
                }
                anchor_lang::idl::IdlInstruction::SetBuffer => {
                    let mut bumps = std::collections::BTreeMap::new();
                    let mut reallocs = std::collections::BTreeSet::new();
                    let mut accounts = IdlSetBuffer::try_accounts(
                        program_id,
                        &mut accounts,
                        &[],
                        &mut bumps,
                        &mut reallocs,
                    )?;
                    __idl_set_buffer(program_id, &mut accounts)?;
                    accounts.exit(program_id)?;
                }
            }
            Ok(())
        }
        use anchor_lang::idl::ERASED_AUTHORITY;
        pub struct IdlAccount {
            pub authority: Pubkey,
            pub data_len: u32,
        }
        #[automatically_derived]
        impl ::core::fmt::Debug for IdlAccount {
            fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
                ::core::fmt::Formatter::debug_struct_field2_finish(
                    f,
                    "IdlAccount",
                    "authority",
                    &self.authority,
                    "data_len",
                    &&self.data_len,
                )
            }
        }
        impl borsh::ser::BorshSerialize for IdlAccount
        where
            Pubkey: borsh::ser::BorshSerialize,
            u32: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.authority, writer)?;
                borsh::BorshSerialize::serialize(&self.data_len, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for IdlAccount
        where
            Pubkey: borsh::BorshDeserialize,
            u32: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    authority: borsh::BorshDeserialize::deserialize_reader(reader)?,
                    data_len: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        #[automatically_derived]
        impl ::core::clone::Clone for IdlAccount {
            #[inline]
            fn clone(&self) -> IdlAccount {
                IdlAccount {
                    authority: ::core::clone::Clone::clone(&self.authority),
                    data_len: ::core::clone::Clone::clone(&self.data_len),
                }
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountSerialize for IdlAccount {
            fn try_serialize<W: std::io::Write>(
                &self,
                writer: &mut W,
            ) -> anchor_lang::Result<()> {
                if writer.write_all(&[24, 70, 98, 191, 58, 144, 123, 158]).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                if AnchorSerialize::serialize(self, writer).is_err() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDidNotSerialize.into(),
                    );
                }
                Ok(())
            }
        }
        #[automatically_derived]
        impl anchor_lang::AccountDeserialize for IdlAccount {
            fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                if buf.len() < [24, 70, 98, 191, 58, 144, 123, 158].len() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountDiscriminatorNotFound
                            .into(),
                    );
                }
                let given_disc = &buf[..8];
                if &[24, 70, 98, 191, 58, 144, 123, 158] != given_disc {
                    return Err(
                        anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                error_name: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .name(),
                                error_code_number: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .into(),
                                error_msg: anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch
                                    .to_string(),
                                error_origin: Some(
                                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                                        line: 57u32,
                                    }),
                                ),
                                compared_values: None,
                            })
                            .with_account_name("IdlAccount"),
                    );
                }
                Self::try_deserialize_unchecked(buf)
            }
            fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
                let mut data: &[u8] = &buf[8..];
                AnchorDeserialize::deserialize(&mut data)
                    .map_err(|_| {
                        anchor_lang::error::ErrorCode::AccountDidNotDeserialize.into()
                    })
            }
        }
        #[automatically_derived]
        impl anchor_lang::Discriminator for IdlAccount {
            const DISCRIMINATOR: [u8; 8] = [24, 70, 98, 191, 58, 144, 123, 158];
        }
        impl IdlAccount {
            pub fn address(program_id: &Pubkey) -> Pubkey {
                let program_signer = Pubkey::find_program_address(&[], program_id).0;
                Pubkey::create_with_seed(&program_signer, IdlAccount::seed(), program_id)
                    .expect("Seed is always valid")
            }
            pub fn seed() -> &'static str {
                "anchor:idl"
            }
        }
        impl anchor_lang::Owner for IdlAccount {
            fn owner() -> Pubkey {
                crate::ID
            }
        }
        pub struct IdlCreateAccounts<'info> {
            #[account(signer)]
            pub from: AccountInfo<'info>,
            #[account(mut)]
            pub to: AccountInfo<'info>,
            #[account(seeds = [], bump)]
            pub base: AccountInfo<'info>,
            pub system_program: Program<'info, System>,
            #[account(executable)]
            pub program: AccountInfo<'info>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlCreateAccounts<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                let from: AccountInfo = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("from"))?;
                let to: AccountInfo = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("to"))?;
                let base: AccountInfo = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("base"))?;
                let system_program: anchor_lang::accounts::program::Program<System> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("system_program"))?;
                let program: AccountInfo = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("program"))?;
                if !from.is_signer {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintSigner,
                            )
                            .with_account_name("from"),
                    );
                }
                if !to.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("to"),
                    );
                }
                let (__pda_address, __bump) = Pubkey::find_program_address(
                    &[],
                    &__program_id,
                );
                __bumps.insert("base".to_string(), __bump);
                if base.key() != __pda_address {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintSeeds,
                            )
                            .with_account_name("base")
                            .with_pubkeys((base.key(), __pda_address)),
                    );
                }
                if !program.to_account_info().executable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintExecutable,
                            )
                            .with_account_name("program"),
                    );
                }
                Ok(IdlCreateAccounts {
                    from,
                    to,
                    base,
                    system_program,
                    program,
                })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCreateAccounts<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.from.to_account_infos());
                account_infos.extend(self.to.to_account_infos());
                account_infos.extend(self.base.to_account_infos());
                account_infos.extend(self.system_program.to_account_infos());
                account_infos.extend(self.program.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlCreateAccounts<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.from.to_account_metas(Some(true)));
                account_metas.extend(self.to.to_account_metas(None));
                account_metas.extend(self.base.to_account_metas(None));
                account_metas.extend(self.system_program.to_account_metas(None));
                account_metas.extend(self.program.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlCreateAccounts<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                anchor_lang::AccountsExit::exit(&self.to, program_id)
                    .map_err(|e| e.with_account_name("to"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_create_accounts {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlCreateAccounts`].
            pub struct IdlCreateAccounts {
                pub from: anchor_lang::solana_program::pubkey::Pubkey,
                pub to: anchor_lang::solana_program::pubkey::Pubkey,
                pub base: anchor_lang::solana_program::pubkey::Pubkey,
                pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
                pub program: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlCreateAccounts
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.from, writer)?;
                    borsh::BorshSerialize::serialize(&self.to, writer)?;
                    borsh::BorshSerialize::serialize(&self.base, writer)?;
                    borsh::BorshSerialize::serialize(&self.system_program, writer)?;
                    borsh::BorshSerialize::serialize(&self.program, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlCreateAccounts {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.from,
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.to,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.base,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.system_program,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.program,
                                false,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_create_accounts {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlCreateAccounts`].
            pub struct IdlCreateAccounts<'info> {
                pub from: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub to: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub base: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub program: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlCreateAccounts<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.from),
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.to),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.base),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.system_program),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.program),
                                false,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCreateAccounts<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.from),
                        );
                    account_infos
                        .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.to));
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.base),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.system_program,
                            ),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.program),
                        );
                    account_infos
                }
            }
        }
        pub struct IdlAccounts<'info> {
            #[account(mut, has_one = authority)]
            pub idl: Account<'info, IdlAccount>,
            #[account(constraint = authority.key!= &ERASED_AUTHORITY)]
            pub authority: Signer<'info>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlAccounts<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                let idl: anchor_lang::accounts::account::Account<IdlAccount> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("idl"))?;
                let authority: Signer = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("authority"))?;
                if !idl.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("idl"),
                    );
                }
                {
                    let my_key = idl.authority;
                    let target_key = authority.key();
                    if my_key != target_key {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintHasOne,
                                )
                                .with_account_name("idl")
                                .with_pubkeys((my_key, target_key)),
                        );
                    }
                }
                if !(authority.key != &ERASED_AUTHORITY) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("authority"),
                    );
                }
                Ok(IdlAccounts { idl, authority })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlAccounts<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.idl.to_account_infos());
                account_infos.extend(self.authority.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlAccounts<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.idl.to_account_metas(None));
                account_metas.extend(self.authority.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlAccounts<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                anchor_lang::AccountsExit::exit(&self.idl, program_id)
                    .map_err(|e| e.with_account_name("idl"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_accounts {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlAccounts`].
            pub struct IdlAccounts {
                pub idl: anchor_lang::solana_program::pubkey::Pubkey,
                pub authority: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlAccounts
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.idl, writer)?;
                    borsh::BorshSerialize::serialize(&self.authority, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlAccounts {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.idl,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.authority,
                                true,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_accounts {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlAccounts`].
            pub struct IdlAccounts<'info> {
                pub idl: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub authority: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlAccounts<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.idl),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.authority),
                                true,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlAccounts<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.idl),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.authority,
                            ),
                        );
                    account_infos
                }
            }
        }
        pub struct IdlResizeAccount<'info> {
            #[account(mut, has_one = authority)]
            pub idl: Account<'info, IdlAccount>,
            #[account(mut, constraint = authority.key!= &ERASED_AUTHORITY)]
            pub authority: Signer<'info>,
            pub system_program: Program<'info, System>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlResizeAccount<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                let idl: anchor_lang::accounts::account::Account<IdlAccount> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("idl"))?;
                let authority: Signer = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("authority"))?;
                let system_program: anchor_lang::accounts::program::Program<System> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("system_program"))?;
                if !idl.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("idl"),
                    );
                }
                {
                    let my_key = idl.authority;
                    let target_key = authority.key();
                    if my_key != target_key {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintHasOne,
                                )
                                .with_account_name("idl")
                                .with_pubkeys((my_key, target_key)),
                        );
                    }
                }
                if !authority.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("authority"),
                    );
                }
                if !(authority.key != &ERASED_AUTHORITY) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("authority"),
                    );
                }
                Ok(IdlResizeAccount {
                    idl,
                    authority,
                    system_program,
                })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlResizeAccount<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.idl.to_account_infos());
                account_infos.extend(self.authority.to_account_infos());
                account_infos.extend(self.system_program.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlResizeAccount<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.idl.to_account_metas(None));
                account_metas.extend(self.authority.to_account_metas(None));
                account_metas.extend(self.system_program.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlResizeAccount<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                anchor_lang::AccountsExit::exit(&self.idl, program_id)
                    .map_err(|e| e.with_account_name("idl"))?;
                anchor_lang::AccountsExit::exit(&self.authority, program_id)
                    .map_err(|e| e.with_account_name("authority"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_resize_account {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlResizeAccount`].
            pub struct IdlResizeAccount {
                pub idl: anchor_lang::solana_program::pubkey::Pubkey,
                pub authority: anchor_lang::solana_program::pubkey::Pubkey,
                pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlResizeAccount
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.idl, writer)?;
                    borsh::BorshSerialize::serialize(&self.authority, writer)?;
                    borsh::BorshSerialize::serialize(&self.system_program, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlResizeAccount {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.idl,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.authority,
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.system_program,
                                false,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_resize_account {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlResizeAccount`].
            pub struct IdlResizeAccount<'info> {
                pub idl: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub authority: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlResizeAccount<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.idl),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.authority),
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.system_program),
                                false,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlResizeAccount<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.idl),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.authority,
                            ),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.system_program,
                            ),
                        );
                    account_infos
                }
            }
        }
        pub struct IdlCreateBuffer<'info> {
            #[account(zero)]
            pub buffer: Account<'info, IdlAccount>,
            #[account(constraint = authority.key!= &ERASED_AUTHORITY)]
            pub authority: Signer<'info>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlCreateBuffer<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                if __accounts.is_empty() {
                    return Err(
                        anchor_lang::error::ErrorCode::AccountNotEnoughKeys.into(),
                    );
                }
                let buffer = &__accounts[0];
                *__accounts = &__accounts[1..];
                let authority: Signer = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("authority"))?;
                let __anchor_rent = Rent::get()?;
                let buffer: anchor_lang::accounts::account::Account<IdlAccount> = {
                    let mut __data: &[u8] = &buffer.try_borrow_data()?;
                    let mut __disc_bytes = [0u8; 8];
                    __disc_bytes.copy_from_slice(&__data[..8]);
                    let __discriminator = u64::from_le_bytes(__disc_bytes);
                    if __discriminator != 0 {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintZero,
                                )
                                .with_account_name("buffer"),
                        );
                    }
                    match anchor_lang::accounts::account::Account::try_from_unchecked(
                        &buffer,
                    ) {
                        Ok(val) => val,
                        Err(e) => return Err(e.with_account_name("buffer")),
                    }
                };
                if !buffer.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("buffer"),
                    );
                }
                if !__anchor_rent
                    .is_exempt(
                        buffer.to_account_info().lamports(),
                        buffer.to_account_info().try_data_len()?,
                    )
                {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRentExempt,
                            )
                            .with_account_name("buffer"),
                    );
                }
                if !(authority.key != &ERASED_AUTHORITY) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("authority"),
                    );
                }
                Ok(IdlCreateBuffer {
                    buffer,
                    authority,
                })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCreateBuffer<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.buffer.to_account_infos());
                account_infos.extend(self.authority.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlCreateBuffer<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.buffer.to_account_metas(None));
                account_metas.extend(self.authority.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlCreateBuffer<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                anchor_lang::AccountsExit::exit(&self.buffer, program_id)
                    .map_err(|e| e.with_account_name("buffer"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_create_buffer {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlCreateBuffer`].
            pub struct IdlCreateBuffer {
                pub buffer: anchor_lang::solana_program::pubkey::Pubkey,
                pub authority: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlCreateBuffer
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.buffer, writer)?;
                    borsh::BorshSerialize::serialize(&self.authority, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlCreateBuffer {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.buffer,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.authority,
                                true,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_create_buffer {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlCreateBuffer`].
            pub struct IdlCreateBuffer<'info> {
                pub buffer: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub authority: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlCreateBuffer<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.buffer),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.authority),
                                true,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCreateBuffer<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.buffer),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.authority,
                            ),
                        );
                    account_infos
                }
            }
        }
        pub struct IdlSetBuffer<'info> {
            #[account(mut, constraint = buffer.authority = = idl.authority)]
            pub buffer: Account<'info, IdlAccount>,
            #[account(mut, has_one = authority)]
            pub idl: Account<'info, IdlAccount>,
            #[account(constraint = authority.key!= &ERASED_AUTHORITY)]
            pub authority: Signer<'info>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlSetBuffer<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                let buffer: anchor_lang::accounts::account::Account<IdlAccount> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("buffer"))?;
                let idl: anchor_lang::accounts::account::Account<IdlAccount> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("idl"))?;
                let authority: Signer = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("authority"))?;
                if !buffer.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("buffer"),
                    );
                }
                if !(buffer.authority == idl.authority) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("buffer"),
                    );
                }
                if !idl.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("idl"),
                    );
                }
                {
                    let my_key = idl.authority;
                    let target_key = authority.key();
                    if my_key != target_key {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintHasOne,
                                )
                                .with_account_name("idl")
                                .with_pubkeys((my_key, target_key)),
                        );
                    }
                }
                if !(authority.key != &ERASED_AUTHORITY) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("authority"),
                    );
                }
                Ok(IdlSetBuffer {
                    buffer,
                    idl,
                    authority,
                })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlSetBuffer<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.buffer.to_account_infos());
                account_infos.extend(self.idl.to_account_infos());
                account_infos.extend(self.authority.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlSetBuffer<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.buffer.to_account_metas(None));
                account_metas.extend(self.idl.to_account_metas(None));
                account_metas.extend(self.authority.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlSetBuffer<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                anchor_lang::AccountsExit::exit(&self.buffer, program_id)
                    .map_err(|e| e.with_account_name("buffer"))?;
                anchor_lang::AccountsExit::exit(&self.idl, program_id)
                    .map_err(|e| e.with_account_name("idl"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_set_buffer {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlSetBuffer`].
            pub struct IdlSetBuffer {
                pub buffer: anchor_lang::solana_program::pubkey::Pubkey,
                pub idl: anchor_lang::solana_program::pubkey::Pubkey,
                pub authority: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlSetBuffer
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.buffer, writer)?;
                    borsh::BorshSerialize::serialize(&self.idl, writer)?;
                    borsh::BorshSerialize::serialize(&self.authority, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlSetBuffer {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.buffer,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.idl,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.authority,
                                true,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_set_buffer {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlSetBuffer`].
            pub struct IdlSetBuffer<'info> {
                pub buffer: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub idl: anchor_lang::solana_program::account_info::AccountInfo<'info>,
                pub authority: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlSetBuffer<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.buffer),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.idl),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.authority),
                                true,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlSetBuffer<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.buffer),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.idl),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.authority,
                            ),
                        );
                    account_infos
                }
            }
        }
        pub struct IdlCloseAccount<'info> {
            #[account(mut, has_one = authority, close = sol_destination)]
            pub account: Account<'info, IdlAccount>,
            #[account(constraint = authority.key!= &ERASED_AUTHORITY)]
            pub authority: Signer<'info>,
            #[account(mut)]
            pub sol_destination: AccountInfo<'info>,
        }
        #[automatically_derived]
        impl<'info> anchor_lang::Accounts<'info> for IdlCloseAccount<'info>
        where
            'info: 'info,
        {
            #[inline(never)]
            fn try_accounts(
                __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
                __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >],
                __ix_data: &[u8],
                __bumps: &mut std::collections::BTreeMap<String, u8>,
                __reallocs: &mut std::collections::BTreeSet<
                    anchor_lang::solana_program::pubkey::Pubkey,
                >,
            ) -> anchor_lang::Result<Self> {
                let account: anchor_lang::accounts::account::Account<IdlAccount> = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("account"))?;
                let authority: Signer = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("authority"))?;
                let sol_destination: AccountInfo = anchor_lang::Accounts::try_accounts(
                        __program_id,
                        __accounts,
                        __ix_data,
                        __bumps,
                        __reallocs,
                    )
                    .map_err(|e| e.with_account_name("sol_destination"))?;
                if !account.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("account"),
                    );
                }
                {
                    let my_key = account.authority;
                    let target_key = authority.key();
                    if my_key != target_key {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintHasOne,
                                )
                                .with_account_name("account")
                                .with_pubkeys((my_key, target_key)),
                        );
                    }
                }
                {
                    if account.key() == sol_destination.key() {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintClose,
                                )
                                .with_account_name("account"),
                        );
                    }
                }
                if !(authority.key != &ERASED_AUTHORITY) {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintRaw,
                            )
                            .with_account_name("authority"),
                    );
                }
                if !sol_destination.to_account_info().is_writable {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintMut,
                            )
                            .with_account_name("sol_destination"),
                    );
                }
                Ok(IdlCloseAccount {
                    account,
                    authority,
                    sol_destination,
                })
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCloseAccount<'info>
        where
            'info: 'info,
        {
            fn to_account_infos(
                &self,
            ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                let mut account_infos = ::alloc::vec::Vec::new();
                account_infos.extend(self.account.to_account_infos());
                account_infos.extend(self.authority.to_account_infos());
                account_infos.extend(self.sol_destination.to_account_infos());
                account_infos
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::ToAccountMetas for IdlCloseAccount<'info> {
            fn to_account_metas(
                &self,
                is_signer: Option<bool>,
            ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                let mut account_metas = ::alloc::vec::Vec::new();
                account_metas.extend(self.account.to_account_metas(None));
                account_metas.extend(self.authority.to_account_metas(None));
                account_metas.extend(self.sol_destination.to_account_metas(None));
                account_metas
            }
        }
        #[automatically_derived]
        impl<'info> anchor_lang::AccountsExit<'info> for IdlCloseAccount<'info>
        where
            'info: 'info,
        {
            fn exit(
                &self,
                program_id: &anchor_lang::solana_program::pubkey::Pubkey,
            ) -> anchor_lang::Result<()> {
                {
                    let sol_destination = &self.sol_destination;
                    anchor_lang::AccountsClose::close(
                            &self.account,
                            sol_destination.to_account_info(),
                        )
                        .map_err(|e| e.with_account_name("account"))?;
                }
                anchor_lang::AccountsExit::exit(&self.sol_destination, program_id)
                    .map_err(|e| e.with_account_name("sol_destination"))?;
                Ok(())
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
        /// instead of an `AccountInfo`. This is useful for clients that want
        /// to generate a list of accounts, without explicitly knowing the
        /// order all the fields should be in.
        ///
        /// To access the struct in this module, one should use the sibling
        /// `accounts` module (also generated), which re-exports this.
        pub(crate) mod __client_accounts_idl_close_account {
            use super::*;
            use anchor_lang::prelude::borsh;
            /// Generated client accounts for [`IdlCloseAccount`].
            pub struct IdlCloseAccount {
                pub account: anchor_lang::solana_program::pubkey::Pubkey,
                pub authority: anchor_lang::solana_program::pubkey::Pubkey,
                pub sol_destination: anchor_lang::solana_program::pubkey::Pubkey,
            }
            impl borsh::ser::BorshSerialize for IdlCloseAccount
            where
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
                anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
            {
                fn serialize<W: borsh::maybestd::io::Write>(
                    &self,
                    writer: &mut W,
                ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                    borsh::BorshSerialize::serialize(&self.account, writer)?;
                    borsh::BorshSerialize::serialize(&self.authority, writer)?;
                    borsh::BorshSerialize::serialize(&self.sol_destination, writer)?;
                    Ok(())
                }
            }
            #[automatically_derived]
            impl anchor_lang::ToAccountMetas for IdlCloseAccount {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.account,
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                self.authority,
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                self.sol_destination,
                                false,
                            ),
                        );
                    account_metas
                }
            }
        }
        /// An internal, Anchor generated module. This is used (as an
        /// implementation detail), to generate a CPI struct for a given
        /// `#[derive(Accounts)]` implementation, where each field is an
        /// AccountInfo.
        ///
        /// To access the struct in this module, one should use the sibling
        /// [`cpi::accounts`] module (also generated), which re-exports this.
        pub(crate) mod __cpi_client_accounts_idl_close_account {
            use super::*;
            /// Generated CPI struct of the accounts for [`IdlCloseAccount`].
            pub struct IdlCloseAccount<'info> {
                pub account: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub authority: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
                pub sol_destination: anchor_lang::solana_program::account_info::AccountInfo<
                    'info,
                >,
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountMetas for IdlCloseAccount<'info> {
                fn to_account_metas(
                    &self,
                    is_signer: Option<bool>,
                ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
                    let mut account_metas = ::alloc::vec::Vec::new();
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.account),
                                false,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                                anchor_lang::Key::key(&self.authority),
                                true,
                            ),
                        );
                    account_metas
                        .push(
                            anchor_lang::solana_program::instruction::AccountMeta::new(
                                anchor_lang::Key::key(&self.sol_destination),
                                false,
                            ),
                        );
                    account_metas
                }
            }
            #[automatically_derived]
            impl<'info> anchor_lang::ToAccountInfos<'info> for IdlCloseAccount<'info> {
                fn to_account_infos(
                    &self,
                ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
                    let mut account_infos = ::alloc::vec::Vec::new();
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(&self.account),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.authority,
                            ),
                        );
                    account_infos
                        .extend(
                            anchor_lang::ToAccountInfos::to_account_infos(
                                &self.sol_destination,
                            ),
                        );
                    account_infos
                }
            }
        }
        use std::cell::{Ref, RefMut};
        pub trait IdlTrailingData<'info> {
            fn trailing_data(self) -> Ref<'info, [u8]>;
            fn trailing_data_mut(self) -> RefMut<'info, [u8]>;
        }
        impl<'a, 'info: 'a> IdlTrailingData<'a> for &'a Account<'info, IdlAccount> {
            fn trailing_data(self) -> Ref<'a, [u8]> {
                let info: &AccountInfo<'info> = self.as_ref();
                Ref::map(info.try_borrow_data().unwrap(), |d| &d[44..])
            }
            fn trailing_data_mut(self) -> RefMut<'a, [u8]> {
                let info: &AccountInfo<'info> = self.as_ref();
                RefMut::map(info.try_borrow_mut_data().unwrap(), |d| &mut d[44..])
            }
        }
        #[inline(never)]
        pub fn __idl_create_account(
            program_id: &Pubkey,
            accounts: &mut IdlCreateAccounts,
            data_len: u64,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlCreateAccount");
            if program_id != accounts.program.key {
                return Err(
                    anchor_lang::error::ErrorCode::IdlInstructionInvalidProgram.into(),
                );
            }
            let from = accounts.from.key;
            let (base, nonce) = Pubkey::find_program_address(&[], program_id);
            let seed = IdlAccount::seed();
            let owner = accounts.program.key;
            let to = Pubkey::create_with_seed(&base, seed, owner).unwrap();
            let space = std::cmp::min(8 + 32 + 4 + data_len as usize, 10_000);
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(space);
            let seeds = &[&[nonce][..]];
            let ix = anchor_lang::solana_program::system_instruction::create_account_with_seed(
                from,
                &to,
                &base,
                seed,
                lamports,
                space as u64,
                owner,
            );
            anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &[
                    accounts.from.clone(),
                    accounts.to.clone(),
                    accounts.base.clone(),
                    accounts.system_program.to_account_info().clone(),
                ],
                &[seeds],
            )?;
            let mut idl_account = {
                let mut account_data = accounts.to.try_borrow_data()?;
                let mut account_data_slice: &[u8] = &account_data;
                IdlAccount::try_deserialize_unchecked(&mut account_data_slice)?
            };
            idl_account.authority = *accounts.from.key;
            let mut data = accounts.to.try_borrow_mut_data()?;
            let dst: &mut [u8] = &mut data;
            let mut cursor = std::io::Cursor::new(dst);
            idl_account.try_serialize(&mut cursor)?;
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_resize_account(
            program_id: &Pubkey,
            accounts: &mut IdlResizeAccount,
            data_len: u64,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlResizeAccount");
            let data_len: usize = data_len as usize;
            if accounts.idl.data_len != 0 {
                return Err(anchor_lang::error::ErrorCode::IdlAccountNotEmpty.into());
            }
            let new_account_space = accounts
                .idl
                .to_account_info()
                .data_len()
                .checked_add(
                    std::cmp::min(
                        data_len
                            .checked_sub(accounts.idl.to_account_info().data_len())
                            .expect(
                                "data_len should always be >= the current account space",
                            ),
                        10_000,
                    ),
                )
                .unwrap();
            if new_account_space > accounts.idl.to_account_info().data_len() {
                let sysvar_rent = Rent::get()?;
                let new_rent_minimum = sysvar_rent.minimum_balance(new_account_space);
                anchor_lang::system_program::transfer(
                    anchor_lang::context::CpiContext::new(
                        accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: accounts.authority.to_account_info(),
                            to: accounts.idl.to_account_info().clone(),
                        },
                    ),
                    new_rent_minimum
                        .checked_sub(accounts.idl.to_account_info().lamports())
                        .unwrap(),
                )?;
                accounts.idl.to_account_info().realloc(new_account_space, false)?;
            }
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_close_account(
            program_id: &Pubkey,
            accounts: &mut IdlCloseAccount,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlCloseAccount");
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_create_buffer(
            program_id: &Pubkey,
            accounts: &mut IdlCreateBuffer,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlCreateBuffer");
            let mut buffer = &mut accounts.buffer;
            buffer.authority = *accounts.authority.key;
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_write(
            program_id: &Pubkey,
            accounts: &mut IdlAccounts,
            idl_data: Vec<u8>,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlWrite");
            let prev_len: usize = ::std::convert::TryInto::<
                usize,
            >::try_into(accounts.idl.data_len)
                .unwrap();
            let new_len: usize = prev_len.checked_add(idl_data.len()).unwrap() as usize;
            accounts
                .idl
                .data_len = accounts
                .idl
                .data_len
                .checked_add(
                    ::std::convert::TryInto::<u32>::try_into(idl_data.len()).unwrap(),
                )
                .unwrap();
            use IdlTrailingData;
            let mut idl_bytes = accounts.idl.trailing_data_mut();
            let idl_expansion = &mut idl_bytes[prev_len..new_len];
            if idl_expansion.len() != idl_data.len() {
                return Err(
                    anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                            error_name: anchor_lang::error::ErrorCode::RequireEqViolated
                                .name(),
                            error_code_number: anchor_lang::error::ErrorCode::RequireEqViolated
                                .into(),
                            error_msg: anchor_lang::error::ErrorCode::RequireEqViolated
                                .to_string(),
                            error_origin: Some(
                                anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                    filename: "programs/pyth-solana-receiver/src/lib.rs",
                                    line: 57u32,
                                }),
                            ),
                            compared_values: None,
                        })
                        .with_values((idl_expansion.len(), idl_data.len())),
                );
            }
            idl_expansion.copy_from_slice(&idl_data[..]);
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_set_authority(
            program_id: &Pubkey,
            accounts: &mut IdlAccounts,
            new_authority: Pubkey,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlSetAuthority");
            accounts.idl.authority = new_authority;
            Ok(())
        }
        #[inline(never)]
        pub fn __idl_set_buffer(
            program_id: &Pubkey,
            accounts: &mut IdlSetBuffer,
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: IdlSetBuffer");
            accounts.idl.data_len = accounts.buffer.data_len;
            use IdlTrailingData;
            let buffer_len = ::std::convert::TryInto::<
                usize,
            >::try_into(accounts.buffer.data_len)
                .unwrap();
            let mut target = accounts.idl.trailing_data_mut();
            let source = &accounts.buffer.trailing_data()[..buffer_len];
            if target.len() < buffer_len {
                return Err(
                    anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                            error_name: anchor_lang::error::ErrorCode::RequireGteViolated
                                .name(),
                            error_code_number: anchor_lang::error::ErrorCode::RequireGteViolated
                                .into(),
                            error_msg: anchor_lang::error::ErrorCode::RequireGteViolated
                                .to_string(),
                            error_origin: Some(
                                anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                    filename: "programs/pyth-solana-receiver/src/lib.rs",
                                    line: 57u32,
                                }),
                            ),
                            compared_values: None,
                        })
                        .with_values((target.len(), buffer_len)),
                );
            }
            target[..buffer_len].copy_from_slice(source);
            Ok(())
        }
    }
    /// __global mod defines wrapped handlers for global instructions.
    pub mod __global {
        use super::*;
        #[inline(never)]
        pub fn initialize(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: Initialize");
            let ix = instruction::Initialize::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::Initialize { initial_config } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = Initialize::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::initialize(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                initial_config,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn request_governance_authority_transfer(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log(
                "Instruction: RequestGovernanceAuthorityTransfer",
            );
            let ix = instruction::RequestGovernanceAuthorityTransfer::deserialize(
                    &mut &__ix_data[..],
                )
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::RequestGovernanceAuthorityTransfer {
                target_governance_authority,
            } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = Governance::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::request_governance_authority_transfer(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                target_governance_authority,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn authorize_governance_authority_transfer(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log(
                "Instruction: AuthorizeGovernanceAuthorityTransfer",
            );
            let ix = instruction::AuthorizeGovernanceAuthorityTransfer::deserialize(
                    &mut &__ix_data[..],
                )
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::AuthorizeGovernanceAuthorityTransfer = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = AuthorizeGovernanceAuthorityTransfer::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::authorize_governance_authority_transfer(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn set_data_sources(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: SetDataSources");
            let ix = instruction::SetDataSources::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::SetDataSources { valid_data_sources } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = Governance::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::set_data_sources(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                valid_data_sources,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn set_fee(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: SetFee");
            let ix = instruction::SetFee::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::SetFee { single_update_fee_in_lamports } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = Governance::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::set_fee(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                single_update_fee_in_lamports,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn set_wormhole_address(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: SetWormholeAddress");
            let ix = instruction::SetWormholeAddress::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::SetWormholeAddress { wormhole } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = Governance::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::set_wormhole_address(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                wormhole,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn post_updates_atomic(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: PostUpdatesAtomic");
            let ix = instruction::PostUpdatesAtomic::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::PostUpdatesAtomic { params } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = PostUpdatesAtomic::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::post_updates_atomic(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                params,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn post_updates(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: PostUpdates");
            let ix = instruction::PostUpdates::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::PostUpdates { price_update } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = PostUpdates::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::post_updates(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                price_update,
            )?;
            __accounts.exit(__program_id)
        }
    }
}
pub mod pyth_solana_receiver {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, initial_config: Config) -> Result<()> {
        let config = &mut ctx.accounts.config;
        **config = initial_config;
        Ok(())
    }
    pub fn request_governance_authority_transfer(
        ctx: Context<Governance>,
        target_governance_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.target_governance_authority = Some(target_governance_authority);
        Ok(())
    }
    pub fn authorize_governance_authority_transfer(
        ctx: Context<AuthorizeGovernanceAuthorityTransfer>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config
            .governance_authority = config
            .target_governance_authority
            .ok_or(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                        .name(),
                    error_code_number: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                        .into(),
                    error_msg: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                        .to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 80u32,
                        }),
                    ),
                    compared_values: None,
                }),
            )?;
        config.target_governance_authority = None;
        Ok(())
    }
    pub fn set_data_sources(
        ctx: Context<Governance>,
        valid_data_sources: Vec<DataSource>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.valid_data_sources = valid_data_sources;
        Ok(())
    }
    pub fn set_fee(
        ctx: Context<Governance>,
        single_update_fee_in_lamports: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.single_update_fee_in_lamports = single_update_fee_in_lamports;
        Ok(())
    }
    pub fn set_wormhole_address(
        ctx: Context<Governance>,
        wormhole: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.wormhole = wormhole;
        Ok(())
    }
    pub fn post_updates_atomic(
        ctx: Context<PostUpdatesAtomic>,
        params: PostUpdatesAtomicParams,
    ) -> Result<()> {
        let vaa = Vaa::parse(&params.vaa)
            .map_err(|_| ReceiverError::DeserializeVaaFailed)?;
        if vaa.version() != 1 {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::InvalidVaaVersion.name(),
                        error_code_number: ReceiverError::InvalidVaaVersion.into(),
                        error_msg: ReceiverError::InvalidVaaVersion.to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 114u32,
                            }),
                        ),
                        compared_values: None,
                    })
                    .with_values((vaa.version(), 1)),
            );
        }
        let guardian_set = ctx.accounts.guardian_set.inner();
        if vaa.guardian_set_index() != guardian_set.index {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::GuardianSetMismatch.name(),
                        error_code_number: ReceiverError::GuardianSetMismatch.into(),
                        error_msg: ReceiverError::GuardianSetMismatch.to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 118u32,
                            }),
                        ),
                        compared_values: None,
                    })
                    .with_values((vaa.guardian_set_index(), guardian_set.index)),
            );
        }
        let guardian_keys = &guardian_set.keys;
        let digest = keccak::hash(keccak::hash(vaa.body().as_ref()).as_ref());
        let mut last_guardian_index = None;
        for sig in vaa.signatures() {
            let index = usize::from(sig.guardian_index());
            if let Some(last_index) = last_guardian_index {
                if !(index > last_index) {
                    return Err(
                        anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                            error_name: ReceiverError::InvalidGuardianIndex.name(),
                            error_code_number: ReceiverError::InvalidGuardianIndex
                                .into(),
                            error_msg: ReceiverError::InvalidGuardianIndex.to_string(),
                            error_origin: Some(
                                anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                    filename: "programs/pyth-solana-receiver/src/lib.rs",
                                    line: 137u32,
                                }),
                            ),
                            compared_values: None,
                        }),
                    );
                }
            }
            let guardian_pubkey = guardian_keys
                .get(index)
                .ok_or_else(|| anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InvalidGuardianIndex.name(),
                    error_code_number: ReceiverError::InvalidGuardianIndex.into(),
                    error_msg: ReceiverError::InvalidGuardianIndex.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 143u32,
                        }),
                    ),
                    compared_values: None,
                }))?;
            verify_guardian_signature(&sig, guardian_pubkey, digest.as_ref())?;
            last_guardian_index = Some(index);
        }
        let config = &ctx.accounts.config;
        let payer = &ctx.accounts.payer;
        let treasury = &ctx.accounts.treasury;
        let price_update_account = &mut ctx.accounts.price_update_account;
        if payer.lamports()
            < Rent::get()?
                .minimum_balance(0)
                .saturating_add(config.single_update_fee_in_lamports)
        {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InsufficientFunds.name(),
                    error_code_number: ReceiverError::InsufficientFunds.into(),
                    error_msg: ReceiverError::InsufficientFunds.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 161u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let transfer_instruction = system_instruction::transfer(
            payer.key,
            treasury.key,
            config.single_update_fee_in_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
            ],
        )?;
        let valid_data_source = config
            .valid_data_sources
            .iter()
            .any(|x| {
                *x
                    == DataSource {
                        chain: vaa.body().emitter_chain(),
                        emitter: Pubkey::from(vaa.body().emitter_address()),
                    }
            });
        if !valid_data_source {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InvalidDataSource.name(),
                    error_code_number: ReceiverError::InvalidDataSource.into(),
                    error_msg: ReceiverError::InvalidDataSource.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 185u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let wormhole_message = WormholeMessage::try_from_bytes(vaa.payload())
            .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
        let root: MerkleRoot<Keccak160> = MerkleRoot::new(
            match wormhole_message.payload {
                WormholePayload::Merkle(merkle_root) => merkle_root.root,
            },
        );
        if !root
            .check(
                params.merkle_price_update.proof,
                params.merkle_price_update.message.as_ref(),
            )
        {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InvalidPriceUpdate.name(),
                    error_code_number: ReceiverError::InvalidPriceUpdate.into(),
                    error_msg: ReceiverError::InvalidPriceUpdate.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 198u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let message = from_slice::<
            byteorder::BE,
            Message,
        >(params.merkle_price_update.message.as_ref())
            .map_err(|_| ReceiverError::DeserializeMessageFailed)?;
        match message {
            Message::PriceFeedMessage(price_feed_message) => {
                price_update_account.write_authority = payer.key();
                price_update_account.verified_signatures = vaa.signature_count();
                price_update_account.price_message = price_feed_message;
            }
            Message::TwapMessage(_) => {
                return Err(
                    anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::UnsupportedMessageType.name(),
                        error_code_number: ReceiverError::UnsupportedMessageType.into(),
                        error_msg: ReceiverError::UnsupportedMessageType.to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 212u32,
                            }),
                        ),
                        compared_values: None,
                    }),
                );
            }
        }
        Ok(())
    }
    /// Post a price update using an encoded_vaa account and a MerklePriceUpdate calldata.
    /// This should be called after the client has already verified the Vaa via the Wormhole contract.
    /// Check out target_chains/solana/cli/src/main.rs for an example of how to do this.
    pub fn post_updates(
        ctx: Context<PostUpdates>,
        price_update: MerklePriceUpdate,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let payer = &ctx.accounts.payer;
        let encoded_vaa = &ctx.accounts.encoded_vaa;
        let treasury = &ctx.accounts.treasury;
        let price_update_account = &mut ctx.accounts.price_update_account;
        if payer.lamports()
            < Rent::get()?
                .minimum_balance(0)
                .saturating_add(config.single_update_fee_in_lamports)
        {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InsufficientFunds.name(),
                    error_code_number: ReceiverError::InsufficientFunds.into(),
                    error_msg: ReceiverError::InsufficientFunds.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 235u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let transfer_instruction = system_instruction::transfer(
            payer.key,
            treasury.key,
            config.single_update_fee_in_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
            ],
        )?;
        let (_, body): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(
                &ctx.accounts.encoded_vaa.buf,
            )
            .unwrap();
        let valid_data_source = config
            .valid_data_sources
            .iter()
            .any(|x| {
                *x
                    == DataSource {
                        chain: body.emitter_chain.into(),
                        emitter: Pubkey::from(body.emitter_address.0),
                    }
            });
        if !valid_data_source {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InvalidDataSource.name(),
                    error_code_number: ReceiverError::InvalidDataSource.into(),
                    error_msg: ReceiverError::InvalidDataSource.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 261u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let wormhole_message = WormholeMessage::try_from_bytes(body.payload)
            .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
        let root: MerkleRoot<Keccak160> = MerkleRoot::new(
            match wormhole_message.payload {
                WormholePayload::Merkle(merkle_root) => merkle_root.root,
            },
        );
        if !root.check(price_update.proof, price_update.message.as_ref()) {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::InvalidPriceUpdate.name(),
                    error_code_number: ReceiverError::InvalidPriceUpdate.into(),
                    error_msg: ReceiverError::InvalidPriceUpdate.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 271u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        let message = from_slice::<byteorder::BE, Message>(price_update.message.as_ref())
            .map_err(|_| ReceiverError::DeserializeMessageFailed)?;
        match message {
            Message::PriceFeedMessage(price_feed_message) => {
                price_update_account.write_authority = payer.key();
                price_update_account
                    .verified_signatures = encoded_vaa.header.verified_signatures;
                price_update_account.price_message = price_feed_message;
            }
            Message::TwapMessage(_) => {
                return Err(
                    anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::UnsupportedMessageType.name(),
                        error_code_number: ReceiverError::UnsupportedMessageType.into(),
                        error_msg: ReceiverError::UnsupportedMessageType.to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 284u32,
                            }),
                        ),
                        compared_values: None,
                    }),
                );
            }
        }
        Ok(())
    }
}
/// An Anchor generated module containing the program's set of
/// instructions, where each method handler in the `#[program]` mod is
/// associated with a struct defining the input arguments to the
/// method. These should be used directly, when one wants to serialize
/// Anchor instruction data, for example, when speciying
/// instructions on a client.
pub mod instruction {
    use super::*;
    /// Instruction.
    pub struct Initialize {
        pub initial_config: Config,
    }
    impl borsh::ser::BorshSerialize for Initialize
    where
        Config: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.initial_config, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for Initialize
    where
        Config: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                initial_config: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for Initialize {
        const DISCRIMINATOR: [u8; 8] = [175, 175, 109, 31, 13, 152, 155, 237];
    }
    impl anchor_lang::InstructionData for Initialize {}
    impl anchor_lang::Owner for Initialize {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct RequestGovernanceAuthorityTransfer {
        pub target_governance_authority: Pubkey,
    }
    impl borsh::ser::BorshSerialize for RequestGovernanceAuthorityTransfer
    where
        Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.target_governance_authority, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for RequestGovernanceAuthorityTransfer
    where
        Pubkey: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                target_governance_authority: borsh::BorshDeserialize::deserialize_reader(
                    reader,
                )?,
            })
        }
    }
    impl anchor_lang::Discriminator for RequestGovernanceAuthorityTransfer {
        const DISCRIMINATOR: [u8; 8] = [92, 18, 67, 156, 27, 151, 183, 224];
    }
    impl anchor_lang::InstructionData for RequestGovernanceAuthorityTransfer {}
    impl anchor_lang::Owner for RequestGovernanceAuthorityTransfer {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct AuthorizeGovernanceAuthorityTransfer;
    impl borsh::ser::BorshSerialize for AuthorizeGovernanceAuthorityTransfer {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for AuthorizeGovernanceAuthorityTransfer {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {})
        }
    }
    impl anchor_lang::Discriminator for AuthorizeGovernanceAuthorityTransfer {
        const DISCRIMINATOR: [u8; 8] = [182, 43, 137, 161, 34, 155, 60, 206];
    }
    impl anchor_lang::InstructionData for AuthorizeGovernanceAuthorityTransfer {}
    impl anchor_lang::Owner for AuthorizeGovernanceAuthorityTransfer {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct SetDataSources {
        pub valid_data_sources: Vec<DataSource>,
    }
    impl borsh::ser::BorshSerialize for SetDataSources
    where
        Vec<DataSource>: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.valid_data_sources, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for SetDataSources
    where
        Vec<DataSource>: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                valid_data_sources: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for SetDataSources {
        const DISCRIMINATOR: [u8; 8] = [107, 73, 15, 119, 195, 116, 91, 210];
    }
    impl anchor_lang::InstructionData for SetDataSources {}
    impl anchor_lang::Owner for SetDataSources {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct SetFee {
        pub single_update_fee_in_lamports: u64,
    }
    impl borsh::ser::BorshSerialize for SetFee
    where
        u64: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(
                &self.single_update_fee_in_lamports,
                writer,
            )?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for SetFee
    where
        u64: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                single_update_fee_in_lamports: borsh::BorshDeserialize::deserialize_reader(
                    reader,
                )?,
            })
        }
    }
    impl anchor_lang::Discriminator for SetFee {
        const DISCRIMINATOR: [u8; 8] = [18, 154, 24, 18, 237, 214, 19, 80];
    }
    impl anchor_lang::InstructionData for SetFee {}
    impl anchor_lang::Owner for SetFee {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct SetWormholeAddress {
        pub wormhole: Pubkey,
    }
    impl borsh::ser::BorshSerialize for SetWormholeAddress
    where
        Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.wormhole, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for SetWormholeAddress
    where
        Pubkey: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                wormhole: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for SetWormholeAddress {
        const DISCRIMINATOR: [u8; 8] = [154, 174, 252, 157, 91, 215, 179, 156];
    }
    impl anchor_lang::InstructionData for SetWormholeAddress {}
    impl anchor_lang::Owner for SetWormholeAddress {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct PostUpdatesAtomic {
        pub params: PostUpdatesAtomicParams,
    }
    impl borsh::ser::BorshSerialize for PostUpdatesAtomic
    where
        PostUpdatesAtomicParams: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.params, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for PostUpdatesAtomic
    where
        PostUpdatesAtomicParams: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                params: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for PostUpdatesAtomic {
        const DISCRIMINATOR: [u8; 8] = [147, 192, 152, 223, 228, 211, 106, 148];
    }
    impl anchor_lang::InstructionData for PostUpdatesAtomic {}
    impl anchor_lang::Owner for PostUpdatesAtomic {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct PostUpdates {
        pub price_update: MerklePriceUpdate,
    }
    impl borsh::ser::BorshSerialize for PostUpdates
    where
        MerklePriceUpdate: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.price_update, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for PostUpdates
    where
        MerklePriceUpdate: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                price_update: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for PostUpdates {
        const DISCRIMINATOR: [u8; 8] = [97, 27, 115, 5, 122, 60, 89, 47];
    }
    impl anchor_lang::InstructionData for PostUpdates {}
    impl anchor_lang::Owner for PostUpdates {
        fn owner() -> Pubkey {
            ID
        }
    }
}
/// An Anchor generated module, providing a set of structs
/// mirroring the structs deriving `Accounts`, where each field is
/// a `Pubkey`. This is useful for specifying accounts for a client.
pub mod accounts {
    pub use crate::__client_accounts_authorize_governance_authority_transfer::*;
    pub use crate::__client_accounts_initialize::*;
    pub use crate::__client_accounts_governance::*;
    pub use crate::__client_accounts_post_updates::*;
    pub use crate::__client_accounts_post_updates_atomic::*;
}
pub const CONFIG_SEED: &str = "config";
pub const TREASURY_SEED: &str = "treasury";
#[instruction(initial_config:Config)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        space = Config::LEN,
        payer = payer,
        seeds = [CONFIG_SEED.as_ref()],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for Initialize<'info>
where
    'info: 'info,
{
    #[inline(never)]
    fn try_accounts(
        __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
        __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >],
        __ix_data: &[u8],
        __bumps: &mut std::collections::BTreeMap<String, u8>,
        __reallocs: &mut std::collections::BTreeSet<
            anchor_lang::solana_program::pubkey::Pubkey,
        >,
    ) -> anchor_lang::Result<Self> {
        let mut __ix_data = __ix_data;
        struct __Args {
            initial_config: Config,
        }
        impl borsh::ser::BorshSerialize for __Args
        where
            Config: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.initial_config, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for __Args
        where
            Config: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    initial_config: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        let __Args { initial_config } = __Args::deserialize(&mut __ix_data)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotDeserialize)?;
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        if __accounts.is_empty() {
            return Err(anchor_lang::error::ErrorCode::AccountNotEnoughKeys.into());
        }
        let config = &__accounts[0];
        *__accounts = &__accounts[1..];
        let system_program: anchor_lang::accounts::program::Program<System> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("system_program"))?;
        let __anchor_rent = Rent::get()?;
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[CONFIG_SEED.as_ref()],
            __program_id,
        );
        __bumps.insert("config".to_string(), __bump);
        if config.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("config")
                    .with_pubkeys((config.key(), __pda_address)),
            );
        }
        let config = {
            let actual_field = config.to_account_info();
            let actual_owner = actual_field.owner;
            let space = Config::LEN;
            let pa: anchor_lang::accounts::account::Account<Config> = if !false
                || actual_owner == &anchor_lang::solana_program::system_program::ID
            {
                let __current_lamports = config.lamports();
                if __current_lamports == 0 {
                    let space = space;
                    let lamports = __anchor_rent.minimum_balance(space);
                    let cpi_accounts = anchor_lang::system_program::CreateAccount {
                        from: payer.to_account_info(),
                        to: config.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::create_account(
                        cpi_context
                            .with_signer(&[&[CONFIG_SEED.as_ref(), &[__bump][..]][..]]),
                        lamports,
                        space as u64,
                        __program_id,
                    )?;
                } else {
                    if payer.key() == config.key() {
                        return Err(
                            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                    error_name: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .name(),
                                    error_code_number: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .into(),
                                    error_msg: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .to_string(),
                                    error_origin: Some(
                                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                                            line: 296u32,
                                        }),
                                    ),
                                    compared_values: None,
                                })
                                .with_pubkeys((payer.key(), config.key())),
                        );
                    }
                    let required_lamports = __anchor_rent
                        .minimum_balance(space)
                        .max(1)
                        .saturating_sub(__current_lamports);
                    if required_lamports > 0 {
                        let cpi_accounts = anchor_lang::system_program::Transfer {
                            from: payer.to_account_info(),
                            to: config.to_account_info(),
                        };
                        let cpi_context = anchor_lang::context::CpiContext::new(
                            system_program.to_account_info(),
                            cpi_accounts,
                        );
                        anchor_lang::system_program::transfer(
                            cpi_context,
                            required_lamports,
                        )?;
                    }
                    let cpi_accounts = anchor_lang::system_program::Allocate {
                        account_to_allocate: config.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::allocate(
                        cpi_context
                            .with_signer(&[&[CONFIG_SEED.as_ref(), &[__bump][..]][..]]),
                        space as u64,
                    )?;
                    let cpi_accounts = anchor_lang::system_program::Assign {
                        account_to_assign: config.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::assign(
                        cpi_context
                            .with_signer(&[&[CONFIG_SEED.as_ref(), &[__bump][..]][..]]),
                        __program_id,
                    )?;
                }
                match anchor_lang::accounts::account::Account::try_from_unchecked(
                    &config,
                ) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("config")),
                }
            } else {
                match anchor_lang::accounts::account::Account::try_from(&config) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("config")),
                }
            };
            if false {
                if space != actual_field.data_len() {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintSpace,
                            )
                            .with_account_name("config")
                            .with_values((space, actual_field.data_len())),
                    );
                }
                if actual_owner != __program_id {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintOwner,
                            )
                            .with_account_name("config")
                            .with_pubkeys((*actual_owner, *__program_id)),
                    );
                }
                {
                    let required_lamports = __anchor_rent.minimum_balance(space);
                    if pa.to_account_info().lamports() < required_lamports {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintRentExempt,
                                )
                                .with_account_name("config"),
                        );
                    }
                }
            }
            pa
        };
        if !config.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("config"),
            );
        }
        if !__anchor_rent
            .is_exempt(
                config.to_account_info().lamports(),
                config.to_account_info().try_data_len()?,
            )
        {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintRentExempt,
                    )
                    .with_account_name("config"),
            );
        }
        if !payer.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("payer"),
            );
        }
        Ok(Initialize {
            payer,
            config,
            system_program,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for Initialize<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.config.to_account_infos());
        account_infos.extend(self.system_program.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for Initialize<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.config.to_account_metas(None));
        account_metas.extend(self.system_program.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for Initialize<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        anchor_lang::AccountsExit::exit(&self.payer, program_id)
            .map_err(|e| e.with_account_name("payer"))?;
        anchor_lang::AccountsExit::exit(&self.config, program_id)
            .map_err(|e| e.with_account_name("config"))?;
        Ok(())
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a struct for a given
/// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
/// instead of an `AccountInfo`. This is useful for clients that want
/// to generate a list of accounts, without explicitly knowing the
/// order all the fields should be in.
///
/// To access the struct in this module, one should use the sibling
/// `accounts` module (also generated), which re-exports this.
pub(crate) mod __client_accounts_initialize {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`Initialize`].
    pub struct Initialize {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
        pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for Initialize
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.config, writer)?;
            borsh::BorshSerialize::serialize(&self.system_program, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for Initialize {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.payer,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.config,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.system_program,
                        false,
                    ),
                );
            account_metas
        }
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a CPI struct for a given
/// `#[derive(Accounts)]` implementation, where each field is an
/// AccountInfo.
///
/// To access the struct in this module, one should use the sibling
/// [`cpi::accounts`] module (also generated), which re-exports this.
pub(crate) mod __cpi_client_accounts_initialize {
    use super::*;
    /// Generated CPI struct of the accounts for [`Initialize`].
    pub struct Initialize<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for Initialize<'info> {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.payer),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.system_program),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for Initialize<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.system_program),
                );
            account_infos
        }
    }
}
pub struct Governance<'info> {
    #[account(
        constraint = payer.key(

        )= = config.governance_authority@ReceiverError::GovernanceAuthorityMismatch
    )]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for Governance<'info>
where
    'info: 'info,
{
    #[inline(never)]
    fn try_accounts(
        __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
        __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >],
        __ix_data: &[u8],
        __bumps: &mut std::collections::BTreeMap<String, u8>,
        __reallocs: &mut std::collections::BTreeSet<
            anchor_lang::solana_program::pubkey::Pubkey,
        >,
    ) -> anchor_lang::Result<Self> {
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let config: anchor_lang::accounts::account::Account<Config> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("config"))?;
        if !(payer.key() == config.governance_authority) {
            return Err(
                anchor_lang::error::Error::from(
                        ReceiverError::GovernanceAuthorityMismatch,
                    )
                    .with_account_name("payer"),
            );
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[CONFIG_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("config".to_string(), __bump);
        if config.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("config")
                    .with_pubkeys((config.key(), __pda_address)),
            );
        }
        Ok(Governance { payer, config })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for Governance<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.config.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for Governance<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.config.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for Governance<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        Ok(())
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a struct for a given
/// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
/// instead of an `AccountInfo`. This is useful for clients that want
/// to generate a list of accounts, without explicitly knowing the
/// order all the fields should be in.
///
/// To access the struct in this module, one should use the sibling
/// `accounts` module (also generated), which re-exports this.
pub(crate) mod __client_accounts_governance {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`Governance`].
    pub struct Governance {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for Governance
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.config, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for Governance {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.payer,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.config,
                        false,
                    ),
                );
            account_metas
        }
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a CPI struct for a given
/// `#[derive(Accounts)]` implementation, where each field is an
/// AccountInfo.
///
/// To access the struct in this module, one should use the sibling
/// [`cpi::accounts`] module (also generated), which re-exports this.
pub(crate) mod __cpi_client_accounts_governance {
    use super::*;
    /// Generated CPI struct of the accounts for [`Governance`].
    pub struct Governance<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for Governance<'info> {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.payer),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for Governance<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
            account_infos
        }
    }
}
pub struct AuthorizeGovernanceAuthorityTransfer<'info> {
    #[account(
        constraint = payer.key(

        )= = config.target_governance_authority.ok_or(
            error!(ReceiverError::NonexistentGovernanceAuthorityTransferRequest)
        )?@ReceiverError::TargetGovernanceAuthorityMismatch
    )]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for AuthorizeGovernanceAuthorityTransfer<'info>
where
    'info: 'info,
{
    #[inline(never)]
    fn try_accounts(
        __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
        __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >],
        __ix_data: &[u8],
        __bumps: &mut std::collections::BTreeMap<String, u8>,
        __reallocs: &mut std::collections::BTreeSet<
            anchor_lang::solana_program::pubkey::Pubkey,
        >,
    ) -> anchor_lang::Result<Self> {
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let config: anchor_lang::accounts::account::Account<Config> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("config"))?;
        if !(payer.key()
            == config
                .target_governance_authority
                .ok_or(
                    anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                            .name(),
                        error_code_number: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                            .into(),
                        error_msg: ReceiverError::NonexistentGovernanceAuthorityTransferRequest
                            .to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 320u32,
                            }),
                        ),
                        compared_values: None,
                    }),
                )?)
        {
            return Err(
                anchor_lang::error::Error::from(
                        ReceiverError::TargetGovernanceAuthorityMismatch,
                    )
                    .with_account_name("payer"),
            );
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[CONFIG_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("config".to_string(), __bump);
        if config.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("config")
                    .with_pubkeys((config.key(), __pda_address)),
            );
        }
        Ok(AuthorizeGovernanceAuthorityTransfer {
            payer,
            config,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info>
for AuthorizeGovernanceAuthorityTransfer<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.config.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for AuthorizeGovernanceAuthorityTransfer<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.config.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info>
for AuthorizeGovernanceAuthorityTransfer<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        Ok(())
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a struct for a given
/// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
/// instead of an `AccountInfo`. This is useful for clients that want
/// to generate a list of accounts, without explicitly knowing the
/// order all the fields should be in.
///
/// To access the struct in this module, one should use the sibling
/// `accounts` module (also generated), which re-exports this.
pub(crate) mod __client_accounts_authorize_governance_authority_transfer {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`AuthorizeGovernanceAuthorityTransfer`].
    pub struct AuthorizeGovernanceAuthorityTransfer {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for AuthorizeGovernanceAuthorityTransfer
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.config, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for AuthorizeGovernanceAuthorityTransfer {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.payer,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.config,
                        false,
                    ),
                );
            account_metas
        }
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a CPI struct for a given
/// `#[derive(Accounts)]` implementation, where each field is an
/// AccountInfo.
///
/// To access the struct in this module, one should use the sibling
/// [`cpi::accounts`] module (also generated), which re-exports this.
pub(crate) mod __cpi_client_accounts_authorize_governance_authority_transfer {
    use super::*;
    /// Generated CPI struct of the accounts for [`AuthorizeGovernanceAuthorityTransfer`].
    pub struct AuthorizeGovernanceAuthorityTransfer<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas
    for AuthorizeGovernanceAuthorityTransfer<'info> {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.payer),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info>
    for AuthorizeGovernanceAuthorityTransfer<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
            account_infos
        }
    }
}
pub struct PostUpdates<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(owner = config.wormhole)]
    pub encoded_vaa: Account<'info, EncodedVaa>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [TREASURY_SEED.as_ref()], bump)]
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    #[account(init, payer = payer, space = PriceUpdateV1::LEN)]
    pub price_update_account: Account<'info, PriceUpdateV1>,
    pub system_program: Program<'info, System>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for PostUpdates<'info>
where
    'info: 'info,
{
    #[inline(never)]
    fn try_accounts(
        __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
        __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >],
        __ix_data: &[u8],
        __bumps: &mut std::collections::BTreeMap<String, u8>,
        __reallocs: &mut std::collections::BTreeSet<
            anchor_lang::solana_program::pubkey::Pubkey,
        >,
    ) -> anchor_lang::Result<Self> {
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let encoded_vaa: anchor_lang::accounts::account::Account<EncodedVaa> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("encoded_vaa"))?;
        let config: anchor_lang::accounts::account::Account<Config> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("config"))?;
        let treasury: AccountInfo = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("treasury"))?;
        if __accounts.is_empty() {
            return Err(anchor_lang::error::ErrorCode::AccountNotEnoughKeys.into());
        }
        let price_update_account = &__accounts[0];
        *__accounts = &__accounts[1..];
        let system_program: anchor_lang::accounts::program::Program<System> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("system_program"))?;
        let __anchor_rent = Rent::get()?;
        let price_update_account = {
            let actual_field = price_update_account.to_account_info();
            let actual_owner = actual_field.owner;
            let space = PriceUpdateV1::LEN;
            let pa: anchor_lang::accounts::account::Account<PriceUpdateV1> = if !false
                || actual_owner == &anchor_lang::solana_program::system_program::ID
            {
                let __current_lamports = price_update_account.lamports();
                if __current_lamports == 0 {
                    let space = space;
                    let lamports = __anchor_rent.minimum_balance(space);
                    let cpi_accounts = anchor_lang::system_program::CreateAccount {
                        from: payer.to_account_info(),
                        to: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::create_account(
                        cpi_context.with_signer(&[]),
                        lamports,
                        space as u64,
                        __program_id,
                    )?;
                } else {
                    if payer.key() == price_update_account.key() {
                        return Err(
                            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                    error_name: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .name(),
                                    error_code_number: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .into(),
                                    error_msg: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .to_string(),
                                    error_origin: Some(
                                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                                            line: 328u32,
                                        }),
                                    ),
                                    compared_values: None,
                                })
                                .with_pubkeys((payer.key(), price_update_account.key())),
                        );
                    }
                    let required_lamports = __anchor_rent
                        .minimum_balance(space)
                        .max(1)
                        .saturating_sub(__current_lamports);
                    if required_lamports > 0 {
                        let cpi_accounts = anchor_lang::system_program::Transfer {
                            from: payer.to_account_info(),
                            to: price_update_account.to_account_info(),
                        };
                        let cpi_context = anchor_lang::context::CpiContext::new(
                            system_program.to_account_info(),
                            cpi_accounts,
                        );
                        anchor_lang::system_program::transfer(
                            cpi_context,
                            required_lamports,
                        )?;
                    }
                    let cpi_accounts = anchor_lang::system_program::Allocate {
                        account_to_allocate: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::allocate(
                        cpi_context.with_signer(&[]),
                        space as u64,
                    )?;
                    let cpi_accounts = anchor_lang::system_program::Assign {
                        account_to_assign: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::assign(
                        cpi_context.with_signer(&[]),
                        __program_id,
                    )?;
                }
                match anchor_lang::accounts::account::Account::try_from_unchecked(
                    &price_update_account,
                ) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("price_update_account")),
                }
            } else {
                match anchor_lang::accounts::account::Account::try_from(
                    &price_update_account,
                ) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("price_update_account")),
                }
            };
            if false {
                if space != actual_field.data_len() {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintSpace,
                            )
                            .with_account_name("price_update_account")
                            .with_values((space, actual_field.data_len())),
                    );
                }
                if actual_owner != __program_id {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintOwner,
                            )
                            .with_account_name("price_update_account")
                            .with_pubkeys((*actual_owner, *__program_id)),
                    );
                }
                {
                    let required_lamports = __anchor_rent.minimum_balance(space);
                    if pa.to_account_info().lamports() < required_lamports {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintRentExempt,
                                )
                                .with_account_name("price_update_account"),
                        );
                    }
                }
            }
            pa
        };
        if !price_update_account.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !price_update_account.to_account_info().is_signer {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSigner,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !__anchor_rent
            .is_exempt(
                price_update_account.to_account_info().lamports(),
                price_update_account.to_account_info().try_data_len()?,
            )
        {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintRentExempt,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !payer.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("payer"),
            );
        }
        {
            let my_owner = AsRef::<AccountInfo>::as_ref(&encoded_vaa).owner;
            let owner_address = config.wormhole;
            if my_owner != &owner_address {
                return Err(
                    anchor_lang::error::Error::from(
                            anchor_lang::error::ErrorCode::ConstraintOwner,
                        )
                        .with_account_name("encoded_vaa")
                        .with_pubkeys((*my_owner, owner_address)),
                );
            }
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[CONFIG_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("config".to_string(), __bump);
        if config.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("config")
                    .with_pubkeys((config.key(), __pda_address)),
            );
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[TREASURY_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("treasury".to_string(), __bump);
        if treasury.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("treasury")
                    .with_pubkeys((treasury.key(), __pda_address)),
            );
        }
        if !treasury.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("treasury"),
            );
        }
        Ok(PostUpdates {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdates<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.encoded_vaa.to_account_infos());
        account_infos.extend(self.config.to_account_infos());
        account_infos.extend(self.treasury.to_account_infos());
        account_infos.extend(self.price_update_account.to_account_infos());
        account_infos.extend(self.system_program.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for PostUpdates<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.encoded_vaa.to_account_metas(None));
        account_metas.extend(self.config.to_account_metas(None));
        account_metas.extend(self.treasury.to_account_metas(None));
        account_metas.extend(self.price_update_account.to_account_metas(Some(true)));
        account_metas.extend(self.system_program.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for PostUpdates<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        anchor_lang::AccountsExit::exit(&self.payer, program_id)
            .map_err(|e| e.with_account_name("payer"))?;
        anchor_lang::AccountsExit::exit(&self.treasury, program_id)
            .map_err(|e| e.with_account_name("treasury"))?;
        anchor_lang::AccountsExit::exit(&self.price_update_account, program_id)
            .map_err(|e| e.with_account_name("price_update_account"))?;
        Ok(())
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a struct for a given
/// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
/// instead of an `AccountInfo`. This is useful for clients that want
/// to generate a list of accounts, without explicitly knowing the
/// order all the fields should be in.
///
/// To access the struct in this module, one should use the sibling
/// `accounts` module (also generated), which re-exports this.
pub(crate) mod __client_accounts_post_updates {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`PostUpdates`].
    pub struct PostUpdates {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub encoded_vaa: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
        pub treasury: anchor_lang::solana_program::pubkey::Pubkey,
        pub price_update_account: anchor_lang::solana_program::pubkey::Pubkey,
        pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for PostUpdates
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.encoded_vaa, writer)?;
            borsh::BorshSerialize::serialize(&self.config, writer)?;
            borsh::BorshSerialize::serialize(&self.treasury, writer)?;
            borsh::BorshSerialize::serialize(&self.price_update_account, writer)?;
            borsh::BorshSerialize::serialize(&self.system_program, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for PostUpdates {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.payer,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.encoded_vaa,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.config,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.treasury,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.price_update_account,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.system_program,
                        false,
                    ),
                );
            account_metas
        }
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a CPI struct for a given
/// `#[derive(Accounts)]` implementation, where each field is an
/// AccountInfo.
///
/// To access the struct in this module, one should use the sibling
/// [`cpi::accounts`] module (also generated), which re-exports this.
pub(crate) mod __cpi_client_accounts_post_updates {
    use super::*;
    /// Generated CPI struct of the accounts for [`PostUpdates`].
    pub struct PostUpdates<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub encoded_vaa: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub treasury: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for PostUpdates<'info> {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.payer),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.encoded_vaa),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.treasury),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.price_update_account),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.system_program),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdates<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.encoded_vaa),
                );
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.treasury));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(
                        &self.price_update_account,
                    ),
                );
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.system_program),
                );
            account_infos
        }
    }
}
pub struct PostUpdatesAtomic<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [GuardianSet::SEED_PREFIX,
        guardian_set.inner().index.to_be_bytes().as_ref()],
        bump,
        owner = config.wormhole
    )]
    pub guardian_set: Account<'info, AccountVariant<GuardianSet>>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [TREASURY_SEED.as_ref()], bump)]
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    pub treasury: AccountInfo<'info>,
    #[account(init, payer = payer, space = PriceUpdateV1::LEN)]
    pub price_update_account: Account<'info, PriceUpdateV1>,
    pub system_program: Program<'info, System>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for PostUpdatesAtomic<'info>
where
    'info: 'info,
{
    #[inline(never)]
    fn try_accounts(
        __program_id: &anchor_lang::solana_program::pubkey::Pubkey,
        __accounts: &mut &[anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >],
        __ix_data: &[u8],
        __bumps: &mut std::collections::BTreeMap<String, u8>,
        __reallocs: &mut std::collections::BTreeSet<
            anchor_lang::solana_program::pubkey::Pubkey,
        >,
    ) -> anchor_lang::Result<Self> {
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let guardian_set: anchor_lang::accounts::account::Account<
            AccountVariant<GuardianSet>,
        > = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("guardian_set"))?;
        let config: anchor_lang::accounts::account::Account<Config> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("config"))?;
        let treasury: AccountInfo = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("treasury"))?;
        if __accounts.is_empty() {
            return Err(anchor_lang::error::ErrorCode::AccountNotEnoughKeys.into());
        }
        let price_update_account = &__accounts[0];
        *__accounts = &__accounts[1..];
        let system_program: anchor_lang::accounts::program::Program<System> = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("system_program"))?;
        let __anchor_rent = Rent::get()?;
        let price_update_account = {
            let actual_field = price_update_account.to_account_info();
            let actual_owner = actual_field.owner;
            let space = PriceUpdateV1::LEN;
            let pa: anchor_lang::accounts::account::Account<PriceUpdateV1> = if !false
                || actual_owner == &anchor_lang::solana_program::system_program::ID
            {
                let __current_lamports = price_update_account.lamports();
                if __current_lamports == 0 {
                    let space = space;
                    let lamports = __anchor_rent.minimum_balance(space);
                    let cpi_accounts = anchor_lang::system_program::CreateAccount {
                        from: payer.to_account_info(),
                        to: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::create_account(
                        cpi_context.with_signer(&[]),
                        lamports,
                        space as u64,
                        __program_id,
                    )?;
                } else {
                    if payer.key() == price_update_account.key() {
                        return Err(
                            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                                    error_name: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .name(),
                                    error_code_number: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .into(),
                                    error_msg: anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
                                        .to_string(),
                                    error_origin: Some(
                                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                                            line: 345u32,
                                        }),
                                    ),
                                    compared_values: None,
                                })
                                .with_pubkeys((payer.key(), price_update_account.key())),
                        );
                    }
                    let required_lamports = __anchor_rent
                        .minimum_balance(space)
                        .max(1)
                        .saturating_sub(__current_lamports);
                    if required_lamports > 0 {
                        let cpi_accounts = anchor_lang::system_program::Transfer {
                            from: payer.to_account_info(),
                            to: price_update_account.to_account_info(),
                        };
                        let cpi_context = anchor_lang::context::CpiContext::new(
                            system_program.to_account_info(),
                            cpi_accounts,
                        );
                        anchor_lang::system_program::transfer(
                            cpi_context,
                            required_lamports,
                        )?;
                    }
                    let cpi_accounts = anchor_lang::system_program::Allocate {
                        account_to_allocate: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::allocate(
                        cpi_context.with_signer(&[]),
                        space as u64,
                    )?;
                    let cpi_accounts = anchor_lang::system_program::Assign {
                        account_to_assign: price_update_account.to_account_info(),
                    };
                    let cpi_context = anchor_lang::context::CpiContext::new(
                        system_program.to_account_info(),
                        cpi_accounts,
                    );
                    anchor_lang::system_program::assign(
                        cpi_context.with_signer(&[]),
                        __program_id,
                    )?;
                }
                match anchor_lang::accounts::account::Account::try_from_unchecked(
                    &price_update_account,
                ) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("price_update_account")),
                }
            } else {
                match anchor_lang::accounts::account::Account::try_from(
                    &price_update_account,
                ) {
                    Ok(val) => val,
                    Err(e) => return Err(e.with_account_name("price_update_account")),
                }
            };
            if false {
                if space != actual_field.data_len() {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintSpace,
                            )
                            .with_account_name("price_update_account")
                            .with_values((space, actual_field.data_len())),
                    );
                }
                if actual_owner != __program_id {
                    return Err(
                        anchor_lang::error::Error::from(
                                anchor_lang::error::ErrorCode::ConstraintOwner,
                            )
                            .with_account_name("price_update_account")
                            .with_pubkeys((*actual_owner, *__program_id)),
                    );
                }
                {
                    let required_lamports = __anchor_rent.minimum_balance(space);
                    if pa.to_account_info().lamports() < required_lamports {
                        return Err(
                            anchor_lang::error::Error::from(
                                    anchor_lang::error::ErrorCode::ConstraintRentExempt,
                                )
                                .with_account_name("price_update_account"),
                        );
                    }
                }
            }
            pa
        };
        if !price_update_account.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !price_update_account.to_account_info().is_signer {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSigner,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !__anchor_rent
            .is_exempt(
                price_update_account.to_account_info().lamports(),
                price_update_account.to_account_info().try_data_len()?,
            )
        {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintRentExempt,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !payer.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("payer"),
            );
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[
                GuardianSet::SEED_PREFIX,
                guardian_set.inner().index.to_be_bytes().as_ref(),
            ],
            &__program_id,
        );
        __bumps.insert("guardian_set".to_string(), __bump);
        if guardian_set.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("guardian_set")
                    .with_pubkeys((guardian_set.key(), __pda_address)),
            );
        }
        {
            let my_owner = AsRef::<AccountInfo>::as_ref(&guardian_set).owner;
            let owner_address = config.wormhole;
            if my_owner != &owner_address {
                return Err(
                    anchor_lang::error::Error::from(
                            anchor_lang::error::ErrorCode::ConstraintOwner,
                        )
                        .with_account_name("guardian_set")
                        .with_pubkeys((*my_owner, owner_address)),
                );
            }
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[CONFIG_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("config".to_string(), __bump);
        if config.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("config")
                    .with_pubkeys((config.key(), __pda_address)),
            );
        }
        let (__pda_address, __bump) = Pubkey::find_program_address(
            &[TREASURY_SEED.as_ref()],
            &__program_id,
        );
        __bumps.insert("treasury".to_string(), __bump);
        if treasury.key() != __pda_address {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintSeeds,
                    )
                    .with_account_name("treasury")
                    .with_pubkeys((treasury.key(), __pda_address)),
            );
        }
        if !treasury.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("treasury"),
            );
        }
        Ok(PostUpdatesAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdatesAtomic<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.guardian_set.to_account_infos());
        account_infos.extend(self.config.to_account_infos());
        account_infos.extend(self.treasury.to_account_infos());
        account_infos.extend(self.price_update_account.to_account_infos());
        account_infos.extend(self.system_program.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for PostUpdatesAtomic<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.guardian_set.to_account_metas(None));
        account_metas.extend(self.config.to_account_metas(None));
        account_metas.extend(self.treasury.to_account_metas(None));
        account_metas.extend(self.price_update_account.to_account_metas(Some(true)));
        account_metas.extend(self.system_program.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for PostUpdatesAtomic<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        anchor_lang::AccountsExit::exit(&self.payer, program_id)
            .map_err(|e| e.with_account_name("payer"))?;
        anchor_lang::AccountsExit::exit(&self.treasury, program_id)
            .map_err(|e| e.with_account_name("treasury"))?;
        anchor_lang::AccountsExit::exit(&self.price_update_account, program_id)
            .map_err(|e| e.with_account_name("price_update_account"))?;
        Ok(())
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a struct for a given
/// `#[derive(Accounts)]` implementation, where each field is a Pubkey,
/// instead of an `AccountInfo`. This is useful for clients that want
/// to generate a list of accounts, without explicitly knowing the
/// order all the fields should be in.
///
/// To access the struct in this module, one should use the sibling
/// `accounts` module (also generated), which re-exports this.
pub(crate) mod __client_accounts_post_updates_atomic {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`PostUpdatesAtomic`].
    pub struct PostUpdatesAtomic {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub guardian_set: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
        pub treasury: anchor_lang::solana_program::pubkey::Pubkey,
        pub price_update_account: anchor_lang::solana_program::pubkey::Pubkey,
        pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for PostUpdatesAtomic
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.guardian_set, writer)?;
            borsh::BorshSerialize::serialize(&self.config, writer)?;
            borsh::BorshSerialize::serialize(&self.treasury, writer)?;
            borsh::BorshSerialize::serialize(&self.price_update_account, writer)?;
            borsh::BorshSerialize::serialize(&self.system_program, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for PostUpdatesAtomic {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.payer,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.guardian_set,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.config,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.treasury,
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        self.price_update_account,
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.system_program,
                        false,
                    ),
                );
            account_metas
        }
    }
}
/// An internal, Anchor generated module. This is used (as an
/// implementation detail), to generate a CPI struct for a given
/// `#[derive(Accounts)]` implementation, where each field is an
/// AccountInfo.
///
/// To access the struct in this module, one should use the sibling
/// [`cpi::accounts`] module (also generated), which re-exports this.
pub(crate) mod __cpi_client_accounts_post_updates_atomic {
    use super::*;
    /// Generated CPI struct of the accounts for [`PostUpdatesAtomic`].
    pub struct PostUpdatesAtomic<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub guardian_set: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub treasury: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for PostUpdatesAtomic<'info> {
        fn to_account_metas(
            &self,
            is_signer: Option<bool>,
        ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
            let mut account_metas = ::alloc::vec::Vec::new();
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.payer),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.guardian_set),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.treasury),
                        false,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.price_update_account),
                        true,
                    ),
                );
            account_metas
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.system_program),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdatesAtomic<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.guardian_set),
                );
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.config));
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.treasury));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(
                        &self.price_update_account,
                    ),
                );
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.system_program),
                );
            account_infos
        }
    }
}
pub struct PostUpdatesAtomicParams {
    pub vaa: Vec<u8>,
    pub merkle_price_update: MerklePriceUpdate,
}
#[automatically_derived]
impl ::core::fmt::Debug for PostUpdatesAtomicParams {
    fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
        ::core::fmt::Formatter::debug_struct_field2_finish(
            f,
            "PostUpdatesAtomicParams",
            "vaa",
            &self.vaa,
            "merkle_price_update",
            &&self.merkle_price_update,
        )
    }
}
impl borsh::ser::BorshSerialize for PostUpdatesAtomicParams
where
    Vec<u8>: borsh::ser::BorshSerialize,
    MerklePriceUpdate: borsh::ser::BorshSerialize,
{
    fn serialize<W: borsh::maybestd::io::Write>(
        &self,
        writer: &mut W,
    ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
        borsh::BorshSerialize::serialize(&self.vaa, writer)?;
        borsh::BorshSerialize::serialize(&self.merkle_price_update, writer)?;
        Ok(())
    }
}
impl borsh::de::BorshDeserialize for PostUpdatesAtomicParams
where
    Vec<u8>: borsh::BorshDeserialize,
    MerklePriceUpdate: borsh::BorshDeserialize,
{
    fn deserialize_reader<R: borsh::maybestd::io::Read>(
        reader: &mut R,
    ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
        Ok(Self {
            vaa: borsh::BorshDeserialize::deserialize_reader(reader)?,
            merkle_price_update: borsh::BorshDeserialize::deserialize_reader(reader)?,
        })
    }
}
#[automatically_derived]
impl ::core::clone::Clone for PostUpdatesAtomicParams {
    #[inline]
    fn clone(&self) -> PostUpdatesAtomicParams {
        PostUpdatesAtomicParams {
            vaa: ::core::clone::Clone::clone(&self.vaa),
            merkle_price_update: ::core::clone::Clone::clone(&self.merkle_price_update),
        }
    }
}
impl crate::accounts::Initialize {
    pub fn populate(payer: &Pubkey) -> Self {
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &crate::ID).0;
        crate::accounts::Initialize {
            payer: *payer,
            config,
            system_program: system_program::ID,
        }
    }
}
impl crate::accounts::PostUpdatesAtomic {
    pub fn populate(
        payer: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
    ) -> Self {
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &crate::ID).0;
        let treasury = Pubkey::find_program_address(
                &[TREASURY_SEED.as_ref()],
                &crate::ID,
            )
            .0;
        let guardian_set = Pubkey::find_program_address(
                &[GuardianSet::SEED_PREFIX, guardian_set_index.to_be_bytes().as_ref()],
                &wormhole_address,
            )
            .0;
        crate::accounts::PostUpdatesAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}
impl crate::accounts::PostUpdates {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        price_update_account: Pubkey,
    ) -> Self {
        let config = Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &crate::ID).0;
        let treasury = Pubkey::find_program_address(
                &[TREASURY_SEED.as_ref()],
                &crate::ID,
            )
            .0;
        crate::accounts::PostUpdates {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}
fn verify_guardian_signature(
    sig: &GuardianSetSig,
    guardian_pubkey: &[u8; 20],
    digest: &[u8],
) -> Result<()> {
    let recovered = {
        let pubkey = secp256k1_recover(digest, sig.recovery_id(), &sig.rs())
            .map_err(|_| ReceiverError::InvalidSignature)?;
        let hashed = keccak::hash(&pubkey.to_bytes());
        let mut eth_pubkey = [0; 20];
        sol_memcpy(&mut eth_pubkey, &hashed.0[12..], 20);
        eth_pubkey
    };
    if !(recovered == *guardian_pubkey) {
        return Err(
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: ReceiverError::InvalidGuardianKeyRecovery.name(),
                error_code_number: ReceiverError::InvalidGuardianKeyRecovery.into(),
                error_msg: ReceiverError::InvalidGuardianKeyRecovery.to_string(),
                error_origin: Some(
                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                        line: 455u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    Ok(())
}
