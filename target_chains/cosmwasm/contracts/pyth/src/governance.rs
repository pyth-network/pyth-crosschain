use {
    crate::state::PythDataSource,
    byteorder::{BigEndian, ReadBytesExt, WriteBytesExt},
    cosmwasm_std::Binary,
    pythnet_sdk::legacy::ErrBox,
    schemars::JsonSchema,
    serde::{Deserialize, Serialize},
    std::{convert::TryFrom, io::Write},
};

const PYTH_GOVERNANCE_MAGIC: &[u8] = b"PTGM";

/// The type of contract that can accept a governance instruction.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[repr(u8)]
pub enum GovernanceModule {
    /// The PythNet executor contract. Messages sent to the
    Executor = 0,
    /// A target chain contract (like this one!)
    Target = 1,
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
///
/// Note that the order of the enum cannot be changed, as the integer representation of
/// each field must be preserved for backward compatibility.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[repr(u8)]
pub enum GovernanceAction {
    /// Upgrade the code for the contract to the code uploaded at code_id
    UpgradeContract { code_id: u64 }, // 0
    /// This action is the second step of a governance handoff process.
    /// The handoff is as follows:
    /// 1. The new governance emitter creates a VAA containing a RequestGovernanceDataSourceTransfer action
    /// 2. The existing governance emitter creates a AuthorizeGovernanceDataSourceTransfer message where
    ///    claim_vaa is the VAA from step 1.
    /// 3. The VAA from step 2 is submitted to the contract.
    ///
    /// This 2-step process ensures that the new emitter is able to send VAAs before the transfer
    /// is completed.
    AuthorizeGovernanceDataSourceTransfer { claim_vaa: Binary }, // 1
    /// Set the set of authorized emitters for price update messages.
    SetDataSources { data_sources: Vec<PythDataSource> }, // 2
    /// Set the fee to val * (10 ** expo)
    SetFee { val: u64, expo: u64 }, // 3
    /// Set the default valid period to the provided number of seconds
    SetValidPeriod { valid_seconds: u64 }, // 4
    /// The first step of the governance handoff process (see documentation
    /// on AuthorizeGovernanceDataSourceTransfer). `governance_data_source_index` is an incrementing
    /// sequence number that ensures old transfer messages cannot be replayed.
    RequestGovernanceDataSourceTransfer { governance_data_source_index: u32 }, // 5
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct GovernanceInstruction {
    pub module: GovernanceModule,
    pub action: GovernanceAction,
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

        let action_type: u8 = bytes.read_u8()?;
        let target_chain_id: u16 = bytes.read_u16::<BigEndian>()?;

        let action: Result<GovernanceAction, String> = match action_type {
            0 => {
                let code_id = bytes.read_u64::<BigEndian>()?;
                Ok(GovernanceAction::UpgradeContract { code_id })
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
                Ok(GovernanceAction::SetValidPeriod { valid_seconds })
            }
            5 => {
                let governance_data_source_index = bytes.read_u32::<BigEndian>()?;
                Ok(GovernanceAction::RequestGovernanceDataSourceTransfer {
                    governance_data_source_index,
                })
            }
            _ => Err(format!("Unknown governance action type: {action_type}",)),
        };

        // Check that we're at the end of the buffer (to ensure that this contract knows how to
        // interpret every field in the governance message). The logic is a little janky
        // but seems to be the simplest way to check that the reader is at EOF.
        let mut next_byte = [0_u8; 1];
        let read_result = bytes.read(&mut next_byte);
        match read_result {
            Ok(0) => (),
            _ => Err("Governance action had an unexpectedly long payload.".to_string())?,
        }

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
            GovernanceAction::UpgradeContract { code_id } => {
                buf.write_u8(0)?;
                buf.write_u16::<BigEndian>(self.target_chain_id)?;
                buf.write_u64::<BigEndian>(*code_id)?;
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

#[cfg(test)]
mod test {
    use crate::governance::{GovernanceAction, GovernanceInstruction, GovernanceModule};

    #[test]
    fn test_payload_wrong_size() {
        let instruction = GovernanceInstruction {
            module: GovernanceModule::Target,
            action: GovernanceAction::SetFee {
                val: 100,
                expo: 200,
            },
            target_chain_id: 7,
        };

        let mut buf: Vec<u8> = instruction.serialize().unwrap();

        let result = GovernanceInstruction::deserialize(buf.as_slice());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), instruction);

        buf.push(0);
        let result = GovernanceInstruction::deserialize(buf.as_slice());
        assert!(result.is_err());

        let result = GovernanceInstruction::deserialize(&buf[0..buf.len() - 2]);
        assert!(result.is_err());
    }
}
