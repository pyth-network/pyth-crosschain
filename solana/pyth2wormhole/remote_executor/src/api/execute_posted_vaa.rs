
use std::str::FromStr;

use borsh::{BorshDeserialize, BorshSerialize};
use bridge::{VerifySignaturesData, PostVAAData, instructions::verify_signatures, SignatureSet, GuardianSet, instructions::post_vaa, CHAIN_ID_SOLANA};
use solana_program::{pubkey::Pubkey, program::{invoke, invoke_signed}, instruction::Instruction};
use solitaire::{FromAccounts, Signer, Mut, Info, Peel, Result as SoliResult, ExecutionContext as SolitaireContext, AccountState, Keyed, Data, Owned, AccountOwner};

use crate::{error::Error, types::ExecutorPayload};

const BRIDGE_PROGRAM_ID : &str = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU";
#[derive(FromAccounts)]
pub struct ExecuteVaa<'b> {
    pub payer: Mut<Signer<Info<'b>>>,
    pub signature_set: Mut<Signer<SignatureSet<'b, { AccountState::MaybeInitialized }>>>,
    pub guardian_set: GuardianSet<'b, { AccountState::Initialized }>,
    pub executor_pda : Data<'b, ExecutorAccount, { AccountState::MaybeInitialized}>
}

pub fn execute_vaa(ctx: &SolitaireContext, accs: &mut ExecuteVaa, data: ExecuteVaaData) -> SoliResult<()> {
    let bridge_pubkey : Pubkey = Pubkey::from_str(BRIDGE_PROGRAM_ID).unwrap();

    //Verify signatures
    let verify_signatures_ix = verify_signatures(bridge_pubkey, *accs.payer.key, data.post_vaa_data.guardian_set_index, *accs.signature_set.info().key, data.signatures_data)?; 
    invoke(&verify_signatures_ix, ctx.accounts)?;

    // Verify any required invariants before we process the instruction.
    let post_vaa_ix = post_vaa(bridge_pubkey, *accs.payer.key, *accs.signature_set.info().key, data.post_vaa_data.clone());
    invoke(&post_vaa_ix, ctx.accounts)?;

    // Check VAA origin
    assert_or_err( CHAIN_ID_SOLANA == data.post_vaa_data.emitter_chain , Error::InvalidSourceChain)?;
    // The executor (PDA signer) needs to be seeded by the emitter of the wormhole message
    assert_or_err( get_executor_pda( data.post_vaa_data.emitter_address, ctx.program_id) == *accs.executor_pda.info().key , Error::EmitterExecutorMismatch)?;
    // Seqno is increasing
    assert_or_err( data.post_vaa_data.sequence > accs.executor_pda.seqno, Error::SeqnoNeedsToBeIncreasing)?;
    accs.executor_pda.seqno = data.post_vaa_data.sequence;

    // Now deserialize 
    let payload = ExecutorPayload::try_from_slice(&data.post_vaa_data.payload)?;

    let bump = Pubkey::find_program_address(&[&data.post_vaa_data.emitter_address], ctx.program_id).1;
    for instruction in payload.instructions.iter().map(Instruction::from) {
        invoke_signed(&instruction, ctx.accounts, &[&[&data.post_vaa_data.emitter_address, &[bump]]])?;
    }

    Ok(())
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct ExecuteVaaData {
    pub signatures_data : VerifySignaturesData,
    pub post_vaa_data : PostVAAData
}

#[derive(Default, BorshSerialize, BorshDeserialize)]
pub struct ExecutorAccount{
    seqno : u64
}

impl Owned for ExecutorAccount {
    fn owner(&self) -> AccountOwner {
        return AccountOwner::This
    }
}

pub fn assert_or_err(condition : bool, error : Error) -> Result<(), Error>{
    if !condition {
        Result::Err(error)
    } else {
        Result::Ok(())
    }
}

pub fn get_executor_pda( emitter : [u8; 32], program_id : &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[emitter.as_slice()], program_id).0
}