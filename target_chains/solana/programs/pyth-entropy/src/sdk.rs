use {
    crate::{CONFIG_SEED, ID, PROVIDER_SEED, REQUEST_SEED, TREASURY_SEED},
    anchor_lang::{prelude::*, system_program, InstructionData},
    solana_program::instruction::Instruction,
};

pub fn get_config_address() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &ID).0
}

pub fn get_treasury_address() -> Pubkey {
    Pubkey::find_program_address(&[TREASURY_SEED], &ID).0
}

pub fn get_provider_info_address(provider: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[PROVIDER_SEED, provider.as_ref()], &ID).0
}

pub fn get_request_address(provider: &Pubkey, sequence_number: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[
            REQUEST_SEED,
            provider.as_ref(),
            &sequence_number.to_le_bytes(),
        ],
        &ID,
    )
    .0
}

pub struct InitializeAccounts {
    pub payer: Pubkey,
    pub config: Pubkey,
    pub system_program: Pubkey,
}

impl InitializeAccounts {
    pub fn populate(payer: Pubkey) -> Self {
        let config = get_config_address();
        InitializeAccounts {
            payer,
            config,
            system_program: system_program::ID,
        }
    }

    pub fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new(self.payer, true),
            AccountMeta::new(self.config, false),
            AccountMeta::new_readonly(self.system_program, false),
        ]
    }
}

pub struct RegisterAccounts {
    pub provider: Pubkey,
    pub provider_info: Pubkey,
    pub system_program: Pubkey,
}

impl RegisterAccounts {
    pub fn populate(provider: Pubkey) -> Self {
        let provider_info = get_provider_info_address(&provider);
        RegisterAccounts {
            provider,
            provider_info,
            system_program: system_program::ID,
        }
    }

    pub fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new(self.provider, true),
            AccountMeta::new(self.provider_info, false),
            AccountMeta::new_readonly(self.system_program, false),
        ]
    }
}

pub struct RequestV2Accounts {
    pub payer: Pubkey,
    pub requester: Pubkey,
    pub provider_info: Pubkey,
    pub config: Pubkey,
    pub request_account: Pubkey,
    pub treasury: Pubkey,
    pub system_program: Pubkey,
}

impl RequestV2Accounts {
    pub fn populate(
        payer: Pubkey,
        requester: Pubkey,
        provider: Pubkey,
        sequence_number: u64,
    ) -> Self {
        let config = get_config_address();
        let provider_info = get_provider_info_address(&provider);
        let request_account = get_request_address(&provider, sequence_number);
        let treasury = get_treasury_address();

        RequestV2Accounts {
            payer,
            requester,
            provider_info,
            config,
            request_account,
            treasury,
            system_program: system_program::ID,
        }
    }

    pub fn to_account_metas(&self, _is_signer: Option<bool>) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new(self.payer, true),
            AccountMeta::new_readonly(self.requester, true),
            AccountMeta::new(self.provider_info, false),
            AccountMeta::new_readonly(self.config, false),
            AccountMeta::new(self.request_account, false),
            AccountMeta::new(self.treasury, false),
            AccountMeta::new_readonly(self.system_program, false),
        ]
    }
}

impl crate::instruction::Initialize {
    pub fn populate(payer: Pubkey, initial_config: crate::EntropyConfig) -> Instruction {
        Instruction {
            program_id: ID,
            accounts: InitializeAccounts::populate(payer).to_account_metas(None),
            data: crate::instruction::Initialize { initial_config }.data(),
        }
    }
}

impl crate::instruction::Register {
    pub fn populate(
        provider: Pubkey,
        fee_in_lamports: u64,
        commitment: [u8; 32],
        commitment_metadata: Vec<u8>,
        chain_length: u64,
        uri: Vec<u8>,
    ) -> Instruction {
        Instruction {
            program_id: ID,
            accounts: RegisterAccounts::populate(provider).to_account_metas(None),
            data: crate::instruction::Register {
                fee_in_lamports,
                commitment,
                commitment_metadata,
                chain_length,
                uri,
            }
            .data(),
        }
    }
}

impl crate::instruction::RequestV2 {
    pub fn populate(
        payer: Pubkey,
        requester: Pubkey,
        provider: Pubkey,
        sequence_number: u64,
        gas_limit: u32,
    ) -> Instruction {
        Instruction {
            program_id: ID,
            accounts: RequestV2Accounts::populate(payer, requester, provider, sequence_number)
                .to_account_metas(None),
            data: crate::instruction::RequestV2 { gas_limit }.data(),
        }
    }
}
