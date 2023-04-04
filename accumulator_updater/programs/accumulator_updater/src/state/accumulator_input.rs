use {
    crate::{
        accumulator_acc_seeds_with_bump,
        AccumulatorUpdaterError,
    },
    anchor_lang::prelude::*,
};

//TODO: implement custom serialization & set alignment
#[account]
pub struct AccumulatorInput {
    pub header: AccumulatorHeader,
    pub data:   Vec<u8>,
}

impl AccumulatorInput {
    pub fn get_initial_size(data: &Vec<u8>) -> usize {
        AccumulatorHeader::SIZE + 4 + data.len()
    }

    pub fn new(header: AccumulatorHeader, data: Vec<u8>) -> Self {
        Self { header, data }
    }

    pub fn validate_account_info(
        accumulator_input_key: Pubkey,
        accumulator_input: &AccumulatorInput,
        cpi_caller: Pubkey,
        base_account: Pubkey,
        account_type: u32,
        account_schema: u8,
    ) -> Result<()> {
        // let pubkey = ai.key();
        let expected_key = Pubkey::create_program_address(
            accumulator_acc_seeds_with_bump!(
                cpi_caller,
                base_account,
                account_schema,
                accumulator_input.header.bump
            ),
            &crate::ID,
        )
        .map_err(|_| AccumulatorUpdaterError::InvalidPDA)?;
        require_keys_eq!(expected_key, accumulator_input_key);
        require_eq!(accumulator_input.header.account_type, account_type);
        require_eq!(accumulator_input.header.account_schema, account_schema);

        Ok(())
    }

    pub fn persist(&self, ai: &AccountInfo) -> Result<()> {
        AccountSerialize::try_serialize(self, &mut &mut ai.data.borrow_mut()[..]).map_err(|e| {
            msg!("original error: {:?}", e);
            AccumulatorUpdaterError::SerializeError
        })?;
        Ok(())
    }
}

//TODO:
// - implement custom serialization & set alignment
// - what other fields are needed?
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AccumulatorHeader {
    pub bump:           u8,
    pub version:        u8,
    // u32 for parity with pyth oracle contract
    pub account_type:   u32,
    pub account_schema: u8,
}


impl AccumulatorHeader {
    pub const SIZE: usize = 1 + 1 + 4 + 1;

    pub fn new(bump: u8, version: u8, account_type: u32, account_schema: u8) -> Self {
        Self {
            bump,
            version,
            account_type,
            account_schema,
        }
    }
}
