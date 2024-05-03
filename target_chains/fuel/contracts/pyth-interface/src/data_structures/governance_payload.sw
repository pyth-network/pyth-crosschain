library;

use std::bytes::Bytes;

use ::data_structures::data_source::DataSource;

pub struct UpgradeContractPayload {
    new_implementation: Identity,
}

pub struct AuthorizeGovernanceDataSourceTransferPayload {
    claim_vaa: Bytes,
}

pub struct RequestGovernanceDataSourceTransferPayload {
    governance_data_source_index: u32,
}

pub struct SetDataSourcesPayload {
    data_sources: Vec<DataSource>,
}

pub struct SetFeePayload {
    new_fee: u64,
}

pub struct SetValidPeriodPayload {
    new_valid_period: u64,
}
