#![feature(prelude_import)]
#[prelude_import]
use std::prelude::rust_2021::*;
#[macro_use]
extern crate std;
pub use pythnet_sdk::wire::v1::MerklePriceUpdate;
use {
    crate::error::ReceiverError, anchor_lang::prelude::*,
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        price_update::{PriceUpdateV2, VerificationLevel},
    },
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot, hashers::keccak256_160::Keccak160,
        messages::Message, wire::{from_slice, v1::{WormholeMessage, WormholePayload}},
    },
    solana_program::{
        keccak, program_memory::sol_memcpy, secp256k1_recover::secp256k1_recover,
        system_instruction,
    },
    wormhole_core_bridge_solana::{
        sdk::{legacy::AccountVariant, VaaAccount},
        state::GuardianSet,
    },
    wormhole_raw_vaas::{utils::quorum, GuardianSetSig, Vaa},
};
pub mod error {
    use anchor_lang::prelude::*;
    #[repr(u32)]
    pub enum ReceiverError {
        InvalidWormholeMessage,
        DeserializeMessageFailed,
        InvalidPriceUpdate,
        UnsupportedMessageType,
        InvalidDataSource,
        InsufficientFunds,
        WrongWriteAuthority,
        WrongVaaOwner,
        DeserializeVaaFailed,
        InsufficientGuardianSignatures,
        InvalidVaaVersion,
        GuardianSetMismatch,
        InvalidGuardianOrder,
        InvalidGuardianIndex,
        InvalidSignature,
        InvalidGuardianKeyRecovery,
        WrongGuardianSetOwner,
        InvalidGuardianSetPda,
        GuardianSetExpired,
        GovernanceAuthorityMismatch,
        TargetGovernanceAuthorityMismatch,
        NonexistentGovernanceAuthorityTransferRequest,
        ZeroMinimumSignatures,
    }
    #[automatically_derived]
    impl ::core::fmt::Debug for ReceiverError {
        fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
            ::core::fmt::Formatter::write_str(
                f,
                match self {
                    ReceiverError::InvalidWormholeMessage => "InvalidWormholeMessage",
                    ReceiverError::DeserializeMessageFailed => "DeserializeMessageFailed",
                    ReceiverError::InvalidPriceUpdate => "InvalidPriceUpdate",
                    ReceiverError::UnsupportedMessageType => "UnsupportedMessageType",
                    ReceiverError::InvalidDataSource => "InvalidDataSource",
                    ReceiverError::InsufficientFunds => "InsufficientFunds",
                    ReceiverError::WrongWriteAuthority => "WrongWriteAuthority",
                    ReceiverError::WrongVaaOwner => "WrongVaaOwner",
                    ReceiverError::DeserializeVaaFailed => "DeserializeVaaFailed",
                    ReceiverError::InsufficientGuardianSignatures => {
                        "InsufficientGuardianSignatures"
                    }
                    ReceiverError::InvalidVaaVersion => "InvalidVaaVersion",
                    ReceiverError::GuardianSetMismatch => "GuardianSetMismatch",
                    ReceiverError::InvalidGuardianOrder => "InvalidGuardianOrder",
                    ReceiverError::InvalidGuardianIndex => "InvalidGuardianIndex",
                    ReceiverError::InvalidSignature => "InvalidSignature",
                    ReceiverError::InvalidGuardianKeyRecovery => {
                        "InvalidGuardianKeyRecovery"
                    }
                    ReceiverError::WrongGuardianSetOwner => "WrongGuardianSetOwner",
                    ReceiverError::InvalidGuardianSetPda => "InvalidGuardianSetPda",
                    ReceiverError::GuardianSetExpired => "GuardianSetExpired",
                    ReceiverError::GovernanceAuthorityMismatch => {
                        "GovernanceAuthorityMismatch"
                    }
                    ReceiverError::TargetGovernanceAuthorityMismatch => {
                        "TargetGovernanceAuthorityMismatch"
                    }
                    ReceiverError::NonexistentGovernanceAuthorityTransferRequest => {
                        "NonexistentGovernanceAuthorityTransferRequest"
                    }
                    ReceiverError::ZeroMinimumSignatures => "ZeroMinimumSignatures",
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
                ReceiverError::InvalidWormholeMessage => {
                    "InvalidWormholeMessage".to_string()
                }
                ReceiverError::DeserializeMessageFailed => {
                    "DeserializeMessageFailed".to_string()
                }
                ReceiverError::InvalidPriceUpdate => "InvalidPriceUpdate".to_string(),
                ReceiverError::UnsupportedMessageType => {
                    "UnsupportedMessageType".to_string()
                }
                ReceiverError::InvalidDataSource => "InvalidDataSource".to_string(),
                ReceiverError::InsufficientFunds => "InsufficientFunds".to_string(),
                ReceiverError::WrongWriteAuthority => "WrongWriteAuthority".to_string(),
                ReceiverError::WrongVaaOwner => "WrongVaaOwner".to_string(),
                ReceiverError::DeserializeVaaFailed => "DeserializeVaaFailed".to_string(),
                ReceiverError::InsufficientGuardianSignatures => {
                    "InsufficientGuardianSignatures".to_string()
                }
                ReceiverError::InvalidVaaVersion => "InvalidVaaVersion".to_string(),
                ReceiverError::GuardianSetMismatch => "GuardianSetMismatch".to_string(),
                ReceiverError::InvalidGuardianOrder => "InvalidGuardianOrder".to_string(),
                ReceiverError::InvalidGuardianIndex => "InvalidGuardianIndex".to_string(),
                ReceiverError::InvalidSignature => "InvalidSignature".to_string(),
                ReceiverError::InvalidGuardianKeyRecovery => {
                    "InvalidGuardianKeyRecovery".to_string()
                }
                ReceiverError::WrongGuardianSetOwner => {
                    "WrongGuardianSetOwner".to_string()
                }
                ReceiverError::InvalidGuardianSetPda => {
                    "InvalidGuardianSetPda".to_string()
                }
                ReceiverError::GuardianSetExpired => "GuardianSetExpired".to_string(),
                ReceiverError::GovernanceAuthorityMismatch => {
                    "GovernanceAuthorityMismatch".to_string()
                }
                ReceiverError::TargetGovernanceAuthorityMismatch => {
                    "TargetGovernanceAuthorityMismatch".to_string()
                }
                ReceiverError::NonexistentGovernanceAuthorityTransferRequest => {
                    "NonexistentGovernanceAuthorityTransferRequest".to_string()
                }
                ReceiverError::ZeroMinimumSignatures => {
                    "ZeroMinimumSignatures".to_string()
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
                ReceiverError::InvalidWormholeMessage => {
                    fmt.write_fmt(format_args!("Received an invalid wormhole message"))
                }
                ReceiverError::DeserializeMessageFailed => {
                    fmt.write_fmt(
                        format_args!("An error occurred when deserializing the message"),
                    )
                }
                ReceiverError::InvalidPriceUpdate => {
                    fmt.write_fmt(format_args!("Received an invalid price update"))
                }
                ReceiverError::UnsupportedMessageType => {
                    fmt.write_fmt(
                        format_args!("This type of message is not supported currently"),
                    )
                }
                ReceiverError::InvalidDataSource => {
                    fmt.write_fmt(
                        format_args!(
                            "The tuple emitter chain, emitter doesn\'t match one of the valid data sources."
                        ),
                    )
                }
                ReceiverError::InsufficientFunds => {
                    fmt.write_fmt(
                        format_args!("Funds are insufficient to pay the receiving fee"),
                    )
                }
                ReceiverError::WrongWriteAuthority => {
                    fmt.write_fmt(
                        format_args!("This signer can\'t write to price update account"),
                    )
                }
                ReceiverError::WrongVaaOwner => {
                    fmt.write_fmt(
                        format_args!("The posted VAA account has the wrong owner."),
                    )
                }
                ReceiverError::DeserializeVaaFailed => {
                    fmt.write_fmt(
                        format_args!("An error occurred when deserializing the VAA."),
                    )
                }
                ReceiverError::InsufficientGuardianSignatures => {
                    fmt.write_fmt(
                        format_args!(
                            "The number of guardian signatures is below the minimum"
                        ),
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
                ReceiverError::InvalidGuardianOrder => {
                    fmt.write_fmt(
                        format_args!("Guardian signature indices must be increasing"),
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
                ReceiverError::WrongGuardianSetOwner => {
                    fmt.write_fmt(
                        format_args!(
                            "The guardian set account is owned by the wrong program"
                        ),
                    )
                }
                ReceiverError::InvalidGuardianSetPda => {
                    fmt.write_fmt(
                        format_args!(
                            "The Guardian Set account doesn\'t match the PDA derivation"
                        ),
                    )
                }
                ReceiverError::GuardianSetExpired => {
                    fmt.write_fmt(format_args!("The Guardian Set is expired"))
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
                ReceiverError::ZeroMinimumSignatures => {
                    fmt.write_fmt(
                        format_args!(
                            "The minimum number of signatures should be at least 1"
                        ),
                    )
                }
            }
        }
    }
}
pub mod sdk {
    use {
        crate::{
            accounts, instruction, PostUpdateAtomicParams, PostUpdateParams, CONFIG_SEED,
            ID, TREASURY_SEED,
        },
        anchor_lang::{prelude::*, system_program, InstructionData},
        pyth_solana_receiver_sdk::config::{Config, DataSource},
        pythnet_sdk::wire::v1::{AccumulatorUpdateData, MerklePriceUpdate, Proof},
        rand::Rng, solana_program::instruction::Instruction,
        wormhole_core_bridge_solana::state::GuardianSet,
    };
    /**
 * This constant is used to efficiently pack transactions when writing an encoded Pyth VAA to the Wormhole contract.
 * Posting a VAA requires two transactions. If you split the VAA at this index when writing it, the first transaction will be almost full.
 */
    pub const VAA_SPLIT_INDEX: usize = 755;
    pub const DEFAULT_TREASURY_ID: u8 = 0;
    pub const SECONDARY_TREASURY_ID: u8 = 1;
    impl accounts::Initialize {
        pub fn populate(payer: &Pubkey) -> Self {
            let config = get_config_address();
            accounts::Initialize {
                payer: *payer,
                config,
                system_program: system_program::ID,
            }
        }
    }
    impl accounts::PostUpdateAtomic {
        pub fn populate(
            payer: Pubkey,
            write_authority: Pubkey,
            price_update_account: Pubkey,
            wormhole_address: Pubkey,
            guardian_set_index: u32,
            treasury_id: u8,
        ) -> Self {
            let config = get_config_address();
            let treasury = get_treasury_address(treasury_id);
            let guardian_set = get_guardian_set_address(
                wormhole_address,
                guardian_set_index,
            );
            accounts::PostUpdateAtomic {
                payer,
                guardian_set,
                config,
                treasury,
                price_update_account,
                system_program: system_program::ID,
                write_authority,
            }
        }
    }
    impl accounts::PostUpdate {
        pub fn populate(
            payer: Pubkey,
            write_authority: Pubkey,
            encoded_vaa: Pubkey,
            price_update_account: Pubkey,
            treasury_id: u8,
        ) -> Self {
            let config = get_config_address();
            let treasury = get_treasury_address(treasury_id);
            accounts::PostUpdate {
                payer,
                encoded_vaa,
                config,
                treasury,
                price_update_account,
                system_program: system_program::ID,
                write_authority,
            }
        }
    }
    impl accounts::Governance {
        pub fn populate(payer: Pubkey) -> Self {
            let config = get_config_address();
            accounts::Governance {
                payer,
                config,
            }
        }
    }
    impl accounts::AcceptGovernanceAuthorityTransfer {
        pub fn populate(payer: Pubkey) -> Self {
            let config = get_config_address();
            accounts::AcceptGovernanceAuthorityTransfer {
                payer,
                config,
            }
        }
    }
    impl accounts::ReclaimRent {
        pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Self {
            let _config = get_config_address();
            accounts::ReclaimRent {
                payer,
                price_update_account,
            }
        }
    }
    impl instruction::Initialize {
        pub fn populate(payer: &Pubkey, initial_config: Config) -> Instruction {
            Instruction {
                program_id: ID,
                accounts: accounts::Initialize::populate(payer).to_account_metas(None),
                data: instruction::Initialize {
                    initial_config,
                }
                    .data(),
            }
        }
    }
    impl instruction::PostUpdate {
        pub fn populate(
            payer: Pubkey,
            write_authority: Pubkey,
            encoded_vaa: Pubkey,
            price_update_account: Pubkey,
            merkle_price_update: MerklePriceUpdate,
            treasury_id: u8,
        ) -> Instruction {
            let post_update_accounts = accounts::PostUpdate::populate(
                    payer,
                    write_authority,
                    encoded_vaa,
                    price_update_account,
                    treasury_id,
                )
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: post_update_accounts,
                data: instruction::PostUpdate {
                    params: PostUpdateParams {
                        merkle_price_update,
                        treasury_id,
                    },
                }
                    .data(),
            }
        }
    }
    impl instruction::PostUpdateAtomic {
        pub fn populate(
            payer: Pubkey,
            write_authority: Pubkey,
            price_update_account: Pubkey,
            wormhole_address: Pubkey,
            guardian_set_index: u32,
            vaa: Vec<u8>,
            merkle_price_update: MerklePriceUpdate,
            treasury_id: u8,
        ) -> Instruction {
            let post_update_accounts = accounts::PostUpdateAtomic::populate(
                    payer,
                    write_authority,
                    price_update_account,
                    wormhole_address,
                    guardian_set_index,
                    treasury_id,
                )
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: post_update_accounts,
                data: instruction::PostUpdateAtomic {
                    params: PostUpdateAtomicParams {
                        vaa,
                        merkle_price_update,
                        treasury_id,
                    },
                }
                    .data(),
            }
        }
    }
    impl instruction::SetDataSources {
        pub fn populate(payer: Pubkey, data_sources: Vec<DataSource>) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::SetDataSources {
                    valid_data_sources: data_sources,
                }
                    .data(),
            }
        }
    }
    impl instruction::SetFee {
        pub fn populate(payer: Pubkey, fee: u64) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::SetFee {
                    single_update_fee_in_lamports: fee,
                }
                    .data(),
            }
        }
    }
    impl instruction::SetWormholeAddress {
        pub fn populate(payer: Pubkey, wormhole: Pubkey) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::SetWormholeAddress {
                    wormhole,
                }
                    .data(),
            }
        }
    }
    impl instruction::SetMinimumSignatures {
        pub fn populate(payer: Pubkey, minimum_signatures: u8) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::SetMinimumSignatures {
                    minimum_signatures,
                }
                    .data(),
            }
        }
    }
    impl instruction::RequestGovernanceAuthorityTransfer {
        pub fn populate(
            payer: Pubkey,
            target_governance_authority: Pubkey,
        ) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::RequestGovernanceAuthorityTransfer {
                    target_governance_authority,
                }
                    .data(),
            }
        }
    }
    impl instruction::CancelGovernanceAuthorityTransfer {
        pub fn populate(payer: Pubkey) -> Instruction {
            let governance_accounts = accounts::Governance::populate(payer)
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::CancelGovernanceAuthorityTransfer.data(),
            }
        }
    }
    impl instruction::AcceptGovernanceAuthorityTransfer {
        pub fn populate(payer: Pubkey) -> Instruction {
            let governance_accounts = accounts::AcceptGovernanceAuthorityTransfer::populate(
                    payer,
                )
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::AcceptGovernanceAuthorityTransfer {
                }
                    .data(),
            }
        }
    }
    impl instruction::ReclaimRent {
        pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Instruction {
            let governance_accounts = accounts::ReclaimRent::populate(
                    payer,
                    price_update_account,
                )
                .to_account_metas(None);
            Instruction {
                program_id: ID,
                accounts: governance_accounts,
                data: instruction::ReclaimRent {}.data(),
            }
        }
    }
    pub fn get_treasury_address(treasury_id: u8) -> Pubkey {
        Pubkey::find_program_address(&[TREASURY_SEED.as_ref(), &[treasury_id]], &ID).0
    }
    pub fn get_config_address() -> Pubkey {
        Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &ID).0
    }
    pub fn get_guardian_set_address(
        wormhole_address: Pubkey,
        guardian_set_index: u32,
    ) -> Pubkey {
        Pubkey::find_program_address(
                &[GuardianSet::SEED_PREFIX, guardian_set_index.to_be_bytes().as_ref()],
                &wormhole_address,
            )
            .0
    }
    pub fn deserialize_accumulator_update_data(
        accumulator_message: Vec<u8>,
    ) -> Result<(Vec<u8>, Vec<MerklePriceUpdate>)> {
        let accumulator_update_data = AccumulatorUpdateData::try_from_slice(
                accumulator_message.as_slice(),
            )
            .unwrap();
        match accumulator_update_data.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                return Ok((vaa.as_ref().to_vec(), updates));
            }
        }
    }
    pub fn get_random_treasury_id() -> u8 {
        rand::thread_rng().gen()
    }
}
/// The static program ID
pub static ID: anchor_lang::solana_program::pubkey::Pubkey = pyth_solana_receiver_sdk::ID;
/// Confirms that a given pubkey is equivalent to the program ID
pub fn check_id(id: &anchor_lang::solana_program::pubkey::Pubkey) -> bool {
    id == &ID
}
/// Returns the program ID
pub fn id() -> anchor_lang::solana_program::pubkey::Pubkey {
    ID
}
use self::pyth_solana_receiver::*;
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
        instruction::CancelGovernanceAuthorityTransfer::DISCRIMINATOR => {
            __private::__global::cancel_governance_authority_transfer(
                program_id,
                accounts,
                ix_data,
            )
        }
        instruction::AcceptGovernanceAuthorityTransfer::DISCRIMINATOR => {
            __private::__global::accept_governance_authority_transfer(
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
        instruction::SetMinimumSignatures::DISCRIMINATOR => {
            __private::__global::set_minimum_signatures(program_id, accounts, ix_data)
        }
        instruction::PostUpdateAtomic::DISCRIMINATOR => {
            __private::__global::post_update_atomic(program_id, accounts, ix_data)
        }
        instruction::PostUpdate::DISCRIMINATOR => {
            __private::__global::post_update(program_id, accounts, ix_data)
        }
        instruction::ReclaimRent::DISCRIMINATOR => {
            __private::__global::reclaim_rent(program_id, accounts, ix_data)
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
                                        line: 52u32,
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
                                    line: 52u32,
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
                                    line: 52u32,
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
        pub fn cancel_governance_authority_transfer(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log(
                "Instruction: CancelGovernanceAuthorityTransfer",
            );
            let ix = instruction::CancelGovernanceAuthorityTransfer::deserialize(
                    &mut &__ix_data[..],
                )
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::CancelGovernanceAuthorityTransfer = ix;
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
            let result = pyth_solana_receiver::cancel_governance_authority_transfer(
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
        pub fn accept_governance_authority_transfer(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log(
                "Instruction: AcceptGovernanceAuthorityTransfer",
            );
            let ix = instruction::AcceptGovernanceAuthorityTransfer::deserialize(
                    &mut &__ix_data[..],
                )
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::AcceptGovernanceAuthorityTransfer = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = AcceptGovernanceAuthorityTransfer::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::accept_governance_authority_transfer(
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
        pub fn set_minimum_signatures(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: SetMinimumSignatures");
            let ix = instruction::SetMinimumSignatures::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::SetMinimumSignatures { minimum_signatures } = ix;
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
            let result = pyth_solana_receiver::set_minimum_signatures(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
                minimum_signatures,
            )?;
            __accounts.exit(__program_id)
        }
        #[inline(never)]
        pub fn post_update_atomic(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: PostUpdateAtomic");
            let ix = instruction::PostUpdateAtomic::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::PostUpdateAtomic { params } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = PostUpdateAtomic::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::post_update_atomic(
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
        pub fn post_update(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: PostUpdate");
            let ix = instruction::PostUpdate::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::PostUpdate { params } = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = PostUpdate::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::post_update(
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
        pub fn reclaim_rent(
            __program_id: &Pubkey,
            __accounts: &[AccountInfo],
            __ix_data: &[u8],
        ) -> anchor_lang::Result<()> {
            ::solana_program::log::sol_log("Instruction: ReclaimRent");
            let ix = instruction::ReclaimRent::deserialize(&mut &__ix_data[..])
                .map_err(|_| {
                    anchor_lang::error::ErrorCode::InstructionDidNotDeserialize
                })?;
            let instruction::ReclaimRent = ix;
            let mut __bumps = std::collections::BTreeMap::new();
            let mut __reallocs = std::collections::BTreeSet::new();
            let mut __remaining_accounts: &[AccountInfo] = __accounts;
            let mut __accounts = ReclaimRent::try_accounts(
                __program_id,
                &mut __remaining_accounts,
                __ix_data,
                &mut __bumps,
                &mut __reallocs,
            )?;
            let result = pyth_solana_receiver::reclaim_rent(
                anchor_lang::context::Context::new(
                    __program_id,
                    &mut __accounts,
                    __remaining_accounts,
                    __bumps,
                ),
            )?;
            __accounts.exit(__program_id)
        }
    }
}
pub mod pyth_solana_receiver {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, initial_config: Config) -> Result<()> {
        if !(initial_config.minimum_signatures > 0) {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::ZeroMinimumSignatures.name(),
                    error_code_number: ReceiverError::ZeroMinimumSignatures.into(),
                    error_msg: ReceiverError::ZeroMinimumSignatures.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 57u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
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
    pub fn cancel_governance_authority_transfer(ctx: Context<Governance>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.target_governance_authority = None;
        Ok(())
    }
    pub fn accept_governance_authority_transfer(
        ctx: Context<AcceptGovernanceAuthorityTransfer>,
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
                            line: 85u32,
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
    pub fn set_minimum_signatures(
        ctx: Context<Governance>,
        minimum_signatures: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if !(minimum_signatures > 0) {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                    error_name: ReceiverError::ZeroMinimumSignatures.name(),
                    error_code_number: ReceiverError::ZeroMinimumSignatures.into(),
                    error_msg: ReceiverError::ZeroMinimumSignatures.to_string(),
                    error_origin: Some(
                        anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                            filename: "programs/pyth-solana-receiver/src/lib.rs",
                            line: 115u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
        config.minimum_signatures = minimum_signatures;
        Ok(())
    }
    /// Post a price update using a VAA and a MerklePriceUpdate.
    /// This function allows you to post a price update in a single transaction.
    /// Compared to `post_update`, it only checks whatever signatures are present in the provided VAA and doesn't fail if the number of signatures is lower than the Wormhole quorum of two thirds of the guardians.
    /// The number of signatures that were in the VAA is stored in the `VerificationLevel` of the `PriceUpdateV2` account.
    ///
    /// We recommend using `post_update_atomic` with 5 signatures. This is close to the maximum signatures you can verify in one transaction without exceeding the transaction size limit.
    ///
    /// # Warning
    ///
    /// Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update.
    pub fn post_update_atomic(
        ctx: Context<PostUpdateAtomic>,
        params: PostUpdateAtomicParams,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let guardian_set = deserialize_guardian_set_checked(
            &ctx.accounts.guardian_set,
            &config.wormhole,
        )?;
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
                                line: 141u32,
                            }),
                        ),
                        compared_values: None,
                    })
                    .with_values((vaa.version(), 1)),
            );
        }
        let guardian_set = guardian_set.inner();
        if vaa.guardian_set_index() != guardian_set.index {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::GuardianSetMismatch.name(),
                        error_code_number: ReceiverError::GuardianSetMismatch.into(),
                        error_msg: ReceiverError::GuardianSetMismatch.to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 145u32,
                            }),
                        ),
                        compared_values: None,
                    })
                    .with_values((vaa.guardian_set_index(), guardian_set.index)),
            );
        }
        let guardian_keys = &guardian_set.keys;
        let quorum = quorum(guardian_keys.len());
        if vaa.signature_count() < config.minimum_signatures {
            return Err(
                anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                        error_name: ReceiverError::InsufficientGuardianSignatures.name(),
                        error_code_number: ReceiverError::InsufficientGuardianSignatures
                            .into(),
                        error_msg: ReceiverError::InsufficientGuardianSignatures
                            .to_string(),
                        error_origin: Some(
                            anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                filename: "programs/pyth-solana-receiver/src/lib.rs",
                                line: 153u32,
                            }),
                        ),
                        compared_values: None,
                    })
                    .with_values((vaa.signature_count(), config.minimum_signatures)),
            );
        }
        let verification_level = if usize::from(vaa.signature_count()) >= quorum {
            VerificationLevel::Full
        } else {
            VerificationLevel::Partial {
                num_signatures: vaa.signature_count(),
            }
        };
        let digest = keccak::hash(keccak::hash(vaa.body().as_ref()).as_ref());
        let mut last_guardian_index = None;
        for sig in vaa.signatures() {
            let index = usize::from(sig.guardian_index());
            if let Some(last_index) = last_guardian_index {
                if !(index > last_index) {
                    return Err(
                        anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                            error_name: ReceiverError::InvalidGuardianOrder.name(),
                            error_code_number: ReceiverError::InvalidGuardianOrder
                                .into(),
                            error_msg: ReceiverError::InvalidGuardianOrder.to_string(),
                            error_origin: Some(
                                anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                                    filename: "programs/pyth-solana-receiver/src/lib.rs",
                                    line: 176u32,
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
                            line: 182u32,
                        }),
                    ),
                    compared_values: None,
                }))?;
            verify_guardian_signature(&sig, guardian_pubkey, digest.as_ref())?;
            last_guardian_index = Some(index);
        }
        let payer = &ctx.accounts.payer;
        let write_authority: &Signer<'_> = &ctx.accounts.write_authority;
        let treasury = &ctx.accounts.treasury;
        let price_update_account = &mut ctx.accounts.price_update_account;
        let vaa_components = VaaComponents {
            verification_level,
            emitter_address: vaa.body().emitter_address(),
            emitter_chain: vaa.body().emitter_chain(),
        };
        post_price_update_from_vaa(
            config,
            payer,
            write_authority,
            treasury,
            price_update_account,
            &vaa_components,
            vaa.payload().as_ref(),
            &params.merkle_price_update,
        )?;
        Ok(())
    }
    /// Post a price update using an encoded_vaa account and a MerklePriceUpdate calldata.
    /// This should be called after the client has already verified the Vaa via the Wormhole contract.
    /// Check out target_chains/solana/cli/src/main.rs for an example of how to do this.
    pub fn post_update(
        ctx: Context<PostUpdate>,
        params: PostUpdateParams,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let payer: &Signer<'_> = &ctx.accounts.payer;
        let write_authority: &Signer<'_> = &ctx.accounts.write_authority;
        let encoded_vaa = VaaAccount::load(&ctx.accounts.encoded_vaa)?;
        let treasury: &AccountInfo<'_> = &ctx.accounts.treasury;
        let price_update_account: &mut Account<'_, PriceUpdateV2> = &mut ctx
            .accounts
            .price_update_account;
        let vaa_components = VaaComponents {
            verification_level: VerificationLevel::Full,
            emitter_address: encoded_vaa.try_emitter_address()?,
            emitter_chain: encoded_vaa.try_emitter_chain()?,
        };
        post_price_update_from_vaa(
            config,
            payer,
            write_authority,
            treasury,
            price_update_account,
            &vaa_components,
            encoded_vaa.try_payload()?.as_ref(),
            &params.merkle_price_update,
        )?;
        Ok(())
    }
    pub fn reclaim_rent(_ctx: Context<ReclaimRent>) -> Result<()> {
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
    pub struct CancelGovernanceAuthorityTransfer;
    impl borsh::ser::BorshSerialize for CancelGovernanceAuthorityTransfer {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for CancelGovernanceAuthorityTransfer {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {})
        }
    }
    impl anchor_lang::Discriminator for CancelGovernanceAuthorityTransfer {
        const DISCRIMINATOR: [u8; 8] = [39, 93, 70, 137, 137, 90, 248, 154];
    }
    impl anchor_lang::InstructionData for CancelGovernanceAuthorityTransfer {}
    impl anchor_lang::Owner for CancelGovernanceAuthorityTransfer {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct AcceptGovernanceAuthorityTransfer;
    impl borsh::ser::BorshSerialize for AcceptGovernanceAuthorityTransfer {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for AcceptGovernanceAuthorityTransfer {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {})
        }
    }
    impl anchor_lang::Discriminator for AcceptGovernanceAuthorityTransfer {
        const DISCRIMINATOR: [u8; 8] = [254, 39, 222, 79, 64, 217, 205, 127];
    }
    impl anchor_lang::InstructionData for AcceptGovernanceAuthorityTransfer {}
    impl anchor_lang::Owner for AcceptGovernanceAuthorityTransfer {
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
    pub struct SetMinimumSignatures {
        pub minimum_signatures: u8,
    }
    impl borsh::ser::BorshSerialize for SetMinimumSignatures
    where
        u8: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.minimum_signatures, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for SetMinimumSignatures
    where
        u8: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                minimum_signatures: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for SetMinimumSignatures {
        const DISCRIMINATOR: [u8; 8] = [5, 210, 206, 124, 43, 68, 104, 149];
    }
    impl anchor_lang::InstructionData for SetMinimumSignatures {}
    impl anchor_lang::Owner for SetMinimumSignatures {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct PostUpdateAtomic {
        pub params: PostUpdateAtomicParams,
    }
    impl borsh::ser::BorshSerialize for PostUpdateAtomic
    where
        PostUpdateAtomicParams: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.params, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for PostUpdateAtomic
    where
        PostUpdateAtomicParams: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                params: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for PostUpdateAtomic {
        const DISCRIMINATOR: [u8; 8] = [49, 172, 84, 192, 175, 180, 52, 234];
    }
    impl anchor_lang::InstructionData for PostUpdateAtomic {}
    impl anchor_lang::Owner for PostUpdateAtomic {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct PostUpdate {
        pub params: PostUpdateParams,
    }
    impl borsh::ser::BorshSerialize for PostUpdate
    where
        PostUpdateParams: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.params, writer)?;
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for PostUpdate
    where
        PostUpdateParams: borsh::BorshDeserialize,
    {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {
                params: borsh::BorshDeserialize::deserialize_reader(reader)?,
            })
        }
    }
    impl anchor_lang::Discriminator for PostUpdate {
        const DISCRIMINATOR: [u8; 8] = [133, 95, 207, 175, 11, 79, 118, 44];
    }
    impl anchor_lang::InstructionData for PostUpdate {}
    impl anchor_lang::Owner for PostUpdate {
        fn owner() -> Pubkey {
            ID
        }
    }
    /// Instruction.
    pub struct ReclaimRent;
    impl borsh::ser::BorshSerialize for ReclaimRent {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            Ok(())
        }
    }
    impl borsh::de::BorshDeserialize for ReclaimRent {
        fn deserialize_reader<R: borsh::maybestd::io::Read>(
            reader: &mut R,
        ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
            Ok(Self {})
        }
    }
    impl anchor_lang::Discriminator for ReclaimRent {
        const DISCRIMINATOR: [u8; 8] = [218, 200, 19, 197, 227, 89, 192, 22];
    }
    impl anchor_lang::InstructionData for ReclaimRent {}
    impl anchor_lang::Owner for ReclaimRent {
        fn owner() -> Pubkey {
            ID
        }
    }
}
#[cfg(feature = "cpi")]
pub mod cpi {
    use super::*;
    use std::marker::PhantomData;
    pub struct Return<T> {
        phantom: std::marker::PhantomData<T>,
    }
    impl<T: AnchorDeserialize> Return<T> {
        pub fn get(&self) -> T {
            let (_key, data) = anchor_lang::solana_program::program::get_return_data()
                .unwrap();
            T::try_from_slice(&data).unwrap()
        }
    }
    pub fn initialize<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Initialize<'info>,
        >,
        initial_config: Config,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::Initialize {
                initial_config,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [175, 175, 109, 31, 13, 152, 155, 237].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn request_governance_authority_transfer<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
        target_governance_authority: Pubkey,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::RequestGovernanceAuthorityTransfer {
                target_governance_authority,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [92, 18, 67, 156, 27, 151, 183, 224].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn cancel_governance_authority_transfer<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::CancelGovernanceAuthorityTransfer;
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [39, 93, 70, 137, 137, 90, 248, 154].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn accept_governance_authority_transfer<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::AcceptGovernanceAuthorityTransfer<'info>,
        >,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::AcceptGovernanceAuthorityTransfer;
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [254, 39, 222, 79, 64, 217, 205, 127].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn set_data_sources<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
        valid_data_sources: Vec<DataSource>,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::SetDataSources {
                valid_data_sources,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [107, 73, 15, 119, 195, 116, 91, 210].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn set_fee<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
        single_update_fee_in_lamports: u64,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::SetFee {
                single_update_fee_in_lamports,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [18, 154, 24, 18, 237, 214, 19, 80].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn set_wormhole_address<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
        wormhole: Pubkey,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::SetWormholeAddress {
                wormhole,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [154, 174, 252, 157, 91, 215, 179, 156].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn set_minimum_signatures<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::Governance<'info>,
        >,
        minimum_signatures: u8,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::SetMinimumSignatures {
                minimum_signatures,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [5, 210, 206, 124, 43, 68, 104, 149].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn post_update_atomic<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::PostUpdateAtomic<'info>,
        >,
        params: PostUpdateAtomicParams,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::PostUpdateAtomic {
                params,
            };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [49, 172, 84, 192, 175, 180, 52, 234].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn post_update<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::PostUpdate<'info>,
        >,
        params: PostUpdateParams,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::PostUpdate { params };
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [133, 95, 207, 175, 11, 79, 118, 44].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    pub fn reclaim_rent<'a, 'b, 'c, 'info>(
        ctx: anchor_lang::context::CpiContext<
            'a,
            'b,
            'c,
            'info,
            crate::cpi::accounts::ReclaimRent<'info>,
        >,
    ) -> anchor_lang::Result<()> {
        let ix = {
            let ix = instruction::ReclaimRent;
            let mut ix_data = AnchorSerialize::try_to_vec(&ix)
                .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
            let mut data = [218, 200, 19, 197, 227, 89, 192, 22].to_vec();
            data.append(&mut ix_data);
            let accounts = ctx.to_account_metas(None);
            anchor_lang::solana_program::instruction::Instruction {
                program_id: crate::ID,
                accounts,
                data,
            }
        };
        let mut acc_infos = ctx.to_account_infos();
        anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &acc_infos,
                ctx.signer_seeds,
            )
            .map_or_else(|e| Err(Into::into(e)), |_| { Ok(()) })
    }
    /// An Anchor generated module, providing a set of structs
    /// mirroring the structs deriving `Accounts`, where each field is
    /// an `AccountInfo`. This is useful for CPI.
    pub mod accounts {
        pub use crate::__cpi_client_accounts_reclaim_rent::*;
        pub use crate::__cpi_client_accounts_post_update_atomic::*;
        pub use crate::__cpi_client_accounts_initialize::*;
        pub use crate::__cpi_client_accounts_accept_governance_authority_transfer::*;
        pub use crate::__cpi_client_accounts_governance::*;
        pub use crate::__cpi_client_accounts_post_update::*;
    }
}
/// An Anchor generated module, providing a set of structs
/// mirroring the structs deriving `Accounts`, where each field is
/// a `Pubkey`. This is useful for specifying accounts for a client.
pub mod accounts {
    pub use crate::__client_accounts_post_update_atomic::*;
    pub use crate::__client_accounts_reclaim_rent::*;
    pub use crate::__client_accounts_post_update::*;
    pub use crate::__client_accounts_governance::*;
    pub use crate::__client_accounts_initialize::*;
    pub use crate::__client_accounts_accept_governance_authority_transfer::*;
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
                                            line: 256u32,
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
    #[account(mut, seeds = [CONFIG_SEED.as_ref()], bump)]
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
        if !config.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("config"),
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
                    anchor_lang::solana_program::instruction::AccountMeta::new(
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
                    anchor_lang::solana_program::instruction::AccountMeta::new(
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
pub struct AcceptGovernanceAuthorityTransfer<'info> {
    #[account(
        constraint = payer.key(

        )= = config.target_governance_authority.ok_or(
            error!(ReceiverError::NonexistentGovernanceAuthorityTransferRequest)
        )?@ReceiverError::TargetGovernanceAuthorityMismatch
    )]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for AcceptGovernanceAuthorityTransfer<'info>
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
                                line: 280u32,
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
        if !config.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("config"),
            );
        }
        Ok(AcceptGovernanceAuthorityTransfer {
            payer,
            config,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info>
for AcceptGovernanceAuthorityTransfer<'info>
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
impl<'info> anchor_lang::ToAccountMetas for AcceptGovernanceAuthorityTransfer<'info> {
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
impl<'info> anchor_lang::AccountsExit<'info> for AcceptGovernanceAuthorityTransfer<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
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
pub(crate) mod __client_accounts_accept_governance_authority_transfer {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`AcceptGovernanceAuthorityTransfer`].
    pub struct AcceptGovernanceAuthorityTransfer {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for AcceptGovernanceAuthorityTransfer
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
    impl anchor_lang::ToAccountMetas for AcceptGovernanceAuthorityTransfer {
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
                    anchor_lang::solana_program::instruction::AccountMeta::new(
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
pub(crate) mod __cpi_client_accounts_accept_governance_authority_transfer {
    use super::*;
    /// Generated CPI struct of the accounts for [`AcceptGovernanceAuthorityTransfer`].
    pub struct AcceptGovernanceAuthorityTransfer<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas
    for AcceptGovernanceAuthorityTransfer<'info> {
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
                    anchor_lang::solana_program::instruction::AccountMeta::new(
                        anchor_lang::Key::key(&self.config),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info>
    for AcceptGovernanceAuthorityTransfer<'info> {
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
#[instruction(params:PostUpdateParams)]
pub struct PostUpdate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(owner = config.wormhole@ReceiverError::WrongVaaOwner)]
    /// CHECK: We aren't deserializing the VAA here but later with VaaAccount::load, which is the recommended way
    pub encoded_vaa: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    #[account(mut, seeds = [TREASURY_SEED.as_ref(), &[params.treasury_id]], bump)]
    pub treasury: AccountInfo<'info>,
    /// The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    /// Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    #[account(
        init_if_needed,
        constraint = price_update_account.write_authority = = Pubkey::default(

        )||price_update_account.write_authority = = write_authority.key(

        )@ReceiverError::WrongWriteAuthority,
        payer = payer,
        space = PriceUpdateV2::LEN
    )]
    pub price_update_account: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
    pub write_authority: Signer<'info>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for PostUpdate<'info>
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
            params: PostUpdateParams,
        }
        impl borsh::ser::BorshSerialize for __Args
        where
            PostUpdateParams: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.params, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for __Args
        where
            PostUpdateParams: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    params: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        let __Args { params } = __Args::deserialize(&mut __ix_data)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotDeserialize)?;
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let encoded_vaa: AccountInfo = anchor_lang::Accounts::try_accounts(
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
        let write_authority: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("write_authority"))?;
        let __anchor_rent = Rent::get()?;
        let price_update_account = {
            let actual_field = price_update_account.to_account_info();
            let actual_owner = actual_field.owner;
            let space = PriceUpdateV2::LEN;
            let pa: anchor_lang::accounts::account::Account<PriceUpdateV2> = if !true
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
                                            line: 288u32,
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
            if true {
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
        if !(price_update_account.write_authority == Pubkey::default()
            || price_update_account.write_authority == write_authority.key())
        {
            return Err(
                anchor_lang::error::Error::from(ReceiverError::WrongWriteAuthority)
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
                    anchor_lang::error::Error::from(ReceiverError::WrongVaaOwner)
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
            &[TREASURY_SEED.as_ref(), &[params.treasury_id]],
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
        Ok(PostUpdate {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program,
            write_authority,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdate<'info>
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
        account_infos.extend(self.write_authority.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for PostUpdate<'info> {
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
        account_metas.extend(self.write_authority.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for PostUpdate<'info>
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
pub(crate) mod __client_accounts_post_update {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`PostUpdate`].
    pub struct PostUpdate {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub encoded_vaa: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
        pub treasury: anchor_lang::solana_program::pubkey::Pubkey,
        ///The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
        ///Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
        pub price_update_account: anchor_lang::solana_program::pubkey::Pubkey,
        pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
        pub write_authority: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for PostUpdate
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
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
            borsh::BorshSerialize::serialize(&self.write_authority, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for PostUpdate {
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
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.write_authority,
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
pub(crate) mod __cpi_client_accounts_post_update {
    use super::*;
    /// Generated CPI struct of the accounts for [`PostUpdate`].
    pub struct PostUpdate<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub encoded_vaa: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub treasury: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        ///The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
        ///Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
        pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub write_authority: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for PostUpdate<'info> {
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
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.write_authority),
                        true,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdate<'info> {
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
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.write_authority),
                );
            account_infos
        }
    }
}
#[instruction(params:PostUpdateAtomicParams)]
pub struct PostUpdateAtomic<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: We can't use AccountVariant::<GuardianSet> here because its owner is hardcoded as the "official" Wormhole program and we want to get the wormhole address from the config.
    /// Instead we do the same steps in deserialize_guardian_set_checked.
    #[account(owner = config.wormhole@ReceiverError::WrongGuardianSetOwner)]
    pub guardian_set: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [TREASURY_SEED.as_ref(), &[params.treasury_id]], bump)]
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    pub treasury: AccountInfo<'info>,
    /// The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    /// Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    #[account(
        init_if_needed,
        constraint = price_update_account.write_authority = = Pubkey::default(

        )||price_update_account.write_authority = = write_authority.key(

        )@ReceiverError::WrongWriteAuthority,
        payer = payer,
        space = PriceUpdateV2::LEN
    )]
    pub price_update_account: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
    pub write_authority: Signer<'info>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for PostUpdateAtomic<'info>
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
            params: PostUpdateAtomicParams,
        }
        impl borsh::ser::BorshSerialize for __Args
        where
            PostUpdateAtomicParams: borsh::ser::BorshSerialize,
        {
            fn serialize<W: borsh::maybestd::io::Write>(
                &self,
                writer: &mut W,
            ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
                borsh::BorshSerialize::serialize(&self.params, writer)?;
                Ok(())
            }
        }
        impl borsh::de::BorshDeserialize for __Args
        where
            PostUpdateAtomicParams: borsh::BorshDeserialize,
        {
            fn deserialize_reader<R: borsh::maybestd::io::Read>(
                reader: &mut R,
            ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
                Ok(Self {
                    params: borsh::BorshDeserialize::deserialize_reader(reader)?,
                })
            }
        }
        let __Args { params } = __Args::deserialize(&mut __ix_data)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotDeserialize)?;
        let payer: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("payer"))?;
        let guardian_set: AccountInfo = anchor_lang::Accounts::try_accounts(
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
        let write_authority: Signer = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("write_authority"))?;
        let __anchor_rent = Rent::get()?;
        let price_update_account = {
            let actual_field = price_update_account.to_account_info();
            let actual_owner = actual_field.owner;
            let space = PriceUpdateV2::LEN;
            let pa: anchor_lang::accounts::account::Account<PriceUpdateV2> = if !true
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
                                            line: 309u32,
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
            if true {
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
        if !(price_update_account.write_authority == Pubkey::default()
            || price_update_account.write_authority == write_authority.key())
        {
            return Err(
                anchor_lang::error::Error::from(ReceiverError::WrongWriteAuthority)
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
            let my_owner = AsRef::<AccountInfo>::as_ref(&guardian_set).owner;
            let owner_address = config.wormhole;
            if my_owner != &owner_address {
                return Err(
                    anchor_lang::error::Error::from(ReceiverError::WrongGuardianSetOwner)
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
            &[TREASURY_SEED.as_ref(), &[params.treasury_id]],
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
        Ok(PostUpdateAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program,
            write_authority,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdateAtomic<'info>
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
        account_infos.extend(self.write_authority.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for PostUpdateAtomic<'info> {
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
        account_metas.extend(self.write_authority.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for PostUpdateAtomic<'info>
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
pub(crate) mod __client_accounts_post_update_atomic {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`PostUpdateAtomic`].
    pub struct PostUpdateAtomic {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        ///Instead we do the same steps in deserialize_guardian_set_checked.
        pub guardian_set: anchor_lang::solana_program::pubkey::Pubkey,
        pub config: anchor_lang::solana_program::pubkey::Pubkey,
        pub treasury: anchor_lang::solana_program::pubkey::Pubkey,
        ///The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
        ///Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
        pub price_update_account: anchor_lang::solana_program::pubkey::Pubkey,
        pub system_program: anchor_lang::solana_program::pubkey::Pubkey,
        pub write_authority: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for PostUpdateAtomic
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
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
            borsh::BorshSerialize::serialize(&self.write_authority, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for PostUpdateAtomic {
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
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        self.write_authority,
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
pub(crate) mod __cpi_client_accounts_post_update_atomic {
    use super::*;
    /// Generated CPI struct of the accounts for [`PostUpdateAtomic`].
    pub struct PostUpdateAtomic<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        ///Instead we do the same steps in deserialize_guardian_set_checked.
        pub guardian_set: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub config: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub treasury: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        ///The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
        ///Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
        pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub system_program: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
        pub write_authority: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for PostUpdateAtomic<'info> {
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
                .push(
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                        anchor_lang::Key::key(&self.write_authority),
                        true,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for PostUpdateAtomic<'info> {
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
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(&self.write_authority),
                );
            account_infos
        }
    }
}
pub struct ReclaimRent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        close = payer,
        constraint = price_update_account.write_authority = = payer.key(

        )@ReceiverError::WrongWriteAuthority
    )]
    pub price_update_account: Account<'info, PriceUpdateV2>,
}
#[automatically_derived]
impl<'info> anchor_lang::Accounts<'info> for ReclaimRent<'info>
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
        let price_update_account: anchor_lang::accounts::account::Account<
            PriceUpdateV2,
        > = anchor_lang::Accounts::try_accounts(
                __program_id,
                __accounts,
                __ix_data,
                __bumps,
                __reallocs,
            )
            .map_err(|e| e.with_account_name("price_update_account"))?;
        if !payer.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("payer"),
            );
        }
        if !price_update_account.to_account_info().is_writable {
            return Err(
                anchor_lang::error::Error::from(
                        anchor_lang::error::ErrorCode::ConstraintMut,
                    )
                    .with_account_name("price_update_account"),
            );
        }
        if !(price_update_account.write_authority == payer.key()) {
            return Err(
                anchor_lang::error::Error::from(ReceiverError::WrongWriteAuthority)
                    .with_account_name("price_update_account"),
            );
        }
        {
            if price_update_account.key() == payer.key() {
                return Err(
                    anchor_lang::error::Error::from(
                            anchor_lang::error::ErrorCode::ConstraintClose,
                        )
                        .with_account_name("price_update_account"),
                );
            }
        }
        Ok(ReclaimRent {
            payer,
            price_update_account,
        })
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountInfos<'info> for ReclaimRent<'info>
where
    'info: 'info,
{
    fn to_account_infos(
        &self,
    ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
        let mut account_infos = ::alloc::vec::Vec::new();
        account_infos.extend(self.payer.to_account_infos());
        account_infos.extend(self.price_update_account.to_account_infos());
        account_infos
    }
}
#[automatically_derived]
impl<'info> anchor_lang::ToAccountMetas for ReclaimRent<'info> {
    fn to_account_metas(
        &self,
        is_signer: Option<bool>,
    ) -> Vec<anchor_lang::solana_program::instruction::AccountMeta> {
        let mut account_metas = ::alloc::vec::Vec::new();
        account_metas.extend(self.payer.to_account_metas(None));
        account_metas.extend(self.price_update_account.to_account_metas(None));
        account_metas
    }
}
#[automatically_derived]
impl<'info> anchor_lang::AccountsExit<'info> for ReclaimRent<'info>
where
    'info: 'info,
{
    fn exit(
        &self,
        program_id: &anchor_lang::solana_program::pubkey::Pubkey,
    ) -> anchor_lang::Result<()> {
        anchor_lang::AccountsExit::exit(&self.payer, program_id)
            .map_err(|e| e.with_account_name("payer"))?;
        {
            let payer = &self.payer;
            anchor_lang::AccountsClose::close(
                    &self.price_update_account,
                    payer.to_account_info(),
                )
                .map_err(|e| e.with_account_name("price_update_account"))?;
        }
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
pub(crate) mod __client_accounts_reclaim_rent {
    use super::*;
    use anchor_lang::prelude::borsh;
    /// Generated client accounts for [`ReclaimRent`].
    pub struct ReclaimRent {
        pub payer: anchor_lang::solana_program::pubkey::Pubkey,
        pub price_update_account: anchor_lang::solana_program::pubkey::Pubkey,
    }
    impl borsh::ser::BorshSerialize for ReclaimRent
    where
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
        anchor_lang::solana_program::pubkey::Pubkey: borsh::ser::BorshSerialize,
    {
        fn serialize<W: borsh::maybestd::io::Write>(
            &self,
            writer: &mut W,
        ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
            borsh::BorshSerialize::serialize(&self.payer, writer)?;
            borsh::BorshSerialize::serialize(&self.price_update_account, writer)?;
            Ok(())
        }
    }
    #[automatically_derived]
    impl anchor_lang::ToAccountMetas for ReclaimRent {
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
                        self.price_update_account,
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
pub(crate) mod __cpi_client_accounts_reclaim_rent {
    use super::*;
    /// Generated CPI struct of the accounts for [`ReclaimRent`].
    pub struct ReclaimRent<'info> {
        pub payer: anchor_lang::solana_program::account_info::AccountInfo<'info>,
        pub price_update_account: anchor_lang::solana_program::account_info::AccountInfo<
            'info,
        >,
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountMetas for ReclaimRent<'info> {
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
                        anchor_lang::Key::key(&self.price_update_account),
                        false,
                    ),
                );
            account_metas
        }
    }
    #[automatically_derived]
    impl<'info> anchor_lang::ToAccountInfos<'info> for ReclaimRent<'info> {
        fn to_account_infos(
            &self,
        ) -> Vec<anchor_lang::solana_program::account_info::AccountInfo<'info>> {
            let mut account_infos = ::alloc::vec::Vec::new();
            account_infos
                .extend(anchor_lang::ToAccountInfos::to_account_infos(&self.payer));
            account_infos
                .extend(
                    anchor_lang::ToAccountInfos::to_account_infos(
                        &self.price_update_account,
                    ),
                );
            account_infos
        }
    }
}
pub struct PostUpdateAtomicParams {
    pub vaa: Vec<u8>,
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id: u8,
}
#[automatically_derived]
impl ::core::fmt::Debug for PostUpdateAtomicParams {
    fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
        ::core::fmt::Formatter::debug_struct_field3_finish(
            f,
            "PostUpdateAtomicParams",
            "vaa",
            &self.vaa,
            "merkle_price_update",
            &self.merkle_price_update,
            "treasury_id",
            &&self.treasury_id,
        )
    }
}
impl borsh::ser::BorshSerialize for PostUpdateAtomicParams
where
    Vec<u8>: borsh::ser::BorshSerialize,
    MerklePriceUpdate: borsh::ser::BorshSerialize,
    u8: borsh::ser::BorshSerialize,
{
    fn serialize<W: borsh::maybestd::io::Write>(
        &self,
        writer: &mut W,
    ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
        borsh::BorshSerialize::serialize(&self.vaa, writer)?;
        borsh::BorshSerialize::serialize(&self.merkle_price_update, writer)?;
        borsh::BorshSerialize::serialize(&self.treasury_id, writer)?;
        Ok(())
    }
}
impl borsh::de::BorshDeserialize for PostUpdateAtomicParams
where
    Vec<u8>: borsh::BorshDeserialize,
    MerklePriceUpdate: borsh::BorshDeserialize,
    u8: borsh::BorshDeserialize,
{
    fn deserialize_reader<R: borsh::maybestd::io::Read>(
        reader: &mut R,
    ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
        Ok(Self {
            vaa: borsh::BorshDeserialize::deserialize_reader(reader)?,
            merkle_price_update: borsh::BorshDeserialize::deserialize_reader(reader)?,
            treasury_id: borsh::BorshDeserialize::deserialize_reader(reader)?,
        })
    }
}
#[automatically_derived]
impl ::core::clone::Clone for PostUpdateAtomicParams {
    #[inline]
    fn clone(&self) -> PostUpdateAtomicParams {
        PostUpdateAtomicParams {
            vaa: ::core::clone::Clone::clone(&self.vaa),
            merkle_price_update: ::core::clone::Clone::clone(&self.merkle_price_update),
            treasury_id: ::core::clone::Clone::clone(&self.treasury_id),
        }
    }
}
pub struct PostUpdateParams {
    pub merkle_price_update: MerklePriceUpdate,
    pub treasury_id: u8,
}
#[automatically_derived]
impl ::core::fmt::Debug for PostUpdateParams {
    fn fmt(&self, f: &mut ::core::fmt::Formatter) -> ::core::fmt::Result {
        ::core::fmt::Formatter::debug_struct_field2_finish(
            f,
            "PostUpdateParams",
            "merkle_price_update",
            &self.merkle_price_update,
            "treasury_id",
            &&self.treasury_id,
        )
    }
}
impl borsh::ser::BorshSerialize for PostUpdateParams
where
    MerklePriceUpdate: borsh::ser::BorshSerialize,
    u8: borsh::ser::BorshSerialize,
{
    fn serialize<W: borsh::maybestd::io::Write>(
        &self,
        writer: &mut W,
    ) -> ::core::result::Result<(), borsh::maybestd::io::Error> {
        borsh::BorshSerialize::serialize(&self.merkle_price_update, writer)?;
        borsh::BorshSerialize::serialize(&self.treasury_id, writer)?;
        Ok(())
    }
}
impl borsh::de::BorshDeserialize for PostUpdateParams
where
    MerklePriceUpdate: borsh::BorshDeserialize,
    u8: borsh::BorshDeserialize,
{
    fn deserialize_reader<R: borsh::maybestd::io::Read>(
        reader: &mut R,
    ) -> ::core::result::Result<Self, borsh::maybestd::io::Error> {
        Ok(Self {
            merkle_price_update: borsh::BorshDeserialize::deserialize_reader(reader)?,
            treasury_id: borsh::BorshDeserialize::deserialize_reader(reader)?,
        })
    }
}
#[automatically_derived]
impl ::core::clone::Clone for PostUpdateParams {
    #[inline]
    fn clone(&self) -> PostUpdateParams {
        PostUpdateParams {
            merkle_price_update: ::core::clone::Clone::clone(&self.merkle_price_update),
            treasury_id: ::core::clone::Clone::clone(&self.treasury_id),
        }
    }
}
fn deserialize_guardian_set_checked(
    account_info: &AccountInfo<'_>,
    wormhole: &Pubkey,
) -> Result<AccountVariant<GuardianSet>> {
    let mut guardian_set_data: &[u8] = &account_info.try_borrow_data()?;
    let guardian_set = AccountVariant::<
        GuardianSet,
    >::try_deserialize(&mut guardian_set_data)?;
    let expected_address = Pubkey::find_program_address(
            &[
                GuardianSet::SEED_PREFIX,
                guardian_set.inner().index.to_be_bytes().as_ref(),
            ],
            wormhole,
        )
        .0;
    if !(expected_address == *account_info.key) {
        return Err(
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: ReceiverError::InvalidGuardianSetPda.name(),
                error_code_number: ReceiverError::InvalidGuardianSetPda.into(),
                error_msg: ReceiverError::InvalidGuardianSetPda.to_string(),
                error_origin: Some(
                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                        line: 369u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    let timestamp = Clock::get().map(Into::into)?;
    if !(guardian_set.inner().is_active(&timestamp)) {
        return Err(
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: ReceiverError::GuardianSetExpired.name(),
                error_code_number: ReceiverError::GuardianSetExpired.into(),
                error_msg: ReceiverError::GuardianSetExpired.to_string(),
                error_origin: Some(
                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                        line: 375u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    Ok(guardian_set)
}
struct VaaComponents {
    verification_level: VerificationLevel,
    emitter_address: [u8; 32],
    emitter_chain: u16,
}
fn post_price_update_from_vaa<'info>(
    config: &Account<'info, Config>,
    payer: &Signer<'info>,
    write_authority: &Signer<'info>,
    treasury: &AccountInfo<'info>,
    price_update_account: &mut Account<'_, PriceUpdateV2>,
    vaa_components: &VaaComponents,
    vaa_payload: &[u8],
    price_update: &MerklePriceUpdate,
) -> Result<()> {
    let amount_to_pay = if treasury.lamports() == 0 {
        Rent::get()?.minimum_balance(0).max(config.single_update_fee_in_lamports)
    } else {
        config.single_update_fee_in_lamports
    };
    if payer.lamports()
        < Rent::get()?.minimum_balance(payer.data_len()).saturating_add(amount_to_pay)
    {
        return Err(
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: ReceiverError::InsufficientFunds.name(),
                error_code_number: ReceiverError::InsufficientFunds.into(),
                error_msg: ReceiverError::InsufficientFunds.to_string(),
                error_origin: Some(
                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                        line: 411u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    let transfer_instruction = system_instruction::transfer(
        payer.key,
        treasury.key,
        amount_to_pay,
    );
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[payer.to_account_info(), treasury.to_account_info()],
    )?;
    let valid_data_source = config
        .valid_data_sources
        .iter()
        .any(|x| {
            *x
                == DataSource {
                    chain: vaa_components.emitter_chain,
                    emitter: Pubkey::from(vaa_components.emitter_address),
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
                        line: 427u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    let wormhole_message = WormholeMessage::try_from_bytes(vaa_payload)
        .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
    let root: MerkleRoot<Keccak160> = MerkleRoot::new(
        match wormhole_message.payload {
            WormholePayload::Merkle(merkle_root) => merkle_root.root,
        },
    );
    if !root.check(price_update.proof.clone(), price_update.message.as_ref()) {
        return Err(
            anchor_lang::error::Error::from(anchor_lang::error::AnchorError {
                error_name: ReceiverError::InvalidPriceUpdate.name(),
                error_code_number: ReceiverError::InvalidPriceUpdate.into(),
                error_msg: ReceiverError::InvalidPriceUpdate.to_string(),
                error_origin: Some(
                    anchor_lang::error::ErrorOrigin::Source(anchor_lang::error::Source {
                        filename: "programs/pyth-solana-receiver/src/lib.rs",
                        line: 437u32,
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
            price_update_account.write_authority = write_authority.key();
            price_update_account.verification_level = vaa_components.verification_level;
            price_update_account.price_message = price_feed_message;
            price_update_account.posted_slot = Clock::get()?.slot;
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
                            line: 451u32,
                        }),
                    ),
                    compared_values: None,
                }),
            );
        }
    }
    Ok(())
}
/**
 * Borrowed from https://github.com/wormhole-foundation/wormhole/blob/wen/solana-rewrite/solana/programs/core-bridge/src/processor/parse_and_verify_vaa/verify_encoded_vaa_v1.rs#L121
 */
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
                        line: 482u32,
                    }),
                ),
                compared_values: None,
            }),
        );
    }
    Ok(())
}
