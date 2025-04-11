#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
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

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum GetPriceNoOlderThanError {
    PriceFeedNotFound,
    StalePrice,
}

impl GetPriceNoOlderThanErrorIntoFelt252 of Into<GetPriceNoOlderThanError, felt252> {
    fn into(self: GetPriceNoOlderThanError) -> felt252 {
        match self {
            GetPriceNoOlderThanError::PriceFeedNotFound => 'price feed not found',
            GetPriceNoOlderThanError::StalePrice => 'stale price',
        }
    }
}

impl GetPriceUnsafeErrorIntoGetPriceNoOlderThanError of Into<
    GetPriceUnsafeError, GetPriceNoOlderThanError,
> {
    fn into(self: GetPriceUnsafeError) -> GetPriceNoOlderThanError {
        match self {
            GetPriceUnsafeError::PriceFeedNotFound => GetPriceNoOlderThanError::PriceFeedNotFound,
        }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum GovernanceActionError {
    Wormhole: pyth::wormhole::ParseAndVerifyVmError,
    InvalidGovernanceDataSource,
    OldGovernanceMessage,
    InvalidGovernanceTarget,
    InvalidGovernanceMessage,
    InvalidWormholeAddressToSet,
}

impl GovernanceActionErrorIntoFelt252 of Into<GovernanceActionError, felt252> {
    fn into(self: GovernanceActionError) -> felt252 {
        match self {
            GovernanceActionError::Wormhole(err) => err.into(),
            GovernanceActionError::InvalidGovernanceDataSource => 'invalid governance data source',
            GovernanceActionError::OldGovernanceMessage => 'old governance message',
            GovernanceActionError::InvalidGovernanceTarget => 'invalid governance target',
            GovernanceActionError::InvalidGovernanceMessage => 'invalid governance message',
            GovernanceActionError::InvalidWormholeAddressToSet => 'invalid new wormhole address',
        }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
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

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum UpdatePriceFeedsIfNecessaryError {
    Update: UpdatePriceFeedsError,
    NoFreshUpdate,
}

impl UpdatePriceFeedsIfNecessaryErrorIntoFelt252 of Into<
    UpdatePriceFeedsIfNecessaryError, felt252,
> {
    fn into(self: UpdatePriceFeedsIfNecessaryError) -> felt252 {
        match self {
            UpdatePriceFeedsIfNecessaryError::Update(err) => err.into(),
            UpdatePriceFeedsIfNecessaryError::NoFreshUpdate => 'no fresh update',
        }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum ParsePriceFeedsError {
    Update: UpdatePriceFeedsError,
    PriceFeedNotFoundWithinRange,
}

impl ParsePriceFeedsErrorIntoFelt252 of Into<ParsePriceFeedsError, felt252> {
    fn into(self: ParsePriceFeedsError) -> felt252 {
        match self {
            ParsePriceFeedsError::Update(err) => err.into(),
            ParsePriceFeedsError::PriceFeedNotFoundWithinRange => 'price feed not found',
        }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum GetSingleUpdateFeeError {
    UnsupportedToken,
}

impl GetSingleUpdateFeeErrorIntoFelt252 of Into<GetSingleUpdateFeeError, felt252> {
    fn into(self: GetSingleUpdateFeeError) -> felt252 {
        match self {
            GetSingleUpdateFeeError::UnsupportedToken => 'unsupported token',
        }
    }
}
