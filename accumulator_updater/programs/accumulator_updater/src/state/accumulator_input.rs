use {
    crate::{
        accumulator_input_seeds,
        AccumulatorUpdaterError,
    },
    anchor_lang::prelude::*,
};

/// `AccumulatorInput` is an arbitrary set of bytes
/// that will be included in the AccumulatorSysvar
///
///
/// The actual contents of data are set/handled by
/// the CPI calling program (e.g. Pyth Oracle)
///
/// TODO: implement custom serialization & set alignment
#[account]
pub struct AccumulatorInput {
    pub header: AccumulatorHeader,
    pub data:   Vec<u8>,
}

impl AccumulatorInput {
    pub fn size(data: &Vec<u8>) -> usize {
        AccumulatorHeader::SIZE + 4 + data.len()
    }

    pub fn new(header: AccumulatorHeader, data: Vec<u8>) -> Self {
        Self { header, data }
    }

    pub fn update(&mut self, new_data: Vec<u8>) {
        self.header = AccumulatorHeader::new(self.header.bump, self.header.account_schema);
        self.data = new_data;
    }

    fn derive_pda(&self, cpi_caller: Pubkey, base_account: Pubkey) -> Result<Pubkey> {
        let res = Pubkey::create_program_address(
            accumulator_input_seeds!(self, cpi_caller, base_account),
            &crate::ID,
        )
        .map_err(|_| AccumulatorUpdaterError::InvalidPDA)?;
        Ok(res)
    }

    pub fn validate(
        &self,
        key: Pubkey,
        cpi_caller: Pubkey,
        base_account: Pubkey,
        account_schema: u8,
    ) -> Result<()> {
        let expected_key = self.derive_pda(cpi_caller, base_account)?;
        require_keys_eq!(expected_key, key);
        require_eq!(self.header.account_schema, account_schema);
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
    pub account_schema: u8,
}


impl AccumulatorHeader {
    pub const SIZE: usize = 1 + 1 + 1;
    pub const CURRENT_VERSION: u8 = 1;

    pub fn new(bump: u8, account_schema: u8) -> Self {
        Self {
            bump,
            version: Self::CURRENT_VERSION,
            account_schema,
        }
    }
}
