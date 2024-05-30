library;

use std::bytes::Bytes;

pub struct GovernanceInstruction {
    pub magic: u32,
    pub module: GovernanceModule,
    pub action: GovernanceAction,
    pub target_chain_id: u16,
    pub payload: Bytes,
}

pub enum GovernanceModule {
    Executor: (), // 0
    Target: (), // 1
    EvmExecutor: (), // 2
    StacksTarget: (), // 3
    Invalid: (),
}

pub enum GovernanceAction {
    UpgradeContract: (), // 0
    AuthorizeGovernanceDataSourceTransfer: (), // 1
    SetDataSources: (), // 2
    SetFee: (), // 3
    SetValidPeriod: (), // 4
    RequestGovernanceDataSourceTransfer: (), // 5
    Invalid: (),
}
