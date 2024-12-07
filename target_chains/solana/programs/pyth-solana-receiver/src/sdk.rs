use {
    crate::{accounts, instruction, ID},
    anchor_lang::{prelude::*, system_program, InstructionData},
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        pda::{get_config_address, get_treasury_address},
        PostTwapUpdateParams, PostUpdateAtomicParams, PostUpdateParams,
    },
    pythnet_sdk::wire::v1::{AccumulatorUpdateData, MerklePriceUpdate, Proof},
    rand::Rng,
    solana_program::instruction::Instruction,
    wormhole_core_bridge_solana::state::GuardianSet,
};

/**
 * This constant is used to efficiently pack transactions when writing an encoded Pyth VAA to the Wormhole contract.
 * Posting a VAA requires two transactions. If you split the VAA at this index when writing it, the first transaction will be almost full.
 */
pub const VAA_SPLIT_INDEX: usize = 755;

pub const DEFAULT_TREASURY_ID: u8 = 0;
pub const SECONDARY_TREASURY_ID: u8 = 1;

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

impl accounts::PostUpdateAtomic {
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
        treasury_id: u8,
    ) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address(treasury_id);

        let guardian_set = get_guardian_set_address(wormhole_address, guardian_set_index);

        accounts::PostUpdateAtomic {
            payer,
            guardian_set,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
            write_authority,
        }
    }
}

impl accounts::PostUpdate {
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        encoded_vaa: Pubkey,
        price_update_account: Pubkey,
        treasury_id: u8,
    ) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address(treasury_id);
        accounts::PostUpdate {
            payer,
            encoded_vaa,
            config,
            treasury,
            price_update_account,
            system_program: system_program::ID,
            write_authority,
        }
    }
}

impl accounts::PostTwapUpdate {
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        start_encoded_vaa: Pubkey,
        end_encoded_vaa: Pubkey,
        twap_update_account: Pubkey,
        treasury_id: u8,
    ) -> Self {
        let config = get_config_address();
        let treasury = get_treasury_address(treasury_id);
        accounts::PostTwapUpdate {
            payer,
            start_encoded_vaa,
            end_encoded_vaa,
            config,
            treasury,
            twap_update_account,
            system_program: system_program::ID,
            write_authority,
        }
    }
}

impl accounts::Governance {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        accounts::Governance { payer, config }
    }
}

impl accounts::AcceptGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        accounts::AcceptGovernanceAuthorityTransfer { payer, config }
    }
}

impl accounts::ReclaimRent {
    pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Self {
        let _config = get_config_address();
        accounts::ReclaimRent {
            payer,
            price_update_account,
        }
    }
}

impl instruction::Initialize {
    pub fn populate(payer: &Pubkey, initial_config: Config) -> Instruction {
        Instruction {
            program_id: ID,
            accounts: accounts::Initialize::populate(payer).to_account_metas(None),
            data: instruction::Initialize { initial_config }.data(),
        }
    }
}

impl instruction::PostUpdate {
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        encoded_vaa: Pubkey,
        price_update_account: Pubkey,
        merkle_price_update: MerklePriceUpdate,
        treasury_id: u8,
    ) -> Instruction {
        let post_update_accounts = accounts::PostUpdate::populate(
            payer,
            write_authority,
            encoded_vaa,
            price_update_account,
            treasury_id,
        )
        .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: post_update_accounts,
            data: instruction::PostUpdate {
                params: PostUpdateParams {
                    merkle_price_update,
                    treasury_id,
                },
            }
            .data(),
        }
    }
}

