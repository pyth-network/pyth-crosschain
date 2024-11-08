use anchor_lang::prelude::*;

declare_id!("ujSFv8q8woXW5PUnby52PQyxYGUudxkrvgN6A631Qmm");

pub const PARAMETERS_ADDRESS: Pubkey = pubkey!("879ZVNagiWaAKsWDjGVf8pLq1wUBeBz7sREjUh3hrU36");

#[program]
pub mod stake_caps_parameters {
    use super::*;

    pub fn set_parameters(ctx: Context<SetParameters>, parameters: Parameters) -> Result<()> {
        let stored_parameters = &mut ctx.accounts.parameters;
        require!(
            ctx.accounts.signer.key() == stored_parameters.current_authority
                || stored_parameters.current_authority == Pubkey::default(),
            ErrorCode::WrongAuthority
        );
        **stored_parameters = parameters;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetParameters<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init_if_needed,
        seeds = ["parameters".as_bytes()],
        bump,
        payer = signer,
        space = Parameters::LEN
    )]
    pub parameters: Account<'info, Parameters>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(PartialEq, Eq, Debug, Copy)]
pub struct Parameters {
    pub current_authority: Pubkey,
    pub m: u64,
    pub z: u64,
}

impl Parameters {
    pub const LEN: usize = 1000; // upper bound so we can add other fields later
}

#[error_code]
pub enum ErrorCode {
    WrongAuthority,
}
