mod initialize;
mod initialize_publisher;
mod submit_prices;

use {
    crate::{
        ensure,
        instruction::{
            InitializeArgs, InitializePublisherArgs, Instruction, SubmitPricesArgsHeader,
        },
    },
    bytemuck::try_from_bytes,
    initialize::initialize,
    initialize_publisher::initialize_publisher,
    solana_program::{
        account_info::AccountInfo, entrypoint::ProgramResult, program_error::ProgramError,
        pubkey::Pubkey,
    },
    std::mem::size_of,
    submit_prices::submit_prices,
};

solana_program::entrypoint!(process_instruction);
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (instruction, payload) = Instruction::parse(data)?;
    match instruction {
        Instruction::Initialize => {
            let args: &InitializeArgs =
                try_from_bytes(payload).map_err(|_| ProgramError::InvalidInstructionData)?;
            initialize(program_id, accounts, args)
        }
        Instruction::SubmitPrices => {
            ensure!(
                ProgramError::InvalidInstructionData,
                payload.len() >= size_of::<SubmitPricesArgsHeader>()
            );
            let (args_data, prices_data) = payload.split_at(size_of::<SubmitPricesArgsHeader>());
            let args: &SubmitPricesArgsHeader =
                try_from_bytes(args_data).map_err(|_| ProgramError::InvalidInstructionData)?;
            submit_prices(program_id, accounts, args, prices_data)
        }
        Instruction::InitializePublisher => {
            let args: &InitializePublisherArgs =
                try_from_bytes(payload).map_err(|_| ProgramError::InvalidInstructionData)?;
            initialize_publisher(program_id, accounts, args)
        }
    }
}
