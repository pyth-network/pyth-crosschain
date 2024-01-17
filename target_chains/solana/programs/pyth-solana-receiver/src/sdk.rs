use {
    crate::{
        accounts,
        instruction,
        state::config::Config,
        CONFIG_SEED,
        ID,
        TREASURY_SEED,
    },
    anchor_lang::{
        prelude::*,
        system_program,
        InstructionData,
    },
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    solana_program::instruction::Instruction,
    wormhole_core_bridge_solana::state::GuardianSet,
};

impl accounts::Initialize {
    pub fn populate(payer: &Pubkey) -> Self {
        let config = get_config_address();
        accounts::Initialize {
            payer: *payer,
            config,
            system_program: system_program::ID,
        }
    }
}

impl accounts::PostUpdatesAtomic {
    pub fn populate(
        payer: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
    ) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address();

        let guardian_set = Pubkey::find_program_address(
            &[
                GuardianSet::SEED_PREFIX,
                guardian_set_index.to_be_bytes().as_ref(),
            ],
            &wormhole_address,
        )
        .0;

        accounts::PostUpdatesAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}

impl accounts::PostUpdates {
    pub fn populate(payer: Pubkey, encoded_vaa: Pubkey, price_update_account: Pubkey) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address();
        accounts::PostUpdates {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
        }
    }
}

impl accounts::Governance {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        accounts::Governance { payer, config }
    }
}

impl instruction::Initialize {
    pub fn populate(payer: &Pubkey, initial_config: Config) -> Instruction {
        Instruction {
            program_id: ID,
            accounts:   accounts::Initialize::populate(payer).to_account_metas(None),
            data:       instruction::Initialize { initial_config }.data(),
        }
    }
}

impl instruction::PostUpdates {
    pub fn populate(
        payer: Pubkey,
        encoded_vaa: Pubkey,
        price_update_account: Pubkey,
        merkle_price_update: MerklePriceUpdate,
    ) -> Instruction {
        let post_update_accounts =
            accounts::PostUpdates::populate(payer, encoded_vaa, price_update_account)
                .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts:   post_update_accounts,
            data:       instruction::PostUpdates {
                price_update: merkle_price_update,
            }
            .data(),
        }
    }
}

pub fn get_treasury_address() -> Pubkey {
    Pubkey::find_program_address(&[TREASURY_SEED.as_ref()], &ID).0
}

pub fn get_config_address() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &ID).0
}
