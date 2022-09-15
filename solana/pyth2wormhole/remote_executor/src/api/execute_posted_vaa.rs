use borsh::{BorshDeserialize, BorshSerialize};
use solitaire::{FromAccounts, Signer, Mut, Info, Peel, Result as SoliResult, ExecutionContext as SolitaireContext};

#[derive(FromAccounts)]
pub struct ExecutePostedVaa<'b> {
    pub payer: Mut<Signer<Info<'b>>>,
}

pub fn execute_posted_vaa(_ctx: &SolitaireContext, _accs: &mut ExecutePostedVaa, _data: ExecutePostedVaaData) -> SoliResult<()> {
    Ok(())
}


#[derive(BorshDeserialize, BorshSerialize)]
pub struct ExecutePostedVaaData {
}
