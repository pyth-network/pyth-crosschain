use anchor_lang::{prelude::*, solana_program::instruction::Instruction};

use crate::{assert_or_err, error::ExecutorError};

pub const MAGIC_NUMBER : u32 = 0x5054474d;
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ExecutorPayload{
    pub header : GovernanceHeader,
    pub instructions: Vec<InstructionData>,

}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq)]
pub enum Module {
    Executor = 0,
    Target 
}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq)]
pub enum Action {
    ExecutePostedVaa = 0,
}

#[repr(u16)]
#[derive(AnchorDeserialize, AnchorSerialize, PartialEq)]
pub enum ReceiverChain {
    Pythnet = 26,
}


#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct GovernanceHeader {
    pub magic_number : u32,
    pub module : Module,
    pub action : Action,
    pub chain : ReceiverChain
}

/// InstructionData wrapper. It can be removed once Borsh serialization for Instruction is supported in the SDK
#[derive(Clone, Debug, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct InstructionData {
    /// Pubkey of the instruction processor that executes this instruction
    pub program_id: Pubkey,
    /// Metadata for what accounts should be passed to the instruction processor
    pub accounts: Vec<AccountMetaData>,
    /// Opaque data passed to the instruction processor
    pub data: Vec<u8>,
}

/// Account metadata used to define Instructions
#[derive(Clone, Debug, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct AccountMetaData {
    /// An account's public key
    pub pubkey: Pubkey,
    /// True if an Instruction requires a Transaction signature matching `pubkey`.
    pub is_signer: bool,
    /// True if the `pubkey` can be loaded as a read-write account.
    pub is_writable: bool,
}

impl From<&InstructionData> for Instruction {
    fn from(instruction: &InstructionData) -> Self {
        Instruction {
            program_id: instruction.program_id,
            accounts: instruction
                .accounts
                .iter()
                .map(|a| AccountMeta {
                    pubkey: a.pubkey,
                    is_signer: a.is_signer,
                    is_writable: a.is_writable,
                })
                .collect(),
            data: instruction.data.clone(),
        }
    }
}

impl ExecutorPayload {
    const MODULE : Module = Module::Executor;
    const ACTION : Action = Action::ExecutePostedVaa;
    const RECEIVER_CHAIN : ReceiverChain = ReceiverChain::Pythnet;

    pub fn check_header(&self) -> Result<()>{
        assert_or_err(self.header.magic_number == MAGIC_NUMBER, err!(ExecutorError::GovernanceHeaderInvalidMagicNumber))?;
        assert_or_err(self.header.module == ExecutorPayload::MODULE, err!(ExecutorError::GovernanceHeaderInvalidMagicNumber))?;
        assert_or_err(self.header.action == ExecutorPayload::ACTION, err!(ExecutorError::GovernanceHeaderInvalidMagicNumber))?;
        assert_or_err(self.header.chain == ExecutorPayload::RECEIVER_CHAIN, err!(ExecutorError::GovernanceHeaderInvalidMagicNumber))
    }
}