impl instruction::PostUpdateAtomic {
    #[allow(clippy::too_many_arguments)]
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        price_update_account: Pubkey,
        wormhole_address: Pubkey,
        guardian_set_index: u32,
        vaa: Vec<u8>,
        merkle_price_update: MerklePriceUpdate,
        treasury_id: u8,
    ) -> Instruction {
        let post_update_accounts = accounts::PostUpdateAtomic::populate(
            payer,
            write_authority,
            price_update_account,
            wormhole_address,
            guardian_set_index,
            treasury_id,
        )
        .to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: post_update_accounts,
            data: instruction::PostUpdateAtomic {
                params: PostUpdateAtomicParams {
                    vaa,
                    merkle_price_update,
                    treasury_id,
                },
            }
            .data(),
        }
    }
}
impl instruction::PostTwapUpdate {
    #[allow(clippy::too_many_arguments)]
    pub fn populate(
        payer: Pubkey,
        write_authority: Pubkey,
        start_encoded_vaa: Pubkey,
        end_encoded_vaa: Pubkey,
        twap_update_account: Pubkey,
        start_merkle_price_update: MerklePriceUpdate,
        end_merkle_price_update: MerklePriceUpdate,
        treasury_id: u8,
    ) -> Instruction {
        let post_twap_accounts = accounts::PostTwapUpdate::populate(
            payer,
            write_authority,
            start_encoded_vaa,
            end_encoded_vaa,
            twap_update_account,
            treasury_id,
        )
        .to_account_metas(None);

        Instruction {
            program_id: ID,
            accounts: post_twap_accounts,
            data: instruction::PostTwapUpdate {
                params: PostTwapUpdateParams {
                    start_merkle_price_update,
                    end_merkle_price_update,
                    treasury_id,
                },
            }
            .data(),
        }
    }
}
impl instruction::SetDataSources {
    pub fn populate(payer: Pubkey, data_sources: Vec<DataSource>) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::SetDataSources {
                valid_data_sources: data_sources,
            }
            .data(),
        }
    }
}

impl instruction::SetFee {
    pub fn populate(payer: Pubkey, fee: u64) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::SetFee {
                single_update_fee_in_lamports: fee,
            }
            .data(),
        }
    }
}

impl instruction::SetWormholeAddress {
    pub fn populate(payer: Pubkey, wormhole: Pubkey) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::SetWormholeAddress { wormhole }.data(),
        }
    }
}

impl instruction::SetMinimumSignatures {
    pub fn populate(payer: Pubkey, minimum_signatures: u8) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::SetMinimumSignatures { minimum_signatures }.data(),
        }
    }
}

impl instruction::RequestGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey, target_governance_authority: Pubkey) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::RequestGovernanceAuthorityTransfer {
                target_governance_authority,
            }
            .data(),
        }
    }
}

impl instruction::CancelGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey) -> Instruction {
        let governance_accounts = accounts::Governance::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::CancelGovernanceAuthorityTransfer.data(),
        }
    }
}

impl instruction::AcceptGovernanceAuthorityTransfer {
    pub fn populate(payer: Pubkey) -> Instruction {
        let governance_accounts =
            accounts::AcceptGovernanceAuthorityTransfer::populate(payer).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::AcceptGovernanceAuthorityTransfer {}.data(),
        }
    }
}

impl instruction::ReclaimRent {
    pub fn populate(payer: Pubkey, price_update_account: Pubkey) -> Instruction {
        let governance_accounts =
            accounts::ReclaimRent::populate(payer, price_update_account).to_account_metas(None);
        Instruction {
            program_id: ID,
            accounts: governance_accounts,
            data: instruction::ReclaimRent {}.data(),
        }
    }
}

pub fn get_guardian_set_address(wormhole_address: Pubkey, guardian_set_index: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            GuardianSet::SEED_PREFIX,
            guardian_set_index.to_be_bytes().as_ref(),
        ],
        &wormhole_address,
    )
    .0
}

pub fn deserialize_accumulator_update_data(
    accumulator_message: Vec<u8>,
) -> Result<(Vec<u8>, Vec<MerklePriceUpdate>)> {
    let accumulator_update_data =
        AccumulatorUpdateData::try_from_slice(accumulator_message.as_slice()).unwrap();

    match accumulator_update_data.proof {
        Proof::WormholeMerkle { vaa, updates } => return Ok((vaa.as_ref().to_vec(), updates)),
    }
}

pub fn get_random_treasury_id() -> u8 {
    rand::thread_rng().gen()
}
