use anchor_lang::prelude::*;

pub struct PythSolanaReceiver;

impl Id for PythSolanaReceiver {
    fn id() -> Pubkey {
        crate::ID
    }
}
