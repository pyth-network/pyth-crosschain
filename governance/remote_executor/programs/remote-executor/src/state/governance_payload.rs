use {
    crate::error::ExecutorError,
    anchor_lang::{prelude::*, solana_program::instruction::Instruction},
    boolinator::Boolinator,
    std::{io::ErrorKind, mem::size_of, ops::Deref},
};

pub const MAGIC_NUMBER: u32 = 0x4d475450; // Reverse order of the solidity contract because borsh uses little endian numbers (the solidity contract uses 0x5054474d)

pub const CHAIN_ID_ARRAY: &[(&str, u16)] = &[
    ("pythnet", 26),
    ("pythtest", 26),
    ("eclipse_devnet", 40001),
    ("eclipse_testnet", 40002),
    ("eclipse_mainnet", 40003),
    ("mantis_testnet", 40004),
    ("sonic_devnet", 40005),
    ("sonic_testnet", 40006),
    ("atlas_testnet", 40007),
    ("mantis_mainnet", 40008),
    ("sonic_mainnet", 40009),
];

#[cfg(any(feature = "pythnet", feature = "pythtest"))]
pub const CHAIN_ID: u16 = 26;

#[cfg(feature = "eclipse_devnet")]
pub const CHAIN_ID: u16 = 40001;

#[cfg(feature = "eclipse_testnet")]
pub const CHAIN_ID: u16 = 40002;

#[cfg(feature = "eclipse_mainnet")]
pub const CHAIN_ID: u16 = 40003;

#[cfg(feature = "mantis_testnet")]
pub const CHAIN_ID: u16 = 40004;

#[cfg(feature = "sonic_devnet")]
pub const CHAIN_ID: u16 = 40005;

#[cfg(feature = "sonic_testnet")]
pub const CHAIN_ID: u16 = 40006;

#[cfg(feature = "atlas_testnet")]
pub const CHAIN_ID: u16 = 40007;

#[cfg(feature = "mantis_mainnet")]
pub const CHAIN_ID: u16 = 40008;

#[cfg(feature = "sonic_mainnet")]
pub const CHAIN_ID: u16 = 40009;

#[derive(AnchorDeserialize, AnchorSerialize, Debug, PartialEq, Eq)]
pub struct ExecutorPayload {
    pub header: GovernanceHeader,

    pub instructions: Vec<InstructionData>,
}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq, Eq, Debug)]
pub enum Module {
    Executor = 0,
    Target,
}

#[derive(AnchorDeserialize, AnchorSerialize, PartialEq, Eq, Debug)]
pub enum Action {
    ExecutePostedVaa = 0,
}

/// The Governance Header format for pyth governance messages is the following:
/// - A 4 byte magic number `['P','T','G','M']`
/// - A one byte module variant (0 for Executor and 1 for Target contracts)
/// - A one byte action variant (for Executor only 0 is currently valid)
/// - A bigendian 2 bytes u16 chain id
#[derive(AnchorDeserialize, AnchorSerialize, Eq, PartialEq, Debug)]
pub struct GovernanceHeader {
    pub magic_number: u32,
    pub module: Module,
    pub action: Action,
    pub chain: BigEndianU16,
}

impl GovernanceHeader {
    #[allow(unused)] // Only used in tests right now
    pub fn executor_governance_header(chain: u16) -> Self {
        Self {
            magic_number: MAGIC_NUMBER,
            module: Module::Executor,
            action: Action::ExecutePostedVaa,
            chain: BigEndianU16 { value: chain },
        }
    }
}

/// Hack to get Borsh to deserialize, serialize this number with big endian order
#[derive(Eq, PartialEq, Debug)]
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

