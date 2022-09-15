use borsh::{BorshDeserialize, BorshSerialize};
use solitaire::{FromAccounts, Signer, Mut, Info, Peel, Result as SoliResult, ExecutionContext as SolitaireContext};

#[derive(FromAccounts)]
pub struct ExecuteVaa<'b> {
    pub payer: Mut<Signer<Info<'b>>>,
}

pub fn execute_vaa(_ctx: &SolitaireContext, _accs: &mut ExecuteVaa, _data: ExecuteVaaData) -> SoliResult<()> {
    Ok(())
}


#[derive(BorshDeserialize, BorshSerialize)]
pub struct ExecuteVaaData {
}
