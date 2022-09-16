use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod remote_executor {
    use super::*;

    pub fn execute_posted_vaa(ctx: Context<ExecutePostedVaa>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecutePostedVaa {}