impl From<&Instruction> for InstructionData {
    fn from(instruction: &Instruction) -> Self {
        InstructionData {
            program_id: instruction.program_id,
            accounts: instruction
                .accounts
                .iter()
                .map(|a| AccountMetaData {
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
        (self.header.magic_number == MAGIC_NUMBER)
            .ok_or(error!(ExecutorError::GovernanceHeaderInvalidMagicNumber))?;
        (self.header.module == ExecutorPayload::MODULE)
            .ok_or(error!(ExecutorError::GovernanceHeaderInvalidModule))?;
        (self.header.action == ExecutorPayload::ACTION)
            .ok_or(error!(ExecutorError::GovernanceHeaderInvalidAction))?;
        (self.header.chain.value == CHAIN_ID)
            .ok_or(error!(ExecutorError::GovernanceHeaderInvalidReceiverChain))
    }
}

#[cfg(test)]
pub mod tests {
    use {
        super::ExecutorPayload,
        crate::{
            error::ExecutorError,
            state::governance_payload::{InstructionData, CHAIN_ID},
        },
        anchor_lang::{
            prelude::{Pubkey, *},
            AnchorDeserialize, AnchorSerialize,
        },
    };

    #[test]
    fn test_check_deserialization_serialization() {
        // No instructions
        let payload = ExecutorPayload {
            header: super::GovernanceHeader::executor_governance_header(CHAIN_ID),
            instructions: vec![],
        };

        assert!(payload.check_header().is_ok());

        let payload_bytes = payload.try_to_vec().unwrap();
        assert_eq!(
            payload_bytes,
            vec![
                80,
                84,
                71,
                77,
                0,
                0,
                CHAIN_ID.to_be_bytes()[0],
                CHAIN_ID.to_be_bytes()[1],
                0,
                0,
                0,
                0
            ]
        );
        assert_eq!(
            payload_bytes,
            vec![
                80,
                84,
                71,
                77,
                0,
                0,
                CHAIN_ID.to_be_bytes()[0],
                CHAIN_ID.to_be_bytes()[1],
                0,
                0,
                0,
                0
            ]
        );

        let deserialized_payload =
            ExecutorPayload::try_from_slice(payload_bytes.as_slice()).unwrap();
        assert_eq!(payload, deserialized_payload);

        // One instruction
        let payload = ExecutorPayload {
            header: super::GovernanceHeader::executor_governance_header(CHAIN_ID),

            instructions: vec![InstructionData::from(
                &anchor_lang::solana_program::system_instruction::create_account(
                    &Pubkey::new_unique(),
                    &Pubkey::new_unique(),
                    1,
                    1,
                    &Pubkey::new_unique(),
                ),
            )],
        };

        assert!(payload.check_header().is_ok());

        let payload_bytes = payload.try_to_vec().unwrap();
        assert_eq!(
            payload_bytes[..12],
            vec![
                80,
                84,
                71,
                77,
                0,
                0,
                CHAIN_ID.to_be_bytes()[0],
                CHAIN_ID.to_be_bytes()[1],
                1,
                0,
                0,
                0
            ]
        );

        let deserialized_payload =
            ExecutorPayload::try_from_slice(payload_bytes.as_slice()).unwrap();
        assert_eq!(payload, deserialized_payload);

        // Module outside of range
        let payload_bytes = vec![
            80,
            84,
            71,
            77,
            3,
            0,
            CHAIN_ID.to_be_bytes()[0],
            CHAIN_ID.to_be_bytes()[1],
            0,
            0,
            0,
            0,
            0,
        ];
        assert!(ExecutorPayload::try_from_slice(payload_bytes.as_slice()).is_err());

        // Wrong module
        let payload_bytes = vec![
            80,
            84,
            71,
            77,
            1,
            0,
            CHAIN_ID.to_be_bytes()[0],
            CHAIN_ID.to_be_bytes()[1],
            0,
            0,
            0,
            0,
        ];
        let deserialized_payload =
            ExecutorPayload::try_from_slice(payload_bytes.as_slice()).unwrap();
        assert_eq!(
            deserialized_payload.check_header(),
            Err(error!(ExecutorError::GovernanceHeaderInvalidModule))
        );

        // Wrong magic
        let payload_bytes = vec![
            81,
            84,
            71,
            77,
            1,
            0,
            CHAIN_ID.to_be_bytes()[0],
            CHAIN_ID.to_be_bytes()[1],
            0,
            0,
            0,
            0,
        ];
        let deserialized_payload =
            ExecutorPayload::try_from_slice(payload_bytes.as_slice()).unwrap();
        assert_eq!(
            deserialized_payload.check_header(),
            Err(error!(ExecutorError::GovernanceHeaderInvalidMagicNumber))
        );

        // Action outside of range
        let payload_bytes = vec![
            80,
            84,
            71,
            77,
            0,
            1,
            CHAIN_ID.to_be_bytes()[0],
            CHAIN_ID.to_be_bytes()[1],
            0,
            0,
            0,
            0,
        ];
        assert!(ExecutorPayload::try_from_slice(payload_bytes.as_slice()).is_err());

        // Wrong receiver chain endianess
        let payload_bytes = vec![
            80,
            84,
            71,
            77,
            0,
            0,
            CHAIN_ID.to_be_bytes()[1],
            CHAIN_ID.to_be_bytes()[0],
            0,
            0,
            0,
            0,
        ];
        let deserialized_payload =
            ExecutorPayload::try_from_slice(payload_bytes.as_slice()).unwrap();
        assert_eq!(
            deserialized_payload.check_header(),
            Err(error!(ExecutorError::GovernanceHeaderInvalidReceiverChain))
        );

        // Wrong vector format
        let payload_bytes = vec![
            80,
            84,
            71,
            77,
            0,
            0,
            CHAIN_ID.to_be_bytes()[0],
            CHAIN_ID.to_be_bytes()[1],
            1,
            0,
            0,
            0,
        ];
        assert!(ExecutorPayload::try_from_slice(payload_bytes.as_slice()).is_err());
    }
}
