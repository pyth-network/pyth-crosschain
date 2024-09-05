use bytemuck::{Pod, Zeroable};

/// Seed used to derive the config account.
pub const CONFIG_SEED: &str = "CONFIG";

/// Seed used to derive the associated buffer account that publishers can
/// write their updates into.
pub const PUBLISHER_CONFIG_SEED: &str = "PUBLISHER_CONFIG";

#[repr(u8)]
pub enum Instruction {
    // key[0] payer     [signer writable]
    // key[1] config    [writable]
    // key[2] system    []
    Initialize,
    // key[0] publisher        [signer writable]
    // key[1] publisher_config []
    // key[2] buffer           [writable]
    SubmitPrices,
    // key[0] autority         [signer writable]
    // key[1] config           []
    // key[2] publisher_config [writable]
    // key[3] buffer           [writable]
    // key[4] system           []
    InitializePublisher,
}

#[cfg(feature = "solana-program")]
impl Instruction {
    pub fn parse(input: &[u8]) -> Result<Instruction, solana_program::program_error::ProgramError> {
        match input.first() {
            Some(0) => Ok(Instruction::Initialize),
            Some(1) => Ok(Instruction::SubmitPrices),
            Some(2) => Ok(Instruction::InitializePublisher),
            _ => Err(solana_program::program_error::ProgramError::InvalidInstructionData),
        }
    }
}

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct InitializeArgs {
    /// PDA bump of the config account.
    pub config_bump: u8,
    /// The signature of the authority account will be required to execute
    /// `InitializePublisher` instruction.
    pub authority: [u8; 32],
}

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct InitializePublisherArgs {
    /// PDA bump of the config account.
    pub config_bump: u8,
    /// PDA bump of the publisher config account.
    pub publisher_config_bump: u8,
    /// The publisher to be initialized.
    pub publisher: [u8; 32],
}

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct SubmitPricesArgsHeader {
    /// PDA bump of the publisher config account.
    pub publisher_config_bump: u8,
}
