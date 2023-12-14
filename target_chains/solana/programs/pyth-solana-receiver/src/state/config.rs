use {
    anchor_lang::prelude::*,
    solana_program::pubkey::Pubkey,
};

#[account]
pub struct Config {
    pub governance_authority:          Pubkey,
    pub target_governance_authority:   Option<Pubkey>,
    pub wormhole:                      Pubkey,
    pub valid_data_sources:            Vec<DataSource>,
    pub single_update_fee_in_lamports: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DataSource {
    pub chain:   u16,
    pub emitter: Pubkey,
}

impl Config {
    pub const LEN: usize = 370; // This is two times the current size of a Config account with 2 data sources, to leave space for more fields
}

#[cfg(test)]
pub mod tests {
    use {
        super::DataSource,
        crate::state::config::Config,
        anchor_lang::{
            AnchorSerialize,
            Discriminator,
        },
        solana_program::pubkey::Pubkey,
    };

    #[test]
    fn check_size() {
        let test_config = Config {
            governance_authority:          Pubkey::new_unique(),
            target_governance_authority:   Some(Pubkey::new_unique()),
            wormhole:                      Pubkey::new_unique(),
            valid_data_sources:            vec![
                DataSource {
                    chain:   1,
                    emitter: Pubkey::new_unique(),
                },
                DataSource {
                    chain:   2,
                    emitter: Pubkey::new_unique(),
                },
            ],
            single_update_fee_in_lamports: 0,
        };

        assert_eq!(
            test_config.try_to_vec().unwrap().len(),
            32 + 1 + 32 + 32 + 4 + 1 + 33 + 1 + 33 + 8
        );
        assert!(
            Config::discriminator().len() + test_config.try_to_vec().unwrap().len() <= Config::LEN
        );
    }
}
