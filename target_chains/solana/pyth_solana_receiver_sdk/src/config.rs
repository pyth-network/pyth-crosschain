use {anchor_lang::prelude::*, solana_program::pubkey::Pubkey};

#[account]
#[derive(Debug, PartialEq)]
pub struct Config {
    pub governance_authority: Pubkey, // This authority can update the other fields
    pub target_governance_authority: Option<Pubkey>, // This field is used for a two-step governance authority transfer
    pub wormhole: Pubkey,                            // The address of the wormhole receiver
    pub valid_data_sources: Vec<DataSource>, // The list of valid data sources for oracle price updates
    pub single_update_fee_in_lamports: u64,  // The fee in lamports for a single price update
    pub minimum_signatures: u8, // The minimum number of signatures required to accept a VAA
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub struct DataSource {
    pub chain: u16,
    pub emitter: Pubkey,
}

impl Config {
    pub const LEN: usize = 370; // This is two times the current size of a Config account with 2 data sources, to leave space for more fields
}

#[cfg(test)]
pub mod tests {
    use {
        super::DataSource,
        crate::config::Config,
        anchor_lang::{AnchorSerialize, Discriminator},
        solana_program::pubkey::Pubkey,
    };

    #[test]
    fn check_size() {
        let test_config = Config {
            governance_authority: Pubkey::new_unique(),
            target_governance_authority: Some(Pubkey::new_unique()),
            wormhole: Pubkey::new_unique(),
            valid_data_sources: vec![
                DataSource {
                    chain: 1,
                    emitter: Pubkey::new_unique(),
                },
                DataSource {
                    chain: 2,
                    emitter: Pubkey::new_unique(),
                },
            ],
            single_update_fee_in_lamports: 0,
            minimum_signatures: 0,
        };

        assert_eq!(
            test_config.try_to_vec().unwrap().len(),
            32 + 1 + 32 + 32 + 4 + 1 + 33 + 1 + 33 + 8 + 1
        );
        assert!(
            Config::discriminator().len() + test_config.try_to_vec().unwrap().len() <= Config::LEN
        );
    }
}
