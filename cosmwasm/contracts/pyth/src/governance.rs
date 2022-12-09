use {
    crate::state::PythDataSource,
    byteorder::{
        BigEndian,
        ReadBytesExt,
    },
    cosmwasm_std::Binary,
    p2w_sdk::ErrBox,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
    std::io::Read,
};

type HumanAddr = String;

const PYTH_GOVERNANCE_MAGIC: &[u8] = b"PTGM";

/// The type of contract that can accept a governance instruction.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[repr(u8)]
pub enum GovernanceModule {
    /// The PythNet executor contract
    Executor = 0,
    /// A target chain contract (like this one!)
    Target   = 1,
}

impl GovernanceModule {
    pub fn from_u8(x: u8) -> Result<GovernanceModule, ErrBox> {
        match x {
            0 => Ok(GovernanceModule::Executor),
            1 => Ok(GovernanceModule::Target),
            _ => Err(format!("Invalid governance module: {x}",).into()),
        }
    }
}

/// The action to perform to change the state of the target chain contract.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[repr(u8)]
pub enum GovernanceAction {
    UpgradeContract,                       // 0
    AuthorizeGovernanceDataSourceTransfer, // 1
    SetDataSources,                        // 2
    // Note that in governance messages, the fee is actually 256 bits
    SetFee { new_fee: u128 } = 3, // 3
    // Note that in governance messages, new_valid_period is actually 256 bits
    SetValidPeriod { new_valid_period: u128 }, // 4
    RequestGovernanceDataSourceTransfer,       // 5
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct GovernanceInstruction {
    pub module:          GovernanceModule,
    pub action:          GovernanceAction,
    pub target_chain_id: u16,
}

impl GovernanceInstruction {
    pub fn deserialize(mut bytes: impl ReadBytesExt) -> Result<Self, ErrBox> {
        let mut magic_vec = vec![0u8; PYTH_GOVERNANCE_MAGIC.len()];
        bytes.read_exact(magic_vec.as_mut_slice());

        if magic_vec.as_slice() != PYTH_GOVERNANCE_MAGIC {
            return Err(format!(
                "Invalid magic {magic_vec:02X?}, expected {PYTH_GOVERNANCE_MAGIC:02X?}",
            )
            .into());
        }

        let module_num = bytes.read_u8()?;
        let module = GovernanceModule::from_u8(module_num)?;

        if module != GovernanceModule::Target {
            return Err(format!("Invalid governance module {module_num}",).into());
        }

        // TODO: check endianness
        let action_type: u8 = bytes.read_u8()?;
        let target_chain_id: u16 = bytes.read_u16::<BigEndian>()?;

        let action: Result<GovernanceAction, String> = match action_type {
            0 => Ok(GovernanceAction::UpgradeContract),
            3 => {
                let high = bytes.read_u128::<BigEndian>()?;
                let low = bytes.read_u128::<BigEndian>()?;
                if high != 0 {
                    Err(format!("Fee is too big {high} {low}",))
                } else {
                    Ok(GovernanceAction::SetFee { new_fee: low })
                }
            }
            _ => Err(format!("Bad governance action {action_type}",)),
        };

        Ok(GovernanceInstruction {
            module,
            action: action?,
            target_chain_id,
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    UpdatePriceFeeds { data: Binary },
    AddDataSource { data_source: PythDataSource },
    RemoveDataSource { data_source: PythDataSource },
    ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

pub use pyth_sdk_cw::{
    PriceFeedResponse,
    QueryMsg,
};
