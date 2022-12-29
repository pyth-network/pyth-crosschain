use {
    crate::{
        governance::GovernanceAction::{
            RequestGovernanceDataSourceTransfer,
            SetValidPeriod,
        },
        state::PythDataSource,
    },
    byteorder::{
        BigEndian,
        ReadBytesExt,
        WriteBytesExt,
    },
    cosmwasm_std::Binary,
    p2w_sdk::ErrBox,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        convert::TryFrom,
        io::Write,
    },
};

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
    UpgradeContract { address: [u8; 20] }, // 0
    AuthorizeGovernanceDataSourceTransfer { claim_vaa: Binary }, // 1
    SetDataSources { data_sources: Vec<PythDataSource> }, // 2
    // Set the fee to val * (10 ** expo)
    SetFee { val: u64, expo: u64 }, // 3
    // Set the default valid period to the provided number of seconds
    SetValidPeriod { valid_seconds: u64 }, // 4
    RequestGovernanceDataSourceTransfer { governance_data_source_index: u32 }, // 5
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
            0 => {
                let mut address: [u8; 20] = [0; 20];
                bytes.read_exact(&mut address)?;
                Ok(GovernanceAction::UpgradeContract { address })
            }
            1 => {
                let mut payload: Vec<u8> = vec![];
                bytes.read_to_end(&mut payload)?;
                Ok(GovernanceAction::AuthorizeGovernanceDataSourceTransfer {
                    claim_vaa: Binary::from(payload),
                })
            }
            2 => {
                let num_data_sources = bytes.read_u8()?;
                let mut data_sources: Vec<PythDataSource> = vec![];
                for _ in 0..num_data_sources {
                    let chain_id = bytes.read_u16::<BigEndian>()?;
                    let mut emitter_address: [u8; 32] = [0; 32];
                    bytes.read_exact(&mut emitter_address)?;

                    data_sources.push(PythDataSource {
                        emitter: Binary::from(&emitter_address),
                        chain_id,
                    });
                }

                Ok(GovernanceAction::SetDataSources { data_sources })
            }
            3 => {
                let val = bytes.read_u64::<BigEndian>()?;
                let expo = bytes.read_u64::<BigEndian>()?;
                Ok(GovernanceAction::SetFee { val, expo })
            }
            4 => {
                let valid_seconds = bytes.read_u64::<BigEndian>()?;
                Ok(SetValidPeriod { valid_seconds })
            }
            5 => {
                let governance_data_source_index = bytes.read_u32::<BigEndian>()?;
                Ok(RequestGovernanceDataSourceTransfer {
                    governance_data_source_index,
                })
            }
            _ => Err(format!("Unknown governance action type: {action_type}",)),
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
            GovernanceAction::UpgradeContract { address } => {
                buf.write_u8(0)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
                buf.write_all(address)?;
            }
            GovernanceAction::AuthorizeGovernanceDataSourceTransfer { claim_vaa } => {
                buf.write_u8(1)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
                buf.write_all(claim_vaa.as_slice())?;
            }
            GovernanceAction::SetDataSources { data_sources } => {
                buf.write_u8(2)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
                buf.write_u8(u8::try_from(data_sources.len())?)?;
                for data_source in data_sources {
                    buf.write_u16::<BigEndian>(data_source.chain_id)?;

                    // The message format expects emitter addresses to be 32 bytes.
                    // However, we don't maintain this invariant in the rust code (and we violate it in the tests).
                    // This check gives you a reasonable error message if you happen to violate it in the tests.
                    if data_source.emitter.len() != 32 {
                        Err("Emitter addresses must be 32 bytes")?
                    }

                    buf.write_all(data_source.emitter.as_slice())?;
                }
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
            GovernanceAction::RequestGovernanceDataSourceTransfer {
                governance_data_source_index,
            } => {
                buf.write_u8(5)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
                buf.write_u32::<BigEndian>(*governance_data_source_index)?;
            }
        }

        Ok(buf)
    }
}
