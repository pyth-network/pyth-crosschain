use alloc::vec::Vec;

#[derive(PartialEq)]
pub enum PythReceiverError {
    PriceUnavailable,
    InvalidUpdateData,
    VaaVerificationFailed,
    InvalidVaa,
    InvalidWormholeMessage,
    InvalidMerkleProof,
    InvalidAccumulatorMessage,
    InvalidMerkleRoot,
    InvalidMerklePath,
    InvalidUnknownSource,
    NewPriceUnavailable,
    InvalidAccumulatorMessageType,
    InsufficientFee,
    InvalidEmitterAddress,
    TooManyUpdates,
    PriceFeedNotFoundWithinRange,
    NoFreshUpdate,
    PriceFeedNotFound,
    InvalidGovernanceMessage,
    InvalidGovernanceTarget,
    InvalidGovernanceAction,
    InvalidGovernanceDataSource,
    OldGovernanceMessage,
    GovernanceMessageAlreadyExecuted,
    InvalidWormholeAddressToSet,
    WormholeUninitialized,
    AlreadyInitialized,
}

impl core::fmt::Debug for PythReceiverError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            PythReceiverError::PriceUnavailable => write!(f, "PriceUnavailable"),
            PythReceiverError::InvalidUpdateData => write!(f, "InvalidUpdateData"),
            PythReceiverError::VaaVerificationFailed => write!(f, "VaaVerificationFailed"),
            PythReceiverError::InvalidVaa => write!(f, "InvalidVaa"),
            PythReceiverError::InvalidWormholeMessage => write!(f, "InvalidWormholeMessage"),
            PythReceiverError::InvalidMerkleProof => write!(f, "InvalidMerkleProof"),
            PythReceiverError::InvalidAccumulatorMessage => write!(f, "InvalidAccumulatorMessage"),
            PythReceiverError::InvalidMerkleRoot => write!(f, "InvalidMerkleRoot"),
            PythReceiverError::InvalidMerklePath => write!(f, "InvalidMerklePath"),
            PythReceiverError::InvalidUnknownSource => write!(f, "InvalidUnknownSource"),
            PythReceiverError::NewPriceUnavailable => write!(f, "NewPriceUnavailable"),
            PythReceiverError::InvalidAccumulatorMessageType => {
                write!(f, "InvalidAccumulatorMessageType")
            }
            PythReceiverError::InsufficientFee => write!(f, "InsufficientFee"),
            PythReceiverError::InvalidEmitterAddress => write!(f, "InvalidEmitterAddress"),
            PythReceiverError::TooManyUpdates => write!(f, "TooManyUpdates"),
            PythReceiverError::PriceFeedNotFoundWithinRange => {
                write!(f, "PriceFeedNotFoundWithinRange")
            }
            PythReceiverError::NoFreshUpdate => write!(f, "NoFreshUpdate"),
            PythReceiverError::PriceFeedNotFound => write!(f, "PriceFeedNotFound"),
            PythReceiverError::InvalidGovernanceMessage => write!(f, "InvalidGovernanceMessage"),
            PythReceiverError::InvalidGovernanceTarget => write!(f, "InvalidGovernanceTarget"),
            PythReceiverError::InvalidGovernanceAction => write!(f, "InvalidGovernanceAction"),
            PythReceiverError::InvalidGovernanceDataSource => {
                write!(f, "InvalidGovernanceDataSource")
            }
            PythReceiverError::OldGovernanceMessage => write!(f, "OldGovernanceMessage"),
            PythReceiverError::GovernanceMessageAlreadyExecuted => {
                write!(f, "GovernanceMessageAlreadyExecuted")
            }
            PythReceiverError::InvalidWormholeAddressToSet => {
                write!(f, "InvalidWormholeAddressToSet")
            }
            PythReceiverError::WormholeUninitialized => {
                write!(f, "Wormhole is uninitialized, please set the Wormhole address and initialize the contract first")
            }
            PythReceiverError::AlreadyInitialized => write!(f, "AlreadyInitialized"),
        }
    }
}

