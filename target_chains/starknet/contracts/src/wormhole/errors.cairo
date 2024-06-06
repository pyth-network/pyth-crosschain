/// Possible panic payloads for methods that execute governance instructions.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum GovernanceError {
    InvalidModule,
    InvalidAction,
    InvalidChainId,
    TrailingData,
    NotCurrentGuardianSet,
    WrongChain,
    WrongContract,
    ActionAlreadyConsumed,
}

impl GovernanceErrorIntoFelt252 of Into<GovernanceError, felt252> {
    fn into(self: GovernanceError) -> felt252 {
        match self {
            GovernanceError::InvalidModule => 'invalid module',
            GovernanceError::InvalidAction => 'invalid action',
            GovernanceError::InvalidChainId => 'invalid chain ID',
            GovernanceError::TrailingData => 'trailing data',
            GovernanceError::NotCurrentGuardianSet => 'not signed by current guard.set',
            GovernanceError::WrongChain => 'wrong governance chain',
            GovernanceError::WrongContract => 'wrong governance contract',
            GovernanceError::ActionAlreadyConsumed => 'gov. action already consumed',
        }
    }
}

/// Possible panic payloads of `IWormhole::submit_new_guardian_set`.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum SubmitNewGuardianSetError {
    Governance: GovernanceError,
    NoGuardiansSpecified,
    TooManyGuardians,
    InvalidGuardianKey,
    // guardian set index must increase in steps of 1
    InvalidGuardianSetSequence,
}

impl SubmitNewGuardianSetErrorIntoFelt252 of Into<SubmitNewGuardianSetError, felt252> {
    fn into(self: SubmitNewGuardianSetError) -> felt252 {
        match self {
            SubmitNewGuardianSetError::Governance(err) => err.into(),
            SubmitNewGuardianSetError::NoGuardiansSpecified => 'no guardians specified',
            SubmitNewGuardianSetError::TooManyGuardians => 'too many guardians',
            SubmitNewGuardianSetError::InvalidGuardianKey => 'invalid guardian key',
            SubmitNewGuardianSetError::InvalidGuardianSetSequence => 'invalid guardian set sequence',
        }
    }
}

/// Possible panic payloads of `IWormhole::parse_and_verify_vm`.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum ParseAndVerifyVmError {
    Reader: pyth::reader::Error,
    VmVersionIncompatible,
    InvalidGuardianSetIndex,
    InvalidSignature,
    GuardianSetExpired,
    NoQuorum,
    InvalidSignatureOrder,
    InvalidGuardianIndex,
}

impl ErrorIntoFelt252 of Into<ParseAndVerifyVmError, felt252> {
    fn into(self: ParseAndVerifyVmError) -> felt252 {
        match self {
            ParseAndVerifyVmError::Reader(err) => err.into(),
            ParseAndVerifyVmError::VmVersionIncompatible => 'VM version incompatible',
            ParseAndVerifyVmError::InvalidGuardianSetIndex => 'invalid guardian set index',
            ParseAndVerifyVmError::InvalidSignature => 'invalid signature',
            ParseAndVerifyVmError::GuardianSetExpired => 'guardian set expired',
            ParseAndVerifyVmError::NoQuorum => 'no quorum',
            ParseAndVerifyVmError::InvalidSignatureOrder => 'invalid signature order',
            ParseAndVerifyVmError::InvalidGuardianIndex => 'invalid guardian index',
        }
    }
}

/// Possible panic payloads of `IWormhole::get_guardian_set`.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum GetGuardianSetError {
    InvalidIndex,
}

impl GetGuardianSetErrorIntoFelt252 of Into<GetGuardianSetError, felt252> {
    fn into(self: GetGuardianSetError) -> felt252 {
        match self {
            GetGuardianSetError::InvalidIndex => 'invalid index',
        }
    }
}
