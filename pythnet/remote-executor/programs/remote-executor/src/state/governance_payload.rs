use std::{
    io::ErrorKind,
    mem::size_of,
    ops::Deref,
};

use anchor_lang::{
    prelude::*,
    solana_program::instruction::Instruction,
};
use wormhole::Chain;

use crate::{
    assert_or_err,
    error::ExecutorError,
};

pub const MAGIC_NUMBER: u32 = 0x4d475450; // Reverse order of the solidity contract because borsh uses little endian numbers

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ExecutorPayload {
    pub header: GovernanceHeader,

    pub instructions: Vec<InstructionData>,
}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq, Eq)]
pub enum Module {
    Executor = 0,
    Target,
}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq, Eq)]
pub enum Action {
    ExecutePostedVaa = 0,
}

/// The Governance Header format for pyth governance messages is the following:
/// - A 4 byte magic number `['P','T','G','M']`
/// - A one byte module variant (0 for Executor and 1 for Target contracts)
/// - A one byte action variant (for Executor only 0 is currently valid)
/// - A bigendian 2 bytes u16 chain id
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct GovernanceHeader {
    pub magic_number: u32,
    pub module: Module,
    pub action: Action,
    pub chain: BigEndianU16,
}

/// Hack to get Borsh to deserialize, serialize this number with big endian order
pub struct BigEndianU16 {
    pub value: u16,
}

impl AnchorDeserialize for BigEndianU16 {
    fn deserialize(buf: &mut &[u8]) -> std::result::Result<BigEndianU16, std::io::Error> {
        if buf.len() < size_of::<u16>() {
            return Err(std::io::Error::new(
                ErrorKind::InvalidInput,
                "Unexpected length of input",
            ));
        }
        let res = u16::from_be_bytes(buf[..size_of::<u16>()].try_into().unwrap());
        *buf = &buf[size_of::<u16>()..];
        Ok(BigEndianU16 { value: res })
    }
}

impl AnchorSerialize for BigEndianU16 {
    fn serialize<W: std::io::Write>(&self, writer: &mut W) -> std::io::Result<()> {
        writer.write_all(&self.to_be_bytes())
    }
}

impl Deref for BigEndianU16 {
    type Target = u16;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
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
    const MODULE: Module = Module::Executor;
    const ACTION: Action = Action::ExecutePostedVaa;

    pub fn check_header(&self) -> Result<()> {
        assert_or_err(
            self.header.magic_number == MAGIC_NUMBER,
            err!(ExecutorError::GovernanceHeaderInvalidMagicNumber),
        )?;
        assert_or_err(
            self.header.module == ExecutorPayload::MODULE,
            err!(ExecutorError::GovernanceHeaderInvalidMagicNumber),
        )?;
        assert_or_err(
            self.header.action == ExecutorPayload::ACTION,
            err!(ExecutorError::GovernanceHeaderInvalidMagicNumber),
        )?;
        assert_or_err(
            Chain::from(self.header.chain.value) == Chain::Pythnet,
            err!(ExecutorError::GovernanceHeaderInvalidMagicNumber),
        )
    }
}
