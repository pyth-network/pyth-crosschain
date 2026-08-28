mod governance;
pub use governance::*;

mod initialize;
pub use initialize::*;

mod post_vaa;
pub use post_vaa::*;

mod verify_signatures;
pub use verify_signatures::*;

use crate::legacy::utils::ProcessLegacyInstruction;
use anchor_lang::prelude::*;

use super::instruction::LegacyInstruction;

pub fn process_legacy_instruction<'info>(
    program_id: &'info Pubkey,
    account_infos: &'info [AccountInfo<'info>],
    mut ix_data: &[u8],
) -> Result<()> {
    // TODO: This may not be necessary. Double-check in integration test.
    require!(
        *program_id == crate::ID,
        ErrorCode::DeclaredProgramIdMismatch
    );

    // Deserialize instruction data. The data should match the instruction
    // enum. Otherwise, we bail out.
    match LegacyInstruction::deserialize(&mut ix_data)? {
        LegacyInstruction::Initialize => {
            Initialize::process_instruction(program_id, account_infos, ix_data)
        }
        LegacyInstruction::PostVaa => {
            PostVaa::process_instruction(program_id, account_infos, ix_data)
        }
        LegacyInstruction::GuardianSetUpdate => {
            GuardianSetUpdate::process_instruction(program_id, account_infos, ix_data)
        }
        LegacyInstruction::VerifySignatures => {
            VerifySignatures::process_instruction(program_id, account_infos, ix_data)
        }
        LegacyInstruction::_RemovedPostMessage
        | LegacyInstruction::_RemovedSetMessageFee
        | LegacyInstruction::_RemovedTransferFees
        | LegacyInstruction::_RemovedUpgradeContract
        | LegacyInstruction::_RemovedPostMessageUnreliable
        | LegacyInstruction::_RemovedUpdateGuardianSetTtl => {
            err!(crate::error::CoreBridgeError::InstructionRemoved)
        }
    }
}
