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
    // 10KB - 8 (discriminator) - 514 (header)
    // TODO: do we want to initialize this to the max size?
    //   - will lead to more data being passed around for validators
    pub data:   [u8; 9_718],
}

//TODO:
// - implement custom serialization & set alignment
// - what other fields are needed?
#[zero_copy]
#[derive(InitSpace, Debug)]
pub struct AccumulatorHeader {
    pub bump:        u8, // 1
    pub version:     u8, // 1
    // byte offset of accounts where data starts
    // e.g. account_info.data[offset + header_len]
    pub header_len:  u16, // 2
    /// endpoints of every message.
    /// ex: [10, 14]
    /// => msg1 = data[(header_len + 0)..(header_len + 10)]
    /// => msg2 = data[(header_len + 10)..(header_len + 14)]
    pub end_offsets: [u16; 255], // 510
}

impl AccumulatorHeader {
    // header_size. Keeping same structure as `BatchPriceAttestation` header
    // HEADER_LEN allows for append-only forward-compatibility for the header.
    // this is the number of bytes from the beginning of the account_info.data
    // to the start of the `AccumulatorInput` data.
    //
    // *NOTE* this implementation is slightly different
    // than the `BatchPriceAttestation` header_size
    pub const HEADER_LEN: u16 = 8 + AccumulatorHeader::INIT_SPACE as u16;

    pub const CURRENT_VERSION: u8 = 1;

    pub fn new(bump: u8) -> Self {
        Self {
            bump,
            header_len: Self::HEADER_LEN,
            version: Self::CURRENT_VERSION,
            end_offsets: [0u16; u8::MAX as usize],
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

    pub fn new(bump: u8) -> Self {
        let header = AccumulatorHeader::new(bump);
        Self {
            header,
            data: [0u8; 9_718],
        }
    }

    // note: this does not handle if multiple CPI calls
    // need to be made to write all the messages
    // TODO: add a end_offsets index parameter for "continuation"
    // TODO: test max size of parameters that can be passed into CPI call
    pub fn put_all(&mut self, values: Vec<Vec<u8>>) -> Result<()> {
        let mut offset = 0u16;

        for (i, v) in values.into_iter().enumerate() {
            let start = offset;
            let end = offset + (v.len() as u16);
            self.header.end_offsets[i] = end;
            self.data[(start as usize)..(end as usize)].copy_from_slice(&v);
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
        bytemuck::bytes_of,
        std::mem::{
            align_of,
            size_of,
        },
    };

    fn data_bytes(data: Vec<u16>) -> Vec<u8> {
        let mut bytes = vec![];
        for d in data {
            bytes.extend_from_slice(&d.to_be_bytes());
        }
        bytes
    }

    fn create_accumulator_input(data: Vec<Vec<u16>>) -> AccumulatorInput {
        let mut ai = AccumulatorInput::new(0);
        let mut ai_data = vec![];
        for d in data {
            ai_data.push(data_bytes(d));
        }
        ai.put_all(ai_data).unwrap();
        ai
    }

    #[test]
    fn test_sizes_and_alignments() {
        let (header_idx_size, header_idx_align) = (
            size_of::<AccumulatorHeader>(),
            align_of::<AccumulatorHeader>(),
        );

        let (input_size, input_align) = (
            size_of::<AccumulatorInput>(),
            align_of::<AccumulatorInput>(),
        );


        println!(
            r"

            header
                size: {header_idx_size:?}
                align: {header_idx_align:?}
            input
                size: {input_size:?}
                align: {input_align:?}
        "
        );
        assert_eq!(header_idx_size, 514);
        assert_eq!(header_idx_align, 2);
        assert_eq!(input_size, 10_232);
        assert_eq!(input_align, 2);
    }

    #[test]
    fn test_put_all() {
        let data = vec![vec![12, 34], vec![56, 78, 90]];
        let accumulator_input = &mut create_accumulator_input(data.clone());

        assert_eq!(accumulator_input.header.end_offsets[0], 4);
        assert_eq!(accumulator_input.header.end_offsets[1], 10);

        let data_bytes: Vec<Vec<u8>> = data.iter().map(|x| data_bytes(x.clone())).collect();

        let accumulator_input_bytes = bytes_of(accumulator_input);

        // *note* minus 8 here since no account discriminator when using
        // `bytes_of`directly on accumulator_input
        let header_len = accumulator_input.header.header_len as usize - 8;


        let iter = accumulator_input
            .header
            .end_offsets
            .iter()
            .take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let accumulator_input_data = &accumulator_input_bytes[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(accumulator_input_data, expected_data.as_slice());
            start = end_offset;
        }
    }
}
