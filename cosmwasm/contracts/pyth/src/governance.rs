use {
    byteorder::{
        BigEndian,
        ReadBytesExt,
        WriteBytesExt,
    },
    p2w_sdk::ErrBox,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
    std::io::Write,
};
use crate::state::PythDataSource;

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

    pub fn to_u8(&self) -> u8 {
        match &self {
            GovernanceModule::Executor => 0,
            GovernanceModule::Target => 1,
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
    // Set the fee to val * (10 ** expo)
    SetFee { val: u64, expo: u64 }, // 3
    // Set the default valid period to the provided number of seconds
    SetValidPeriod { valid_seconds: u64 }, // 4
    RequestGovernanceDataSourceTransfer,   // 5
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
        bytes.read_exact(magic_vec.as_mut_slice())?;

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

        let action_type: u8 = bytes.read_u8()?;
        let target_chain_id: u16 = bytes.read_u16::<BigEndian>()?;

        let action: Result<GovernanceAction, String> = match action_type {
            2 => {
                let num_data_sources = bytes.read_u8()?;
                let data_sources: Vec<PythDataSource> = vec![];
                for i in 0..num_data_sources {
                    let chain_id = bytes.read_u16::<BigEndian>()?;
                    let emitter_address = bytes.;
                }


                Ok(GovernanceAction::SetDataSources { })
            },
            3 => {
                let val = bytes.read_u64::<BigEndian>()?;
                let expo = bytes.read_u64::<BigEndian>()?;
                Ok(GovernanceAction::SetFee { val, expo })
            }
            // TODO: add parsing for additional actions
            _ => Err(format!("Bad governance action {action_type}",)),
        };

        Ok(GovernanceInstruction {
            module,
            action: action?,
            target_chain_id,
        })
    }

    pub fn serialize(&self) -> Result<Vec<u8>, ErrBox> {
        let mut buf = vec![];

        buf.write_all(PYTH_GOVERNANCE_MAGIC)?;
        buf.write_u8(self.module.to_u8())?;

        match &self.action {
            GovernanceAction::UpgradeContract => {
                buf.write_u8(0)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
            }
            GovernanceAction::AuthorizeGovernanceDataSourceTransfer => {
                buf.write_u8(1)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
            }
            GovernanceAction::SetDataSources => {
                buf.write_u8(2)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
            }
            GovernanceAction::SetFee { val, expo } => {
                buf.write_u8(3)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;

                buf.write_u64::<BigEndian>(*val)?;
                buf.write_u64::<BigEndian>(*expo)?;
            }
            GovernanceAction::SetValidPeriod {
                valid_seconds: new_valid_period,
            } => {
                buf.write_u8(4)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;

                buf.write_u64::<BigEndian>(*new_valid_period)?;
            }
            GovernanceAction::RequestGovernanceDataSourceTransfer => {
                buf.write_u8(5)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
            }
        }

        Ok(buf)
    }
}