impl core::fmt::Display for PythReceiverError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            PythReceiverError::PriceUnavailable => write!(f, "Price unavailable"),
            PythReceiverError::InvalidUpdateData => write!(f, "Invalid update data"),
            PythReceiverError::VaaVerificationFailed => write!(f, "VAA verification failed"),
            PythReceiverError::InvalidVaa => write!(f, "Invalid VAA"),
            PythReceiverError::InvalidWormholeMessage => write!(f, "Invalid Wormhole message"),
            PythReceiverError::InvalidMerkleProof => write!(f, "Invalid Merkle proof"),
            PythReceiverError::InvalidAccumulatorMessage => {
                write!(f, "Invalid accumulator message")
            }
            PythReceiverError::InvalidMerkleRoot => write!(f, "Invalid Merkle root"),
            PythReceiverError::InvalidMerklePath => write!(f, "Invalid Merkle path"),
            PythReceiverError::InvalidUnknownSource => write!(f, "Invalid unknown source"),
            PythReceiverError::NewPriceUnavailable => write!(f, "New price unavailable"),
            PythReceiverError::InvalidAccumulatorMessageType => {
                write!(f, "Invalid accumulator message type")
            }
            PythReceiverError::InsufficientFee => write!(f, "Insufficient fee"),
            PythReceiverError::InvalidEmitterAddress => write!(f, "Invalid emitter address"),
            PythReceiverError::TooManyUpdates => write!(f, "Too many updates"),
            PythReceiverError::PriceFeedNotFoundWithinRange => {
                write!(f, "Price feed not found within range")
            }
            PythReceiverError::NoFreshUpdate => write!(f, "No fresh update"),
            PythReceiverError::PriceFeedNotFound => write!(f, "Price feed not found"),
            PythReceiverError::InvalidGovernanceMessage => write!(f, "Invalid governance message"),
            PythReceiverError::InvalidGovernanceTarget => write!(f, "Invalid governance target"),
            PythReceiverError::InvalidGovernanceAction => write!(f, "Invalid governance action"),
            PythReceiverError::InvalidGovernanceDataSource => {
                write!(f, "Invalid governance data source")
            }
            PythReceiverError::OldGovernanceMessage => write!(f, "Old governance message"),
            PythReceiverError::GovernanceMessageAlreadyExecuted => {
                write!(f, "Governance message already executed")
            }
            PythReceiverError::InvalidWormholeAddressToSet => {
                write!(f, "Invalid Wormhole address to set")
            }
            PythReceiverError::WormholeUninitialized => {
                write!(f, "Wormhole is uninitialized, please set the Wormhole address and initialize the contract first")
            }
            PythReceiverError::AlreadyInitialized => write!(f, "Contract is already initialized"),
        }
    }
}

impl From<PythReceiverError> for Vec<u8> {
    fn from(error: PythReceiverError) -> Vec<u8> {
        vec![match error {
            PythReceiverError::PriceUnavailable => 1,
            PythReceiverError::InvalidUpdateData => 2,
            PythReceiverError::VaaVerificationFailed => 3,
            PythReceiverError::InvalidVaa => 4,
            PythReceiverError::InvalidWormholeMessage => 5,
            PythReceiverError::InvalidMerkleProof => 6,
            PythReceiverError::InvalidAccumulatorMessage => 7,
            PythReceiverError::InvalidMerkleRoot => 8,
            PythReceiverError::InvalidMerklePath => 9,
            PythReceiverError::InvalidUnknownSource => 10,
            PythReceiverError::NewPriceUnavailable => 11,
            PythReceiverError::InvalidAccumulatorMessageType => 12,
            PythReceiverError::InsufficientFee => 13,
            PythReceiverError::InvalidEmitterAddress => 14,
            PythReceiverError::TooManyUpdates => 15,
            PythReceiverError::PriceFeedNotFoundWithinRange => 16,
            PythReceiverError::NoFreshUpdate => 17,
            PythReceiverError::PriceFeedNotFound => 18,
            PythReceiverError::InvalidGovernanceMessage => 19,
            PythReceiverError::InvalidGovernanceTarget => 20,
            PythReceiverError::InvalidGovernanceAction => 21,
            PythReceiverError::InvalidGovernanceDataSource => 22,
            PythReceiverError::OldGovernanceMessage => 23,
            PythReceiverError::GovernanceMessageAlreadyExecuted => 24,
            PythReceiverError::InvalidWormholeAddressToSet => 25,
            PythReceiverError::WormholeUninitialized => 26,
            PythReceiverError::AlreadyInitialized => 27,
        }]
    }
}
