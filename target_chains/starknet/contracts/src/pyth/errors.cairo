#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum GetPriceUnsafeError {
    PriceFeedNotFound,
}

impl GetPriceUnsafeErrorIntoFelt252 of Into<GetPriceUnsafeError, felt252> {
    fn into(self: GetPriceUnsafeError) -> felt252 {
        match self {
            GetPriceUnsafeError::PriceFeedNotFound => 'price feed not found',
        }
    }
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum GovernanceActionError {
    AccessDenied,
    Wormhole: pyth::wormhole::ParseAndVerifyVmError,
    InvalidGovernanceDataSource,
    OldGovernanceMessage,
    InvalidGovernanceTarget,
    InvalidGovernanceMessage,
}

impl GovernanceActionErrorIntoFelt252 of Into<GovernanceActionError, felt252> {
    fn into(self: GovernanceActionError) -> felt252 {
        match self {
            GovernanceActionError::AccessDenied => 'access denied',
            GovernanceActionError::Wormhole(err) => err.into(),
            GovernanceActionError::InvalidGovernanceDataSource => 'invalid governance data source',
            GovernanceActionError::OldGovernanceMessage => 'old governance message',
            GovernanceActionError::InvalidGovernanceTarget => 'invalid governance target',
            GovernanceActionError::InvalidGovernanceMessage => 'invalid governance message',
        }
    }
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum UpdatePriceFeedsError {
    Reader: pyth::reader::Error,
    Wormhole: pyth::wormhole::ParseAndVerifyVmError,
    InvalidUpdateData,
    InvalidUpdateDataSource,
    InsufficientFeeAllowance,
}

impl UpdatePriceFeedsErrorIntoFelt252 of Into<UpdatePriceFeedsError, felt252> {
    fn into(self: UpdatePriceFeedsError) -> felt252 {
        match self {
            UpdatePriceFeedsError::Reader(err) => err.into(),
            UpdatePriceFeedsError::Wormhole(err) => err.into(),
            UpdatePriceFeedsError::InvalidUpdateData => 'invalid update data',
            UpdatePriceFeedsError::InvalidUpdateDataSource => 'invalid update data source',
            UpdatePriceFeedsError::InsufficientFeeAllowance => 'insufficient fee allowance',
        }
    }
}
