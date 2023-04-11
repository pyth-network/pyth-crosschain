use {
    crate::{
        accumulator_input_seeds,
        instructions::InputSchemaAndData,
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
#[account(zero_copy)]
#[derive(Debug, InitSpace)]
pub struct AccumulatorInput {
    pub header: AccumulatorHeader,
    // 10KB - 8 (discriminator) - 2053 (header) - 11 (alignment)
    pub data:   [u8; 8_176],
}

//TODO:
// - implement custom serialization & set alignment
// - what other fields are needed?
#[zero_copy]
#[derive(InitSpace, Debug)]
pub struct AccumulatorHeader {
    pub bump:     u8,                // 1
    pub version:  u8,                // 2
    pub unused_0: u16,               // 2
    pub indexes:  [InputIndex; 255], // 2048
}

impl AccumulatorHeader {
    pub const CURRENT_VERSION: u8 = 1;

    pub fn new(bump: u8) -> Self {
        Self {
            bump,
            unused_0: 0,
            version: Self::CURRENT_VERSION,
            indexes: [InputIndex {
                offset:   0,
                unused_0: 0,
                len:      0,
            }; u8::MAX as usize],
        }
    }

    pub fn set_version(&mut self) {
        self.version = Self::CURRENT_VERSION;
    }
}

#[zero_copy]
#[derive(Debug, InitSpace)]
pub struct InputIndex {
    pub offset:   u32,
    pub len:      u16,
    pub unused_0: u16,
}

impl AccumulatorInput {
    pub const DATA_MAX_LEN: usize = (4 * 1024) - 8 - AccumulatorHeader::INIT_SPACE;

    pub fn init_size(values: &Vec<InputSchemaAndData>) -> usize {
        let mut size = AccumulatorHeader::INIT_SPACE + 4;
        for v in values {
            size += v.data.len();
        }
        size
    }

    pub fn size(&self) -> usize {
        AccumulatorHeader::INIT_SPACE + 4 + self.data.len()
    }

    pub fn offset(&self) -> u32 {
        self.header
            .indexes
            .iter()
            .map(|v| v.offset)
            .max()
            .unwrap_or_default()
    }


    pub fn new(bump: u8) -> Self {
        let header = AccumulatorHeader::new(bump);
        Self {
            header,
            data: [0u8; 8_176],
        }
    }

    pub fn put_all(&mut self, values: Vec<InputSchemaAndData>) -> Result<()> {
        let mut offset = self.offset();
        for v in values {
            let end;
            {
                let input_idx = &mut self.header.indexes[v.schema as usize];
                input_idx.len = v.data.len() as u16;
                input_idx.offset = offset;
                end = offset + input_idx.len as u32;
            }
            self.data[((offset as usize)..(end as usize))].copy_from_slice(&v.data);
            offset = end;
        }
        Ok(())
    }


    fn derive_pda(&self, cpi_caller: Pubkey, base_account: Pubkey) -> Result<Pubkey> {
        let res = Pubkey::create_program_address(
            accumulator_input_seeds!(self, cpi_caller, base_account),
            &crate::ID,
        )
        .map_err(|_| AccumulatorUpdaterError::InvalidPDA)?;
        Ok(res)
    }

    pub fn validate(&self, key: Pubkey, cpi_caller: Pubkey, base_account: Pubkey) -> Result<()> {
        let expected_key = self.derive_pda(cpi_caller, base_account)?;
        require_keys_eq!(expected_key, key);
        Ok(())
    }
}


#[cfg(test)]
mod test {
    use {
        super::*,
        std::mem::{
            align_of,
            size_of,
        },
    };

    #[test]
    fn test_sizes_and_alignments() {
        let (input_idx_size, input_idx_align) = (size_of::<InputIndex>(), align_of::<InputIndex>());

        let (header_idx_size, header_idx_align) = (
            size_of::<AccumulatorHeader>(),
            align_of::<AccumulatorHeader>(),
        );

        let (input_size, input_align) = (
            size_of::<AccumulatorInput>(),
            align_of::<AccumulatorInput>(),
        );

        //            input_idx
        //                 size: 8
        //                 align: 4
        //             header
        //                 size: 2044
        //                 align: 4
        //             input
        //                 size: 10220
        //                 align: 4
        println!(
            r"
            input_idx
                size: {input_idx_size:?}
                align: {input_idx_align:?}
            header
                size: {header_idx_size:?}
                align: {header_idx_align:?}
            input
                size: {input_size:?}
                align: {input_align:?}
        "
        )
    }
}
